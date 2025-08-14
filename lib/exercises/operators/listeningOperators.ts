import { ProgressOperator, OperatorServices } from './base';
import { SessionProgress, ListeningExerciseProgress, SubmissionResult } from '@/lib/types';
import { z } from 'zod';
import { FsrsRating } from '@/lib/fsrs/engine';

class RevealListeningAnswerOperator implements ProgressOperator {
  async execute(current: SessionProgress): Promise<[SessionProgress, SubmissionResult]> {
    if (current.type !== 'LISTENING_EXERCISE') throw new Error('Invalid progress type.');
    if (!current.payload.current) throw new Error('No current card.');
    const newProgress: ListeningExerciseProgress = {
      ...current,
      stage: 'AWAITING_RATING',
    };
    return [newProgress, { isCorrect: true, feedback: 'Answer revealed.' }];
  }
}

class SubmitListeningRatingOperator implements ProgressOperator {
  async execute(
    current: SessionProgress,
    payload: unknown,
    services: OperatorServices
  ): Promise<[SessionProgress, SubmissionResult]> {
    if (current.type !== 'LISTENING_EXERCISE') throw new Error('Invalid progress type.');
    if (current.stage !== 'AWAITING_RATING') throw new Error('Cannot submit rating now.');
    if (!current.payload.current) throw new Error('No current card.');

    const parsed = z.object({ rating: z.number().min(1).max(4) }).parse(payload);

    const currentItem = current.payload.current;
    await services.listeningFsrsService!.recordReview(
      services.studentId,
      currentItem.cardId,
      parsed.rating as FsrsRating,
      services.sessionId
    );

    // Rebuild the queue from the fixed initial set: only items due now
    const allStates = await services.tx.studentListeningState.findMany({
      where: {
        studentId: services.studentId,
        cardId: { in: current.payload.initialCardIds },
      },
      include: { card: true },
    });
    const now = new Date();
    const newQueue = allStates
      .filter((s) => s.due <= now)
      .sort((a, b) => a.due.getTime() - b.due.getTime());

    const newProgress: ListeningExerciseProgress = {
      ...current,
      stage: 'PRESENTING_CARD',
      payload: {
        ...current.payload,
        queue: newQueue,
        current: newQueue.length > 0 ? newQueue[0] : undefined,
      },
    };

    return [newProgress, { isCorrect: true, feedback: 'Rating recorded.' }];
  }
}

export const revealListeningAnswerOperator = new RevealListeningAnswerOperator();
export const submitListeningRatingOperator = new SubmitListeningRatingOperator();
