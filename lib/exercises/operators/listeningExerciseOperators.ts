import {
  ProgressOperator,
  OperatorServices,
} from '@/lib/exercises/operators/base';
import {
  SubmissionResult,
  ListeningDeckProgress,
  SessionProgress,
} from '@/lib/types';
import { FsrsRating } from '@/lib/fsrs/engine';
import { z } from 'zod';

class PlayAudioOperator implements ProgressOperator {
  async execute(
    currentProgress: SessionProgress
  ): Promise<[SessionProgress, SubmissionResult]> {
    if (currentProgress.type !== 'LISTENING_EXERCISE')
      throw new Error('Invalid progress type.');
    if (currentProgress.stage !== 'PLAYING_AUDIO')
      throw new Error('Invalid stage for playing audio.');

    const newProgress: ListeningDeckProgress = {
      ...currentProgress,
      stage: 'AWAITING_RATING',
    };
    const result: SubmissionResult = {
      isCorrect: true,
      feedback: 'Audio played, ready for rating.',
    };
    return [newProgress, result];
  }
}

class SubmitListeningRatingOperator implements ProgressOperator {
  async execute(
    currentProgress: SessionProgress,
    payload: unknown,
    services: OperatorServices
  ): Promise<[SessionProgress, SubmissionResult]> {
    if (currentProgress.type !== 'LISTENING_EXERCISE')
      throw new Error('Invalid progress type.');
    if (currentProgress.stage !== 'AWAITING_RATING')
      throw new Error('Cannot submit rating now.');

    const validation = z
      .object({ rating: z.number().min(1).max(4) })
      .safeParse(payload);
    if (!validation.success)
      throw new Error(`Invalid payload: ${validation.error.message}`);
    const { rating } = validation.data;

    const currentQueueItem = currentProgress.payload.queue[0];
    if (!currentQueueItem)
      throw new Error('Cannot submit rating for an empty queue.');

    // Record the listening review (separate from vocabulary)
    await services.fsrsService.recordListeningReview(
      services.studentId,
      currentQueueItem.cardId,
      rating as FsrsRating,
      services.sessionId
    );

    // Rebuild the queue from the session's fixed scope of listening cards
    // Only cards that were present at session start, now filtering for due listening cards
    const allListeningCardsInSession = await services.tx.listeningCardState.findMany({
      where: {
        studentId: services.studentId,
        cardId: { in: currentProgress.payload.initialCardIds },
      },
      include: { card: true },
    });

    // Filter to currently due listening cards
    const now = new Date();
    const newQueue = allListeningCardsInSession
      .filter((state) => state.due <= now)
      .sort((a, b) => a.due.getTime() - b.due.getTime());

    const newProgress: ListeningDeckProgress = {
      ...currentProgress,
      stage: 'PLAYING_AUDIO',
      payload: {
        ...currentProgress.payload,
        queue: newQueue,
        currentCardData: newQueue.length > 0 ? newQueue[0] : undefined,
      },
    };

    const result: SubmissionResult = {
      isCorrect: true,
      feedback: 'Listening review recorded.',
    };
    return [newProgress, result];
  }
}

export const playAudioOperator = new PlayAudioOperator();
export const submitListeningRatingOperator = new SubmitListeningRatingOperator();