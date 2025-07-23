import {
  ProgressOperator,
  OperatorServices,
} from '@/lib/exercises/operators/base';
import {
  SessionProgress,
  SubmissionResult,
  VocabularyDeckProgress,
} from '@/lib/types';
import { FsrsRating } from '@/lib/fsrs/engine';
import { ReviewType } from '@prisma/client';
import { z } from 'zod';

// --- Validation Schemas for Operator Payloads ---

const SubmitRatingPayloadSchema = z.object({
  cardId: z.string().uuid(),
  rating: z.number().min(1).max(4),
});

// --- Progress Operators ---

/**
 * Operator responsible for transitioning the exercise state from presenting a word
 * to awaiting a user's rating. It's a simple state transition.
 */
class RevealAnswerOperator implements ProgressOperator {
  async execute(
    currentProgress: SessionProgress
  ): Promise<[SessionProgress, SubmissionResult]> {
    // Type guard to ensure we are working with the correct progress type.
    if (currentProgress.type !== 'VOCABULARY_DECK') {
      throw new Error('Invalid progress type for RevealAnswerOperator.');
    }

    // Ensure the current stage is correct for this action.
    if (currentProgress.stage !== 'PRESENTING_WORD') {
      throw new Error('Cannot reveal answer if not in PRESENTING_WORD stage.');
    }

    // Create a new progress object with the updated stage.
    const newProgress: VocabularyDeckProgress = {
      ...currentProgress,
      stage: 'AWAITING_RATING',
    };

    const result: SubmissionResult = {
      isCorrect: true, // This action is always "successful".
      feedback: 'Answer revealed.',
    };

    return [newProgress, result];
  }
}

/**
 * Operator responsible for recording an FSRS review and advancing to the next card.
 * This is the most complex operator for this exercise type.
 */
class SubmitRatingOperator implements ProgressOperator {
  async execute(
    currentProgress: SessionProgress,
    payload: unknown,
    services: OperatorServices
  ): Promise<[SessionProgress, SubmissionResult]> {
    // 1. Type guard and stage validation.
    if (currentProgress.type !== 'VOCABULARY_DECK') {
      throw new Error('Invalid progress type for SubmitRatingOperator.');
    }
    if (currentProgress.stage !== 'AWAITING_RATING') {
      throw new Error('Cannot submit rating if not in AWAITING_RATING stage.');
    }

    // 2. Meticulous payload validation.
    const validationResult = SubmitRatingPayloadSchema.safeParse(payload);
    if (!validationResult.success) {
      throw new Error(
        `Invalid payload for rating submission: ${validationResult.error.message}`
      );
    }
    const { cardId, rating } = validationResult.data;

    // 3. Delegate to the FSRS Service within the provided transaction.
    // We pass the correct ReviewType to enrich our historical data.
    await services.fsrsService.recordReview(
      services.studentId,
      cardId,
      rating as FsrsRating,
      ReviewType.VOCABULARY
    );

    // 4. Calculate the next state.
    const newIndex = currentProgress.payload.currentCardIndex + 1;
    const isDeckComplete = newIndex >= currentProgress.payload.cardIds.length;

    let nextCardData = undefined;
    // If the deck is not finished, pre-fetch the next card's data.
    if (!isDeckComplete) {
      nextCardData = await services.tx.vocabularyCard.findUnique({
        where: { id: currentProgress.payload.cardIds[newIndex] },
      });
      if (!nextCardData) {
        throw new Error(
          `Data integrity error: Could not find next card with id ${currentProgress.payload.cardIds[newIndex]}`
        );
      }
    }

    // 5. Construct the new progress object.
    const newProgress: VocabularyDeckProgress = {
      ...currentProgress,
      // Reset the stage for the next card, or leave it if the deck is done.
      stage: isDeckComplete ? 'AWAITING_RATING' : 'PRESENTING_WORD',
      payload: {
        ...currentProgress.payload,
        currentCardIndex: newIndex,
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

// --- Export Singleton Instances ---

export const revealAnswerOperator = new RevealAnswerOperator();
export const submitRatingOperator = new SubmitRatingOperator();
