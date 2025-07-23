import { prisma } from '@/lib/db';
import { FSRSService } from '@/lib/actions/fsrs';
import { ExerciseHandler } from '@/lib/exercises/handler';
import {
  ProgressOperator,
  OperatorServices,
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

/**
 * The definitive handler for `VOCABULARY_DECK` unit items.
 */
class VocabularyDeckHandler implements ExerciseHandler {
  private operators: Partial<Record<AnswerPayload['action'], ProgressOperator>>;

  constructor() {
    this.operators = {
      REVEAL_ANSWER: revealAnswerOperator,
      SUBMIT_RATING: submitRatingOperator,
    };
  }

  async initialize(sessionState: FullSessionState): Promise<FullSessionState> {
    const deck = sessionState.currentUnitItem?.vocabularyDeck;
    if (!deck) {
      throw new Error(
        'Data integrity error: VOCABULARY_DECK unit item is missing its deck.'
      );
    }

    const cards = await prisma.vocabularyCard.findMany({
      where: { deckId: deck.id },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
    });

    if (cards.length === 0) {
      const initialProgress: VocabularyDeckProgress = {
        type: 'VOCABULARY_DECK',
        stage: 'PRESENTING_WORD',
        payload: {
          cardIds: [],
          currentCardIndex: 0,
        },
      };

      const updatedSession = await prisma.session.update({
        where: { id: sessionState.id },
        data: { progress: initialProgress },
        include: fullSessionStateInclude,
      });
      // This cast is now safe because fullSessionStateInclude is complete.
      return updatedSession as unknown as FullSessionState;
    }

    const firstCardData = await prisma.vocabularyCard.findUnique({
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

    const updatedSession = await prisma.session.update({
      where: { id: sessionState.id },
      data: { progress: initialProgress },
      include: fullSessionStateInclude,
    });

    // This cast is now safe because fullSessionStateInclude is complete.
    return updatedSession as unknown as FullSessionState;
  }

  async submitAnswer(
    sessionState: FullSessionState,
    payload: AnswerPayload
  ): Promise<SubmissionResult> {
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

      await tx.session.update({
        where: { id: sessionState.id },
        data: { progress: newProgress },
      });

      return result;
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
