import { prisma } from '@/lib/db';
import {
  FSRS,
  FSRSItem,
  FSRSReview,
  FsrsRating,
  FSRS_DEFAULT_PARAMETERS,
  DEFAULT_DESIRED_RETENTION,
  MemoryState,
} from '@/lib/fsrs/engine';
import { Prisma, CardState, VocabularyCard } from '@prisma/client';
import { ListeningExerciseConfig } from '@/lib/types';
import { authorizeTeacherForStudent } from '../auth';

const DEFAULT_LISTENING_CONFIDENCE_THRESHOLD = 0.36; // good enough at listening
const DEFAULT_VOCAB_CONFIDENCE_THRESHOLD = 0.36; // advisory threshold not to disrupt vocab

// Parse simple durations like '3m', '15m', '1h', '2d'
function parseStep(step: string): number {
  const m = step.match(/^(\d+)([smhd])$/);
  if (!m) throw new Error(`Invalid step: ${step}`);
  const v = parseInt(m[1], 10);
  switch (m[2]) {
    case 's': return v * 1000;
    case 'm': return v * 60 * 1000;
    case 'h': return v * 60 * 60 * 1000;
    case 'd': return v * 24 * 60 * 60 * 1000;
    default: throw new Error('Invalid unit');
  }
}

const DEFAULT_LEARNING_STEPS = ['3m', '15m', '30m'];

export const ListeningFSRSService = {
  async recordReview(
    studentId: string,
    cardId: string,
    rating: FsrsRating,
    sessionId?: string
  ) {
    return prisma.$transaction(async (tx) => {
      const now = new Date();

      const prev = await tx.studentListeningState.findUnique({
        where: { studentId_cardId: { studentId, cardId } },
      });
      if (!prev) {
        throw new Error(`Listening state missing for student=${studentId} card=${cardId}`);
      }

      // Learning steps are always applied for NEW/RELEARNING listening cards
      const useSteps = prev.state === 'NEW' || prev.state === 'RELEARNING' || !prev.lastReview;

      if (useSteps) {
        // simple steps
        const stepsDone = await tx.listeningReviewHistory.count({
          where: { studentId, cardId, isLearningStep: true },
        });

        if (rating === 4) {
          // graduate immediately
          // fall through to FSRS below with current review
        } else {
          const stepIndex = rating === 1 ? 0 : stepsDone + 1;
          if (stepIndex < DEFAULT_LEARNING_STEPS.length) {
            const due = new Date(now.getTime() + parseStep(DEFAULT_LEARNING_STEPS[stepIndex]));
            const newState = (prev.state === 'REVIEW' || prev.state === 'RELEARNING') ? 'RELEARNING' : 'LEARNING';
            const updated = await tx.studentListeningState.update({
              where: { studentId_cardId: { studentId, cardId } },
              data: {
                due,
                lastReview: now,
                state: newState,
                lapses: rating === 1 ? { increment: 1 } : undefined,
              },
            });
            await tx.listeningReviewHistory.create({
              data: {
                studentId,
                cardId,
                sessionId,
                rating,
                previousState: prev.state,
                previousDifficulty: prev.difficulty,
                previousStability: prev.stability,
                previousDue: prev.due,
                isLearningStep: true,
                reviewedAt: now,
              },
            });
            return updated;
          }
          // else graduate: fall through to FSRS
        }
      }

      // FSRS for listening
      const params = await tx.studentListeningFsrsParams.findFirst({ where: { studentId, isActive: true } });
      const w = (params?.w as number[]) ?? FSRS_DEFAULT_PARAMETERS;
      const engine = new FSRS(w);
      const currentMemory = prev.state === CardState.NEW
        ? undefined
        : new MemoryState(prev.stability, prev.difficulty);
      const daysSince = (!prev.lastReview || prev.state === CardState.NEW)
        ? 0
        : Math.round((now.getTime() - prev.lastReview.getTime()) / (1000 * 60 * 60 * 24));
      const next = engine.nextStates(currentMemory, DEFAULT_DESIRED_RETENTION, daysSince);
      const chosen = rating === 1 ? next.again : rating === 2 ? next.hard : rating === 3 ? next.good : next.easy;
      const due = new Date(now.getTime() + chosen.interval * 86400000);
      const updated = await tx.studentListeningState.update({
        where: { studentId_cardId: { studentId, cardId } },
        data: {
          stability: chosen.memory.stability,
          difficulty: chosen.memory.difficulty,
          due,
          lastReview: now,
          reps: { increment: 1 },
          lapses: rating === 1 ? { increment: 1 } : undefined,
          state: rating === 1 ? 'RELEARNING' : 'REVIEW',
          intervalDays: chosen.interval,
          retrievability: engine.computeRetrievability(chosen.memory, 0),
        },
      });
      await tx.listeningReviewHistory.create({
        data: {
          studentId,
          cardId,
          sessionId,
          rating,
          previousState: prev.state,
          previousDifficulty: prev.difficulty,
          previousStability: prev.stability,
          previousDue: prev.due,
          isLearningStep: false,
          reviewedAt: now,
        },
      });
      return updated;
    });
  },

  /**
   * Compute a listening session queue: keep only listening-good cards, then sort by vocab confidence and take top N.
   * Returns the selected VocabularyCard[] and the advisory suggestedCount.
   */
  async getInitialListeningQueue(
    studentId: string,
    config: ListeningExerciseConfig
  ): Promise<{ cards: VocabularyCard[]; suggestedCount: number }> {
    const count = config.count ?? 10;
    const listenThresh = config.listeningConfidenceThreshold ?? DEFAULT_LISTENING_CONFIDENCE_THRESHOLD;
    const vocabThresh = config.vocabConfidenceThreshold ?? DEFAULT_VOCAB_CONFIDENCE_THRESHOLD;

    // Load listening states joined to cards
    const listeningStates = await prisma.studentListeningState.findMany({
      where: { studentId, state: { not: 'NEW' }, stability: { gt: 0 }, lastReview: { not: null } },
      include: { card: true },
    });

    const now = Date.now();
    const withListeningRetrievability = listeningStates.map((st) => {
      const elapsedDays = st.lastReview ? (now - st.lastReview.getTime()) / 86400000 : 0;
      const r = Math.exp(-elapsedDays / (st.stability || 1));
      return { st, rListening: r };
    });

    const listeningGood = withListeningRetrievability.filter((x) => x.rListening > listenThresh && !!x.st.card);

    if (listeningGood.length === 0) {
      return { cards: [], suggestedCount: 0 };
    }

    // Get vocabulary states for the same cards to compute vocab retrievability for sorting and advisory
    const cardIds = listeningGood.map((x) => x.st.cardId);
    const vocabStates = await prisma.studentCardState.findMany({
      where: { studentId, cardId: { in: cardIds }, stability: { gt: 0 }, lastReview: { not: null } },
      select: { cardId: true, stability: true, lastReview: true },
    });
    const vocabMap = new Map(vocabStates.map((s) => [s.cardId, s]));

    const enriched = listeningGood.map((x) => {
      const s = vocabMap.get(x.st.cardId);
      if (!s) return { ...x, rVocab: 0 };
      const elapsedDays = s.lastReview ? (now - s.lastReview.getTime()) / 86400000 : 0;
      const r = Math.exp(-elapsedDays / (s.stability || 1));
      return { ...x, rVocab: r };
    });

    // Sort by vocab confidence desc
    enriched.sort((a, b) => b.rVocab - a.rVocab);

    // Advisory suggestedCount: largest prefix where rVocab >= vocabThresh
    let suggested = 0;
    for (let i = 0; i < enriched.length; i++) {
      if (enriched[i].rVocab >= vocabThresh) suggested = i + 1; else break;
    }

    const selected = enriched.slice(0, count).map((e) => e.st.card!);
    return { cards: selected, suggestedCount: Math.min(suggested, count) };
  },

  /**
   * Suggests the maximum count n for a listening section such that, after
   * filtering to listening-good cards, the top-n by vocabulary retrievability
   * all meet or exceed the vocab threshold.
   */
  async suggestMaxCount(
    studentId: string,
    cfg: { listeningConfidenceThreshold?: number; vocabConfidenceThreshold?: number }
  ): Promise<number> {
    const listenThresh = cfg.listeningConfidenceThreshold ?? DEFAULT_LISTENING_CONFIDENCE_THRESHOLD;
    const vocabThresh = cfg.vocabConfidenceThreshold ?? DEFAULT_VOCAB_CONFIDENCE_THRESHOLD;

    const listeningStates = await prisma.studentListeningState.findMany({
      where: { studentId, state: { not: 'NEW' }, stability: { gt: 0 }, lastReview: { not: null } },
      include: { card: true },
    });
    const now = Date.now();
    const withListeningRetrievability = listeningStates.map((st) => {
      const elapsedDays = st.lastReview ? (now - st.lastReview.getTime()) / 86400000 : 0;
      const r = Math.exp(-elapsedDays / (st.stability || 1));
      return { st, rListening: r };
    });
    const listeningGood = withListeningRetrievability.filter((x) => x.rListening > listenThresh && !!x.st.card);
    if (listeningGood.length === 0) return 0;

    const cardIds = listeningGood.map((x) => x.st.cardId);
    const vocabStates = await prisma.studentCardState.findMany({
      where: { studentId, cardId: { in: cardIds }, stability: { gt: 0 }, lastReview: { not: null } },
      select: { cardId: true, stability: true, lastReview: true },
    });
    const vocabMap = new Map(vocabStates.map((s) => [s.cardId, s]));
    const enriched = listeningGood.map((x) => {
      const s = vocabMap.get(x.st.cardId);
      const elapsedDays = s?.lastReview ? (now - s.lastReview.getTime()) / 86400000 : 0;
      const r = s ? Math.exp(-elapsedDays / (s.stability || 1)) : 0;
      return { ...x, rVocab: r };
    });
    enriched.sort((a, b) => b.rVocab - a.rVocab);
    let suggested = 0;
    for (let i = 0; i < enriched.length; i++) {
      if (enriched[i].rVocab >= vocabThresh) suggested = i + 1; else break;
    }
    return suggested;
  },

  async _optimizeParameters(payload: Prisma.JsonValue): Promise<{ message: string; params?: any }> {
    const { studentId } = payload as { studentId: string };
    if (!studentId) throw new Error('Invalid payload: studentId is required.');

    const allHistory = await prisma.listeningReviewHistory.findMany({
      where: { studentId, isLearningStep: false },
      orderBy: { reviewedAt: 'asc' },
    });
    if (allHistory.length < 50) {
      const message = `Skipping listening optimization for student ${studentId}: insufficient FSRS history (${allHistory.length}).`;
      return { message };
    }

    const reviewsByCard = allHistory.reduce((acc, review) => {
      (acc[review.cardId] ||= []).push(review);
      return acc;
    }, {} as Record<string, { rating: number; reviewedAt: Date }[]>);

    const trainingSet = Object.values(reviewsByCard).map((history) => {
      const fsrsReviews = history.map((review, idx) => {
        let delta_t = 0;
        if (idx > 0) {
          const prev = history[idx - 1];
          delta_t = Math.round((review.reviewedAt.getTime() - prev.reviewedAt.getTime()) / 86400000);
        }
        return new FSRSReview(review.rating, delta_t);
      });
      return new FSRSItem(fsrsReviews);
    });

    const engine = new FSRS();
    const newWeights = await engine.computeParameters(trainingSet, true);
    const result = await prisma.$transaction(async (tx) => {
      await tx.studentListeningFsrsParams.updateMany({ where: { studentId }, data: { isActive: false } });
      const created = await tx.studentListeningFsrsParams.create({
        data: {
          studentId,
          w: newWeights,
          isActive: true,
          trainingDataSize: allHistory.length,
          lastOptimized: new Date(),
        },
      });
      return created;
    });
    return { message: `Optimized listening params for student ${studentId}.`, params: result };
  },

  async createOptimizeParametersJob(studentId: string, teacherId: string) {
    await authorizeTeacherForStudent(teacherId, studentId);
    return prisma.job.create({
      data: {
        ownerId: teacherId,
        type: 'OPTIMIZE_LISTENING_PARAMS' as any,
        payload: { studentId },
      },
    });
  },
};
