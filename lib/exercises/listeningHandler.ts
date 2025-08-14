import { prisma } from '@/lib/db';
import { ExerciseHandler } from './handler';
import { TransactionClient } from './operators/base';
import { FullSessionState, AnswerPayload, SubmissionResult, SessionProgress, ListeningExerciseProgress } from '@/lib/types';
import { ListeningExerciseConfigSchema } from '@/lib/schemas';
import { revealListeningAnswerOperator, submitListeningRatingOperator } from '@/lib/exercises/operators/listeningOperators';
import { ListeningFSRSService } from '@/lib/actions/listening';
import { fullSessionStateInclude } from '@/lib/prisma-includes';

const DEFAULTS = {
  count: 10,
  listeningConfidenceThreshold: 0.36,
  vocabConfidenceThreshold: 0.36,
};

export class ListeningHandler implements ExerciseHandler {
  private operators = {
    REVEAL_ANSWER: revealListeningAnswerOperator,
    SUBMIT_RATING: submitListeningRatingOperator,
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
    // Fetch listening states for selected cards
    const states = await db.studentListeningState.findMany({
      where: { studentId: sessionState.studentId, cardId: { in: initialCardIds } },
      include: { card: true },
    });
    // Preserve selected cards order
    const orderMap = new Map(initialCardIds.map((id, idx) => [id, idx]));
    const initialQueue = states.sort((a, b) => (orderMap.get(a.cardId)! - orderMap.get(b.cardId)!));
    const progress: ListeningExerciseProgress = {
      type: 'LISTENING_EXERCISE',
      stage: 'PRESENTING_CARD',
      payload: {
        queue: initialQueue,
        current: initialQueue[0],
        config,
        initialCardIds,
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

    const services = { tx, listeningFsrsService: ListeningFSRSService, studentId: sessionState.studentId, sessionId: sessionState.id };
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
