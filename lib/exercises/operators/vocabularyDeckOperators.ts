// NEW FILE: /lib/exercises/operators/unifiedVocabularyOperators.ts

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

    const validation = z
      .object({ rating: z.number().min(1).max(4) })
      .safeParse(payload);
    if (!validation.success)
      throw new Error(`Invalid payload: ${validation.error.message}`);
    const { rating } = validation.data;

    const currentQueueItem = currentProgress.payload.queue[0];
    if (!currentQueueItem)
      throw new Error('Cannot submit rating for an empty queue.');

    // 1. Record the review. This is the primary side-effect that changes the due dates.
    await services.fsrsService.recordReview(
      services.studentId,
      currentQueueItem.cardId,
      rating as FsrsRating,
      ReviewType.VOCABULARY
    );

    // 2. REFINEMENT: Rebuild the entire queue dynamically based on the session's initial scope.
    // This is the core of the "truly dynamic" logic.
    const allSessionStates = await services.tx.studentCardState.findMany({
      where: {
        studentId: services.studentId,
        cardId: { in: currentProgress.payload.initialCardIds },
      },
      select: { cardId: true, due: true, state: true },
    });

    // 3. Filter for all cards that are now due and sort them.
    const newQueue: VocabularyQueueItem[] = allSessionStates
      .filter((state) => state.due <= new Date())
      .map((state) => ({
        cardId: state.cardId,
        due: state.due,
        isNew: state.state === 'NEW',
      }))
      .sort((a, b) => a.due.getTime() - b.due.getTime());

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
