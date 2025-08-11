import {
  ProgressOperator,
  OperatorServices,
} from '@/lib/exercises/operators/base';
import {
  SubmissionResult,
  VocabularyDeckProgress,
  SessionProgress,
} from '@/lib/types';
import { StudentCardState, VocabularyCard, ReviewType } from '@prisma/client';
import { FsrsRating } from '@/lib/fsrs/engine';
import { z } from 'zod';

class RevealAnswerOperator implements ProgressOperator {
  async execute(
    currentProgress: SessionProgress
  ): Promise<[SessionProgress, SubmissionResult]> {
    if (currentProgress.type !== 'VOCABULARY_DECK')
      throw new Error('Invalid progress type.');
    if (currentProgress.stage !== 'PRESENTING_CARD')
      throw new Error('Invalid stage for revealing answer.');

    const newProgress: VocabularyDeckProgress = {
      ...currentProgress,
      stage: 'AWAITING_RATING',
    };
    const result: SubmissionResult = {
      isCorrect: true,
      feedback: 'Answer revealed.',
    };
    return [newProgress, result];
  }
}

class SubmitRatingOperator implements ProgressOperator {
  async execute(
    currentProgress: SessionProgress,
    payload: unknown,
    services: OperatorServices
  ): Promise<[SessionProgress, SubmissionResult]> {
    if (currentProgress.type !== 'VOCABULARY_DECK')
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

    await services.fsrsService.recordReview(
      services.studentId,
      currentQueueItem.cardId,
      rating as FsrsRating,
      ReviewType.VOCABULARY,
      services.sessionId // Pass the sessionId
    );

    // the session's scope is fixed upon initialization.
    // We ONLY rebuild the queue from the set of cards that were present at the start.
    // This makes session behavior predictable and ensures the initial "new card"
    // configuration is respected for the entire session.
    const allCardsInSession = await services.tx.studentCardState.findMany({
      where: {
        studentId: services.studentId,
        cardId: { in: currentProgress.payload.initialCardIds },
      },
      include: { card: true },
    });

    // From that fixed set, filter down to the cards that are currently due.
    const now = new Date();
    const newQueue = allCardsInSession
      .filter((state) => state.due <= now)
      .sort((a, b) => a.due.getTime() - b.due.getTime());

    const newProgress: VocabularyDeckProgress = {
      ...currentProgress,
      stage: 'PRESENTING_CARD',
      payload: {
        ...currentProgress.payload,
        queue: newQueue,
        currentCardData: newQueue.length > 0 ? newQueue[0] : undefined,
      },
    };

    const result: SubmissionResult = {
      isCorrect: true,
      feedback: 'Review recorded.',
    };
    return [newProgress, result];
  }
}

export const revealAnswerOperator = new RevealAnswerOperator();
export const submitRatingOperator = new SubmitRatingOperator();

