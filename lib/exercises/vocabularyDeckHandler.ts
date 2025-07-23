import { prisma } from '@/lib/db';
import { FSRSService } from '@/lib/actions/fsrs';
import { ExerciseHandler } from '@/lib/exercises/handler';
import {
  ProgressOperator,
  OperatorServices,
  TransactionClient,
} from '@/lib/exercises/operators/base';
import {
  revealAnswerOperator,
  submitRatingOperator,
} from '@/lib/exercises/operators/vocabularyDeckOperators';
import {
  FullSessionState,
  AnswerPayload,
  VocabularyDeckProgress,
  SubmissionResult,
  SessionProgress,
} from '@/lib/types';
import { fullSessionStateInclude } from '@/lib/prisma-includes';

class VocabularyDeckHandler implements ExerciseHandler {
  private operators: Partial<Record<AnswerPayload['action'], ProgressOperator>>;

  constructor() {
    this.operators = {
      REVEAL_ANSWER: revealAnswerOperator,
      SUBMIT_RATING: submitRatingOperator,
    };
  }

  async initialize(
    sessionState: FullSessionState,
    tx?: TransactionClient
  ): Promise<FullSessionState> {
    // REFINEMENT: Use the provided transactional client `tx` if available,
    // otherwise fall back to the global `prisma` client.
    const db = tx || prisma;

    const deck = sessionState.currentUnitItem?.vocabularyDeck;
    if (!deck) {
      throw new Error(
        'Data integrity error: VOCABULARY_DECK unit item is missing its deck.'
      );
    }

    const cards = await db.vocabularyCard.findMany({
      where: { deckId: deck.id },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
    });

    if (cards.length === 0) {
      const initialProgress: VocabularyDeckProgress = {
        type: 'VOCABULARY_DECK',
        stage: 'PRESENTING_WORD',
        payload: { cardIds: [], currentCardIndex: 0 },
      };
      const updatedSession = await db.session.update({
        where: { id: sessionState.id },
        data: { progress: initialProgress },
        include: fullSessionStateInclude,
      });
      return updatedSession as unknown as FullSessionState;
    }

    const firstCardData = await db.vocabularyCard.findUnique({
      where: { id: cards[0].id },
    });
    if (!firstCardData) {
      throw new Error(
        `Data integrity error: Could not find first card with id ${cards[0].id}`
      );
    }

    const initialProgress: VocabularyDeckProgress = {
      type: 'VOCABULARY_DECK',
      stage: 'PRESENTING_WORD',
      payload: {
        cardIds: cards.map((c) => c.id),
        currentCardIndex: 0,
        currentCardData: firstCardData,
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
    payload: AnswerPayload
  ): Promise<[SubmissionResult, SessionProgress]> {
    const operator = this.operators[payload.action];
    if (!operator) {
      throw new Error(
        `Unsupported action '${payload.action}' for VocabularyDeckHandler.`
      );
    }

    if (sessionState.progress?.type !== 'VOCABULARY_DECK') {
      throw new Error(
        'Logic error: submitAnswer called with mismatched progress type.'
      );
    }

    // REFINEMENT: This method is now a pure state transition function.
    // It does NOT interact with the database. It returns the new progress state.
    // The transaction will be managed by the SessionService.
    return prisma.$transaction(async (tx) => {
      const services: OperatorServices = {
        tx,
        fsrsService: FSRSService,
        studentId: sessionState.studentId,
      };

      const [newProgress, result] = await operator.execute(
        sessionState.progress as SessionProgress,
        payload.data,
        services
      );

      // The handler no longer updates the session. It returns the result.
      return [result, newProgress];
    });
  }

  async isComplete(sessionState: FullSessionState): Promise<boolean> {
    const progress = sessionState.progress;
    if (progress?.type !== 'VOCABULARY_DECK') {
      console.error(
        'isComplete check failed: progress is null or of the wrong type.'
      );
      return true;
    }
    return progress.payload.currentCardIndex >= progress.payload.cardIds.length;
  }
}

export const vocabularyDeckHandler = new VocabularyDeckHandler();
