import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { ExerciseHandler } from './handler';
import { revealAnswerOperator, submitCorrectnessOperator } from './operators/fillInTheBlankOperators';
import { 
  FullSessionState, 
  AnswerPayload, 
  SubmissionResult, 
  SessionProgress, 
  FillInTheBlankProgress
} from '@/lib/types';
import { fullSessionStateInclude } from '@/lib/prisma-includes';
import { FillInTheBlankExerciseConfigSchema } from '@/lib/schemas';
import { TransactionClient } from './operators/base';
import { FSRSService } from '@/lib/actions/fsrs';

/**
 * Handler for Fill in the Blank exercises.
 * 
 * This handler implements the core game logic:
 * 1. Initialize with cards that haven't been completed yet
 * 2. Optionally filter by vocabulary confidence threshold (if bound to a vocab deck)
 * 3. Present cards one by one: "reveal answer" -> "submit correctness"
 * 4. Correct cards are marked as done forever, incorrect cards go back to queue
 * 5. Exercise completes when queue is empty
 */
class FillInTheBlankHandler implements ExerciseHandler {
  private operators = {
    REVEAL_ANSWER: revealAnswerOperator,
    SUBMIT_RATING: submitCorrectnessOperator, // Map SUBMIT_RATING to correctness operator
  };

  /**
   * Initialize a new Fill in the Blank session.
   * This method sets up the initial queue of cards for the student.
   */
  async initialize(sessionState: FullSessionState, tx?: TransactionClient): Promise<FullSessionState> {
    const db = tx || prisma;
    const unitItem = sessionState.unit.items.find(i => i.id === sessionState.currentUnitItemId)!;
    
    if (!unitItem.fillInTheBlankDeck) {
      throw new Error('Fill in the Blank deck not found for this unit item.');
    }

    const deck = unitItem.fillInTheBlankDeck;
    const config = FillInTheBlankExerciseConfigSchema.parse(unitItem.exerciseConfig ?? {}) || {};

    // Get cards that the student has already completed (marked as "done")
    const doneCards = await db.studentFillInTheBlankCardDone.findMany({
      where: { 
        studentId: sessionState.studentId, 
        card: { deckId: deck.id } 
      },
      select: { cardId: true },
    });
    const doneCardIds = new Set(doneCards.map(c => c.cardId));

    // Get all cards from the deck that are not yet done
    let availableCards = await db.fillInTheBlankCard.findMany({
      where: { 
        deckId: deck.id,
        id: { notIn: Array.from(doneCardIds) } 
      },
    });

    // Apply vocabulary confidence threshold filtering if configured
    if (deck.boundVocabularyDeckId && config.vocabularyConfidenceThreshold) {
      // Get student's vocabulary card states for the bound deck
      const studentCardStates = await db.studentCardState.findMany({
        where: { 
          studentId: sessionState.studentId, 
          state: 'REVIEW', // Only review cards have meaningful stability
          stability: { gt: 0 } 
        },
        select: { cardId: true, stability: true, lastReview: true },
      });

      // Create a map of cardId -> retrievability
      const retrievabilityMap = new Map<string, number>();
      const now = Date.now();
      
      studentCardStates.forEach(cardState => {
        if (cardState.lastReview) {
          const deltaT = (now - cardState.lastReview.getTime()) / (1000 * 86400); // days
          const retrievability = Math.exp(-deltaT / cardState.stability);
          retrievabilityMap.set(cardState.cardId, retrievability);
        }
      });

      // Filter Fill in the Blank cards based on vocabulary confidence
      availableCards = availableCards.filter(card => {
        if (!card.boundVocabularyCardId) {
          // Unbound cards are always included
          return true;
        }
        
        const retrievability = retrievabilityMap.get(card.boundVocabularyCardId) ?? 0;
        return retrievability >= config.vocabularyConfidenceThreshold!;
      });
    }

    // Shuffle the cards for variety
    const shuffledCards = [...availableCards].sort(() => Math.random() - 0.5);
    const initialCardIds = shuffledCards.map(c => c.id);

    // Create the initial progress state
    const initialProgress: FillInTheBlankProgress = {
      type: 'FILL_IN_THE_BLANK_EXERCISE',
      stage: 'PRESENTING_CARD',
      payload: {
        queue: shuffledCards,
        currentCardData: shuffledCards[0],
        config,
        initialCardIds,
      },
    };

    // Update the session with the initial progress
    const updatedSession = await db.session.update({
      where: { id: sessionState.id },
      data: { progress: initialProgress as Prisma.InputJsonValue },
      include: fullSessionStateInclude,
    });

    return updatedSession as unknown as FullSessionState;
  }

  /**
   * Handle answer submission during a Fill in the Blank session.
   * Delegates to the appropriate operator based on the action.
   */
  async submitAnswer(
    sessionState: FullSessionState, 
    payload: AnswerPayload, 
    tx: TransactionClient
  ): Promise<[SubmissionResult, SessionProgress]> {
    const operator = this.operators[payload.action as keyof typeof this.operators];
    
    if (!operator) {
      throw new Error(`Unknown action: ${payload.action}`);
    }

    const services = { 
      tx, 
      fsrsService: FSRSService, // FSRS service provided but not used for Fill in the Blank
      studentId: sessionState.studentId, 
      sessionId: sessionState.id 
    };

    const [newProgress, result] = await operator.execute(sessionState.progress!, payload.data, services);
    
    return [result, newProgress];
  }

  /**
   * Check if the Fill in the Blank exercise is complete.
   * It's complete when the queue is empty (all cards have been answered correctly).
   */
  async isComplete(sessionState: FullSessionState): Promise<boolean> {
    const progress = sessionState.progress;
    
    if (progress?.type !== 'FILL_IN_THE_BLANK_EXERCISE') {
      return true; // If no progress or wrong type, consider it complete
    }

    return progress.payload.queue.length === 0;
  }
}

export const fillInTheBlankHandler = new FillInTheBlankHandler();