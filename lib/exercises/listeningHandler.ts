import { prisma } from '@/lib/db';
import { ExerciseHandler } from './handler';
import { TransactionClient } from './operators/base';
import { FullSessionState, AnswerPayload, SubmissionResult, SessionProgress, ListeningExerciseProgress } from '@/lib/types';
import { ListeningExerciseConfigSchema } from '@/lib/schemas';
import { revealListeningAnswerOperator, submitTextAnswerOperator } from '@/lib/exercises/operators/listeningOperators';
import { ListeningFSRSService } from '@/lib/actions/listening';
import { fullSessionStateInclude } from '@/lib/prisma-includes';

const DEFAULTS = {
  count: 10,
  listeningConfidenceThreshold: 0.36,
  vocabConfidenceThreshold: 0.36,
  maxAttempts: 2,
  caseSensitive: false,
  ignoreSpaces: true,
  stripPunctuation: true,
  alternateAnswers: [] as string[],
  typoTolerance: 0,
};

export class ListeningHandler implements ExerciseHandler {
  private operators = {
    REVEAL_ANSWER: revealListeningAnswerOperator,
    SUBMIT_TEXT_ANSWER: submitTextAnswerOperator,
  } as const;

  async initialize(sessionState: FullSessionState, tx?: TransactionClient): Promise<FullSessionState> {
    const db = tx || prisma;
    const unitItemFromUnit = sessionState.unit?.items.find((i) => i.id === sessionState.currentUnitItemId);
    const rawConfig = unitItemFromUnit?.exerciseConfig ?? sessionState.currentUnitItem?.exerciseConfig ?? {};
    const parsed = ListeningExerciseConfigSchema.parse(rawConfig) ?? {};
    const config = { ...DEFAULTS, ...parsed };

    // Ensure listening states exist for student+card? We select from existing listening states only.
    const { cards, suggestedCount } = await ListeningFSRSService.getInitialListeningQueue(sessionState.studentId, config);

    const initialCardIds = cards.map((c) => c.id);
    const progress: ListeningExerciseProgress = {
      type: 'LISTENING_EXERCISE',
      stage: 'AWAITING_ANSWER',
      payload: {
        queue: cards.map((c) => ({ card: c })),
        current: cards[0] ? { card: cards[0] } : undefined,
        attempts: 0,
        maxAttempts: config.maxAttempts,
        config,
        initialCardIds,
        advisory: { suggestedCount, threshold: config.vocabConfidenceThreshold },
      },
    };

    const updated = await db.session.update({
      where: { id: sessionState.id },
      data: { progress: progress as any },
      include: fullSessionStateInclude,
    });
    return updated as unknown as FullSessionState;
  }

  async submitAnswer(
    sessionState: FullSessionState,
    payload: AnswerPayload,
    tx: TransactionClient
  ): Promise<[SubmissionResult, SessionProgress]> {
    const op = (this.operators as any)[payload.action];
    if (!op) throw new Error(`Unsupported action '${payload.action}' for listening handler.`);
    if (sessionState.progress?.type !== 'LISTENING_EXERCISE') throw new Error('Mismatched progress type.');

    const services = { tx, fsrsService: undefined as any, studentId: sessionState.studentId, sessionId: sessionState.id };
    const [newProgress, result] = await op.execute(sessionState.progress as SessionProgress, payload.data, services);
    return [result, newProgress];
  }

  async isComplete(sessionState: FullSessionState): Promise<boolean> {
    const p = sessionState.progress;
    if (!p || p.type !== 'LISTENING_EXERCISE') return true;
    return p.payload.queue.length === 0;
  }
}

export const listeningHandler = new ListeningHandler();

