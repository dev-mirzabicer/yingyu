import { prisma } from '@/lib/db';
import { FSRSService } from '@/lib/actions/fsrs';
import { ExerciseHandler } from '@/lib/exercises/handler';
import {
  submitStudentAnswerOperator,
  revealAnswerOperator,
  markCorrectOperator,
  markIncorrectOperator,
} from '@/lib/exercises/operators/fillInBlankOperators';
import {
  FullSessionState,
  AnswerPayload,
  SubmissionResult,
  SessionProgress,
  FillInBlankExerciseProgress,
  FillInBlankExerciseConfig,
} from '@/lib/types';
import { fullSessionStateInclude } from '@/lib/prisma-includes';
import { FillInBlankExerciseConfigSchema } from '@/lib/schemas';
import { TransactionClient } from './operators/base';

/**
 * Helper function to fetch vocabulary card data for the current card.
 * Used when setting currentCardData for the next card in the queue.
 */
async function fetchCardData(cardId: string, tx: TransactionClient) {
  const card = await tx.vocabularyCard.findUnique({
    where: { id: cardId },
    select: {
      id: true,
      englishWord: true,
      chineseTranslation: true,
      pinyin: true,
    },
  });
  
  if (!card) {
    throw new Error(`Card with ID ${cardId} not found.`);
  }
  
  return {
    cardId: card.id,
    englishWord: card.englishWord,
    chineseTranslation: card.chineseTranslation,
    pinyin: card.pinyin || undefined,
  };
}

class FillInBlankExerciseHandler implements ExerciseHandler {
  private operators = {
    SUBMIT_STUDENT_ANSWER: submitStudentAnswerOperator,
    REVEAL_ANSWER: revealAnswerOperator,
    MARK_CORRECT: markCorrectOperator,
    MARK_INCORRECT: markIncorrectOperator,
  };

  async initialize(
    sessionState: FullSessionState,
    tx?: TransactionClient
  ): Promise<FullSessionState> {
    const db = tx || prisma;
    
    // Get the unit item containing the fill-in-blank exercise
    const unitItemFromUnit = sessionState.unit?.items.find(
      (i) => i.id === sessionState.currentUnitItemId
    );
    const rawConfig =
      unitItemFromUnit?.exerciseConfig ??
      sessionState.currentUnitItem?.exerciseConfig ??
      {};
    const config = FillInBlankExerciseConfigSchema.parse(rawConfig);

    const currentUnitItem = sessionState.currentUnitItem;
    const fillInBlankExerciseId = currentUnitItem?.fillInBlankExerciseId;

    if (!fillInBlankExerciseId) {
      throw new Error('No fill-in-blank exercise found for this unit item.');
    }

    // Get the fill-in-blank exercise and its associated vocabulary deck
    const fillInBlankExercise = await db.fillInBlankExercise.findUnique({
      where: { id: fillInBlankExerciseId },
      include: { vocabularyDeck: true }
    });

    if (!fillInBlankExercise) {
      throw new Error('Fill-in-blank exercise not found.');
    }

    const deckId = fillInBlankExercise.vocabularyDeckId;

    // Create enhanced configuration with defaults
    const enhancedConfig: FillInBlankExerciseConfig = {
      ...config,
      deckId,
      maxCards: config?.maxCards || 20,
      vocabularyConfidenceThreshold: config?.vocabularyConfidenceThreshold || 0.8,
      shuffleCards: config?.shuffleCards ?? true,
    };

    // Use the new flexible method that handles both bound and unbound cards
    const { candidates, warnings } = await FSRSService.getFillInBlankCandidatesWithFlexibleBinding(
      sessionState.studentId,
      deckId,
      {
        maxCards: enhancedConfig.maxCards,
        vocabularyConfidenceThreshold: enhancedConfig.vocabularyConfidenceThreshold,
        allowUnboundCards: true, // Allow cards not yet learned in vocabulary mode
      }
    );

    // Create queue from candidates
    const queue = candidates.map(card => ({ cardId: card.id }));
    
    // Optionally shuffle the queue
    if (enhancedConfig.shuffleCards && queue.length > 1) {
      // Fisher-Yates shuffle algorithm
      for (let i = queue.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [queue[i], queue[j]] = [queue[j], queue[i]];
      }
    }

    // Handle empty queue case
    if (queue.length === 0) {
      const emptyProgress: FillInBlankExerciseProgress = {
        type: 'FILL_IN_BLANK_EXERCISE',
        stage: 'SHOWING_QUESTION',
        payload: { 
          queue: [], 
          currentCardData: null, 
          config: enhancedConfig, 
          sessionWarnings: warnings 
        },
      };
      
      const updatedSession = await db.session.update({
        where: { id: sessionState.id },
        data: { progress: emptyProgress as any },
        include: fullSessionStateInclude,
      });
      
      return updatedSession as unknown as FullSessionState;
    }

    // Get first card data for the initial state
    const firstCardData = await fetchCardData(queue[0].cardId, db);

    // Create initial progress state
    const initialProgress: FillInBlankExerciseProgress = {
      type: 'FILL_IN_BLANK_EXERCISE',
      stage: 'SHOWING_QUESTION',
      payload: {
        queue,
        currentCardData: firstCardData,
        config: enhancedConfig,
        sessionWarnings: warnings,
      },
    };

    // Update session with initial progress
    const updatedSession = await db.session.update({
      where: { id: sessionState.id },
      data: { progress: initialProgress as any },
      include: fullSessionStateInclude,
    });

    return updatedSession as unknown as FullSessionState;
  }

  async submitAnswer(
    sessionState: FullSessionState,
    payload: AnswerPayload,
    tx: TransactionClient
  ): Promise<[SubmissionResult, SessionProgress]> {
    // Get the operator for the action
    const operator =
      this.operators[payload.action as keyof typeof this.operators];
    if (!operator) {
      throw new Error(
        `Unsupported action '${payload.action}' for fill-in-blank exercise handler.`
      );
    }
    
    // Validate progress type
    if (sessionState.progress?.type !== 'FILL_IN_BLANK_EXERCISE') {
      throw new Error('Mismatched progress type for fill-in-blank exercise.');
    }

    // Pass the transaction client and fill-in-blank-specific services to the operator
    const services = {
      tx,
      fsrsService: FSRSService,
      studentId: sessionState.studentId,
      sessionId: sessionState.id,
    };
    
    const [newProgress, result] = await operator.execute(
      sessionState.progress as SessionProgress,
      payload.data,
      services
    );
    
    return [result, newProgress];
  }

  async isComplete(sessionState: FullSessionState): Promise<boolean> {
    const progress = sessionState.progress;
    if (progress?.type !== 'FILL_IN_BLANK_EXERCISE') {
      console.error(
        'isComplete check failed: progress is null or of the wrong type.'
      );
      return true;
    }
    
    // Exercise is complete when the queue is empty (all cards have been marked as "seen")
    return progress.payload.queue.length === 0;
  }
}

export const fillInBlankExerciseHandler = new FillInBlankExerciseHandler();