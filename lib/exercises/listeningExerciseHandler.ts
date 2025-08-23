import { prisma } from '@/lib/db';
import { FSRSService } from '@/lib/actions/fsrs';
import { ExerciseHandler } from '@/lib/exercises/handler';
import {
  playAudioOperator,
  submitListeningRatingOperator,
} from '@/lib/exercises/operators/listeningExerciseOperators';
import {
  FullSessionState,
  AnswerPayload,
  SubmissionResult,
  SessionProgress,
  ListeningDeckProgress,
  ListeningExerciseConfig,
} from '@/lib/types';
import { fullSessionStateInclude } from '@/lib/prisma-includes';
import { ListeningExerciseConfigSchema } from '@/lib/schemas';
import { TransactionClient } from './operators/base';
import { ListeningCardState, VocabularyCard, Prisma } from '@prisma/client';

type EnrichedListeningCardState = ListeningCardState & { card: VocabularyCard };

class ListeningExerciseHandler implements ExerciseHandler {
  private operators = {
    PLAY_AUDIO: playAudioOperator,
    SUBMIT_RATING: submitListeningRatingOperator,
  };

  /**
   * Interleaves new cards evenly into a sorted list of due cards.
   * Same algorithm as vocabulary deck but for listening cards.
   */
  private interleave(
    dueItems: EnrichedListeningCardState[],
    newItems: EnrichedListeningCardState[]
  ): EnrichedListeningCardState[] {
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
    const config = ListeningExerciseConfigSchema.parse(rawConfig);

    const currentUnitItem = sessionState.currentUnitItem;
    const listeningExerciseId = currentUnitItem?.listeningExerciseId;

    if (!listeningExerciseId) {
      throw new Error('No listening exercise found for this unit item.');
    }

    // Get the listening exercise and its associated vocabulary deck
    const listeningExercise = await db.listeningExercise.findUnique({
      where: { id: listeningExerciseId },
      include: { vocabularyDeck: true }
    });

    if (!listeningExercise) {
      throw new Error('Listening exercise not found.');
    }

    const deckId = listeningExercise.vocabularyDeckId;

    const enhancedConfig: ListeningExerciseConfig = {
      ...config,
      deckId,
      newCards: config?.newCards || 10,
      maxDue: config?.maxDue || 20,
      minDue: config?.minDue || 0,
      vocabularyConfidenceThreshold: config?.vocabularyConfidenceThreshold || 0.8,
      listeningCandidateThreshold: config?.listeningCandidateThreshold || 0.6,
      learningSteps: config?.learningSteps || ['3m', '15m', '30m'],
    };

    // Get the listening review queue using our smart selection algorithm
    const { dueItems, newItems, warnings } = await FSRSService.getListeningReviewQueue(
      sessionState.studentId,
      deckId,
      {
        newCards: enhancedConfig.newCards,
        maxDue: enhancedConfig.maxDue,
        minDue: enhancedConfig.minDue,
        vocabularyConfidenceThreshold: enhancedConfig.vocabularyConfidenceThreshold,
        listeningCandidateThreshold: enhancedConfig.listeningCandidateThreshold,
      }
    );

    const initialQueue = this.interleave(dueItems, newItems);
    const initialCardIds = initialQueue.map((item) => item.cardId);

    if (initialQueue.length === 0) {
      const emptyProgress: ListeningDeckProgress = {
        type: 'LISTENING_EXERCISE',
        stage: 'PLAYING_AUDIO',
        payload: { 
          queue: [], 
          config: enhancedConfig, 
          initialCardIds: [],
          sessionWarnings: warnings 
        },
      };
      const updatedSession = await db.session.update({
        where: { id: sessionState.id },
        data: { progress: emptyProgress as Prisma.InputJsonValue },
        include: fullSessionStateInclude,
      });
      return updatedSession as unknown as FullSessionState;
    }

    const firstCardData = initialQueue[0];

    const initialProgress: ListeningDeckProgress = {
      type: 'LISTENING_EXERCISE',
      stage: 'PLAYING_AUDIO',
      payload: {
        queue: initialQueue,
        currentCardData: firstCardData,
        config: enhancedConfig,
        initialCardIds,
        sessionWarnings: warnings,
      },
    };

    const updatedSession = await db.session.update({
      where: { id: sessionState.id },
      data: { progress: initialProgress as Prisma.InputJsonValue },
      include: fullSessionStateInclude,
    });

    return updatedSession as unknown as FullSessionState;
  }

  async submitAnswer(
    sessionState: FullSessionState,
    payload: AnswerPayload,
    tx: TransactionClient
  ): Promise<[SubmissionResult, SessionProgress]> {
    const operator =
      this.operators[payload.action as keyof typeof this.operators];
    if (!operator)
      throw new Error(
        `Unsupported action '${payload.action}' for this handler.`
      );
    if (sessionState.progress?.type !== 'LISTENING_EXERCISE')
      throw new Error('Mismatched progress type.');

    // Pass the transaction client and listening-specific services to the operator
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
    if (progress?.type !== 'LISTENING_EXERCISE') {
      console.error(
        'isComplete check failed: progress is null or of the wrong type.'
      );
      return true;
    }
    return progress.payload.queue.length === 0;
  }
}

export const listeningExerciseHandler = new ListeningExerciseHandler();