import { ExerciseHandler, SubmissionResult, DisplayData } from './handler';
import { FullSessionState, AnswerPayload } from '@/lib/types';
import { FSRSService } from '../actions/fsrs';
import { FsrsRating } from '../fsrs/engine';
import { z } from 'zod';

// This handler uses the exact same payload structure as the FSRS review.
const VocabSubmissionSchema = z.object({
  cardId: z.string().uuid(),
  rating: z.number().min(1).max(4),
});

class VocabularyDeckHandler implements ExerciseHandler {
  async getDisplayData(sessionState: FullSessionState): Promise<DisplayData> {
    // For a vocabulary deck unit item, the display data is simply the first card.
    // A more advanced implementation could track progress within the deck.
    const deck = sessionState.currentUnitItem?.vocabularyDeck;
    if (!deck || deck.cards.length === 0) {
      throw new Error(
        'Vocabulary deck is empty or not found for this unit item.'
      );
    }

    // In a real scenario, we'd fetch the full card details here.
    const firstCard = deck.cards[0];

    return {
      type: 'VOCABULARY_CARD',
      payload: firstCard, // This would be the full card object
    };
  }

  async submitAnswer(
    sessionState: FullSessionState,
    payload: AnswerPayload
  ): Promise<SubmissionResult> {
    const validationResult = VocabSubmissionSchema.safeParse(payload);
    if (!validationResult.success) {
      throw new Error(
        `Invalid payload for vocabulary submission: ${validationResult.error.message}`
      );
    }
    const { cardId, rating } = validationResult.data;

    // Delegate to the same core service. This demonstrates high reusability.
    await FSRSService.recordReview(
      sessionState.studentId,
      cardId,
      rating as FsrsRating
    );

    return {
      isCorrect: true,
      feedback: 'Card review recorded.',
    };
  }
}

export const vocabularyDeckHandler = new VocabularyDeckHandler();
