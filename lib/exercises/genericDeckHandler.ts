import { prisma } from '@/lib/db';
import { FSRSService } from '@/lib/actions/fsrs';
import { ExerciseHandler } from '@/lib/exercises/handler';
import {
  revealAnswerOperator,
  submitRatingOperator,
} from '@/lib/exercises/operators/genericDeckOperators';
import {
  FullSessionState,
  AnswerPayload,
  SubmissionResult,
  SessionProgress,
  GenericDeckProgress,
  VocabularyExerciseConfig,
} from '@/lib/types';
import { fullSessionStateInclude } from '@/lib/prisma-includes';
import { VocabularyExerciseConfigSchema } from '@/lib/schemas';
import { TransactionClient } from './operators/base';
import { StudentGenericCardState, GenericCard } from '@prisma/client';

type EnrichedStudentGenericCardState = StudentGenericCardState & { card: GenericCard };

class GenericDeckHandler implements ExerciseHandler {
  private operators = {
    REVEAL_ANSWER: revealAnswerOperator,
    SUBMIT_RATING: submitRatingOperator,
  };

  /**
   * Interleaves new cards evenly into a sorted list of due cards.
   */
  private interleave(
    dueItems: EnrichedStudentGenericCardState[],
    newItems: EnrichedStudentGenericCardState[]
  ): EnrichedStudentGenericCardState[] {
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
    const unitItemFromUnit = sessionState.unit?.items.find(
      (i) => i.id === sessionState.currentUnitItemId
    );
    const rawConfig =
      unitItemFromUnit?.exerciseConfig ??
      sessionState.currentUnitItem?.exerciseConfig ??
      {};
    const config = VocabularyExerciseConfigSchema.parse(rawConfig) ?? {};

    const currentUnitItem = sessionState.currentUnitItem;
    const deckId = currentUnitItem?.genericDeckId;

    if (!deckId) {
      throw new Error('No generic deck found for this unit item.');
    }

    const enhancedConfig: VocabularyExerciseConfig = {
      ...config,
      deckId,
      learningSteps: config?.learningSteps || ['3m', '15m', '30m'],
    };

    const { dueItems, newItems } = await FSRSService.getInitialGenericReviewQueue(
      sessionState.studentId,
      enhancedConfig
    );

    const fetchCards = async (states: StudentGenericCardState[]) => {
      const cardIds = states.map(s => s.cardId);
      const cards = await db.genericCard.findMany({ where: { id: { in: cardIds } } });
      const cardMap = new Map(cards.map(c => [c.id, c]));
      return states.map(s => ({ ...s, card: cardMap.get(s.cardId)! }));
    };

    const enrichedDueItems = await fetchCards(dueItems);
    const enrichedNewItems = await fetchCards(newItems);

    const initialQueue = this.interleave(enrichedDueItems, enrichedNewItems);
    const initialCardIds = initialQueue.map((item) => item.cardId);

    if (initialQueue.length === 0) {
      const emptyProgress: GenericDeckProgress = {
        type: 'GENERIC_DECK',
        stage: 'PRESENTING_CARD',
        payload: { queue: [], config: enhancedConfig, initialCardIds },
      };
      const updatedSession = await db.session.update({
        where: { id: sessionState.id },
        data: { progress: emptyProgress as any },
        include: fullSessionStateInclude,
      });
      return updatedSession as unknown as FullSessionState;
    }

    const firstCardData = initialQueue[0];

    const initialProgress: GenericDeckProgress = {
      type: 'GENERIC_DECK',
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
      data: { progress: initialProgress as any },
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
    if (sessionState.progress?.type !== 'GENERIC_DECK')
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
    if (progress?.type !== 'GENERIC_DECK') {
      console.error(
        'isComplete check failed: progress is null or of the wrong type.'
      );
      return true;
    }
    return progress.payload.queue.length === 0;
  }
}

export const genericDeckHandler = new GenericDeckHandler();