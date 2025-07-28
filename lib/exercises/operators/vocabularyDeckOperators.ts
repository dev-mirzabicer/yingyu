import {
  ProgressOperator,
  OperatorServices,
} from '@/lib/exercises/operators/base';
import {
  SubmissionResult,
  VocabularyDeckProgress,
  SessionProgress,
  VocabularyQueueItem,
} from '@/lib/types';
import { FsrsRating } from '@/lib/fsrs/engine';
import { ReviewType } from '@prisma/client';
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

    const allSessionStates = await services.tx.studentCardState.findMany({
      where: {
        studentId: services.studentId,
        cardId: { in: currentProgress.payload.initialCardIds },
      },
      select: { cardId: true, due: true, state: true },
    });

    const newQueue: VocabularyQueueItem[] = allSessionStates
      .filter((state) => state.due <= new Date())
      .map((state) => ({
        cardId: state.cardId,
        due: state.due,
        isNew: state.state === 'NEW',
      }))
      .sort((a, b) => a.due.getTime() - b.due.getTime());

    let nextCardData = undefined;
    if (newQueue.length > 0) {
      nextCardData = await services.tx.vocabularyCard.findUnique({
        where: { id: newQueue[0].cardId },
      });
      if (!nextCardData)
        throw new Error(
          `Data integrity error: Card ${newQueue[0].cardId} not found.`
        );
    }

    const newProgress: VocabularyDeckProgress = {
      ...currentProgress,
      stage: 'PRESENTING_CARD',
      payload: {
        ...currentProgress.payload,
        queue: newQueue,
        currentCardData: nextCardData,
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

