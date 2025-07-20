import { ExerciseHandler, SubmissionResult, DisplayData } from './handler';
import { FullSessionState, AnswerPayload } from '@/lib/types';
import { FSRSService } from '../actions/fsrs';
import { FsrsRating } from '../fsrs/engine';
import { z } from 'zod';

// Define a Zod schema for validating the answer payload for this specific handler.
const FsrsReviewPayloadSchema = z.object({
  cardId: z.string().uuid(),
  rating: z.number().min(1).max(4),
});

class FsrsReviewHandler implements ExerciseHandler {
  async getDisplayData(sessionState: FullSessionState): Promise<DisplayData> {
    const dueCards = await FSRSService.getDueCardsForStudent(
      sessionState.studentId
    );
    return {
      type: 'FSRS_REVIEW',
      payload: dueCards,
    };
  }

  async submitAnswer(
    sessionState: FullSessionState,
    payload: AnswerPayload
  ): Promise<SubmissionResult> {
    // 1. Meticulous Validation: Validate the incoming payload against our schema.
    const validationResult = FsrsReviewPayloadSchema.safeParse(payload);
    if (!validationResult.success) {
      throw new Error(
        `Invalid payload for FSRS review: ${validationResult.error.message}`
      );
    }
    const { cardId, rating } = validationResult.data;

    // 2. Delegate to the Core Service: The handler's job is to orchestrate, not to reimplement.
    await FSRSService.recordReview(
      sessionState.studentId,
      cardId,
      rating as FsrsRating
    );

    // 3. Return a consistent result. For FSRS, the action is always considered "correct"
    // in that it was successfully recorded. The rating itself reflects performance.
    return {
      isCorrect: true,
      feedback: 'Review recorded.',
    };
  }
}

export const fsrsReviewHandler = new FsrsReviewHandler();
