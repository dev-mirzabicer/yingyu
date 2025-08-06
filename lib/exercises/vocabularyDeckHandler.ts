import { prisma } from '@/lib/db';
import { FSRSService } from '@/lib/actions/fsrs';
import { ExerciseHandler } from '@/lib/exercises/handler';
import {
  revealAnswerOperator,
  submitRatingOperator,
} from '@/lib/exercises/operators/vocabularyDeckOperators';
import {
  FullSessionState,
  AnswerPayload,
  SubmissionResult,
  SessionProgress,
  VocabularyDeckProgress,
  VocabularyExerciseConfig,
  VocabularyQueueItem,
} from '@/lib/types';
import { fullSessionStateInclude } from '@/lib/prisma-includes';
import { VocabularyExerciseConfigSchema } from '@/lib/schemas';
import { TransactionClient } from './operators/base';

class VocabularyDeckHandler implements ExerciseHandler {
  private operators = {
    REVEAL_ANSWER: revealAnswerOperator,
    SUBMIT_RATING: submitRatingOperator,
  };

  /**
   * Interleaves new cards evenly into a sorted list of due cards.
   */
  private interleave(
    dueItems: VocabularyQueueItem[],
    newItems: VocabularyQueueItem[]
  ): VocabularyQueueItem[] {
    if (newItems.length === 0) return dueItems;
    if (dueItems.length === 0) return newItems;

    const combined = [...dueItems];
    const interval = Math.floor(combined.length / (newItems.length + 1));

    newItems.forEach((newItem, i) => {
      const insertionIndex = Math.min(combined.length, (i + 1) * interval + i);
      combined.splice(insertionIndex, 0, newItem);
    });

    return combined;
  }

  async initialize(
    sessionState: FullSessionState,
    tx?: TransactionClient
  ): Promise<FullSessionState> {
    const db = tx || prisma;
    const config = 
      VocabularyExerciseConfigSchema.parse(
        sessionState.currentUnitItem?.exerciseConfig ?? {}
      ) ?? {};

    // FIXED: Get the deck ID from the current unit item to enable proper dynamic queue
    const currentUnitItem = sessionState.currentUnitItem;
    const deckId = currentUnitItem?.vocabularyDeck?.id;
    
    if (!deckId) {
      throw new Error('No vocabulary deck found for this unit item.');
    }

    // Include deck ID and default learning steps in config for the SubmitRatingOperator
    const enhancedConfig: VocabularyExerciseConfig = { 
      ...config, 
      deckId,
      learningSteps: config?.learningSteps || ['3m', '15m', '30m'] // Default learning steps
    };

    const { dueItems, newItems } = await FSRSService.getInitialReviewQueue(
      sessionState.studentId,
      enhancedConfig
    );

    const initialQueue = this.interleave(dueItems, newItems);
    const initialCardIds = initialQueue.map((item) => item.cardId);

    if (initialQueue.length === 0) {
      const emptyProgress: VocabularyDeckProgress = {
        type: 'VOCABULARY_DECK',
        stage: 'PRESENTING_CARD',
        payload: { queue: [], config: enhancedConfig, initialCardIds },
      };
      const updatedSession = await db.session.update({
        where: { id: sessionState.id },
        data: { progress: emptyProgress },
        include: fullSessionStateInclude,
      });
      return updatedSession as unknown as FullSessionState;
    }

    const firstCardData = await db.vocabularyCard.findUnique({
      where: { id: initialQueue[0].cardId },
    });
    if (!firstCardData)
      throw new Error(
        `Data integrity error: Card ${initialQueue[0].cardId} not found.`
      );

    const initialProgress: VocabularyDeckProgress = {
      type: 'VOCABULARY_DECK',
      stage: 'PRESENTING_CARD',
      payload: {
        queue: initialQueue,
        currentCardData: firstCardData,
        config: enhancedConfig,
        initialCardIds,
      },
    };

    const updatedSession = await db.session.update({
      where: { id: sessionState.id },
      data: { progress: initialProgress },
      include: fullSessionStateInclude,
    });

    return updatedSession as unknown as FullSessionState;
  }

  async submitAnswer(
    sessionState: FullSessionState,
    payload: AnswerPayload,
    tx: TransactionClient // Now receives the transaction client from SessionService
  ): Promise<[SubmissionResult, SessionProgress]> {
    const operator =
      this.operators[payload.action as keyof typeof this.operators];
    if (!operator)
      throw new Error(
        `Unsupported action '${payload.action}' for this handler.`
      );
    if (sessionState.progress?.type !== 'VOCABULARY_DECK')
      throw new Error('Mismatched progress type.');

    // The transaction is now managed by the caller (SessionService).
    // We just pass the transactional client down to the operator.
    const services = {
      tx,
      fsrsService: FSRSService,
      studentId: sessionState.studentId,
      sessionId: sessionState.id, // Pass the session ID
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
    if (progress?.type !== 'VOCABULARY_DECK') {
      console.error(
        'isComplete check failed: progress is null or of the wrong type.'
      );
      return true;
    }
    return progress.payload.queue.length === 0;
  }
}

export const vocabularyDeckHandler = new VocabularyDeckHandler();

