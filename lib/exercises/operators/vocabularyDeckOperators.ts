// NEW FILE: /lib/exercises/operators/unifiedVocabularyOperators.ts

import {
  ProgressOperator,
  OperatorServices,
} from '@/lib/exercises/operators/base';
import {
  SubmissionResult,
  VocabularyDeckProgress,
  SessionProgress,
} from '@/lib/types';
import { FsrsRating } from '@/lib/fsrs/engine';
import { ReviewType } from '@prisma/client';
import { z } from 'zod';

// --- Validation Schemas ---
const SubmitRatingPayloadSchema = z.object({
  rating: z.number().min(1).max(4),
});

// --- Helper Functions ---
/**
 * A helper to re-insert a lapsed card back into the queue while maintaining sort order.
 */
const insertIntoSortedQueue = (
  queue: VocabularyDeckProgress['payload']['queue'],
  item: VocabularyDeckProgress['payload']['queue'][0]
) => {
  const index = queue.findIndex((i) => i.due > item.due);
  if (index === -1) {
    queue.push(item); // Add to end if it's the latest due date
  } else {
    queue.splice(index, 0, item); // Insert at correct sorted position
  }
};

// --- Progress Operators ---

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

    const validation = SubmitRatingPayloadSchema.safeParse(payload);
    if (!validation.success)
      throw new Error(`Invalid payload: ${validation.error.message}`);
    const { rating } = validation.data;

    const currentQueueItem = currentProgress.payload.queue[0];
    if (!currentQueueItem)
      throw new Error('Cannot submit rating for an empty queue.');

    // 1. Record the review. This is the primary side-effect.
    await services.fsrsService.recordReview(
      services.studentId,
      currentQueueItem.cardId,
      rating as FsrsRating,
      ReviewType.VOCABULARY // This is now the unified review type
    );

    // 2. Begin queue management: remove the reviewed card from the front.
    const newQueue = currentProgress.payload.queue.slice(1);

    // 3. Check for "lapse" (card is still due immediately after review).
    const updatedState = await services.tx.studentCardState.findUnique({
      where: {
        studentId_cardId: {
          studentId: services.studentId,
          cardId: currentQueueItem.cardId,
        },
      },
      select: { due: true },
    });

    if (updatedState && updatedState.due <= new Date()) {
      // The card lapsed and needs to be re-inserted into the queue.
      insertIntoSortedQueue(newQueue, {
        ...currentQueueItem,
        due: updatedState.due,
      });
    }

    // 4. Prepare the next state.
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

    // 5. Construct the new progress object.
    const newProgress: VocabularyDeckProgress = {
      ...currentProgress,
      stage: 'PRESENTING_CARD', // Reset stage for the next card
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
