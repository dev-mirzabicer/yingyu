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
import {
  ReviewHistory,
  StudentCardState,
  StudentStatus,
  VocabularyCard,
  CardState,
  ReviewType,
  Job,
  Prisma,
} from '@prisma/client';
import { authorizeTeacherForStudent } from '../auth';
import { JobService } from './jobs';
import { FsrsStats, VocabularyExerciseConfig } from '../types';
import { OptimizeParamsPayloadSchema, RebuildCachePayloadSchema } from '../schemas';

/**
 * A constant representing the minimum retrievability for a card to be considered
 * for listening practice. A value of 0.36 corresponds to the point where the
 * review interval equals the card's stability (t=S), indicating a reasonably
 * well-known card.
 */
const LISTENING_CANDIDATE_RETRIEVABILITY_THRESHOLD = 0.36;

/**
 * Default learning steps for new cards: 3 minutes, 15 minutes, 30 minutes.
 * These steps are used when no custom learning steps are configured.
 */
const DEFAULT_LEARNING_STEPS = ['3m', '15m', '30m'];

/**
 * Parses a learning step duration string (e.g., '3m', '15m', '1h', '2d') into milliseconds.
 * @param step The duration string to parse.
 * @returns The duration in milliseconds.
 */
function parseLearningStepDuration(step: string): number {
  const match = step.match(/^(\d+)([smhd])$/);
  if (!match) {
    throw new Error(`Invalid learning step format: ${step}. Expected format like '3m', '15m', '1h', '2d'.`);
  }

  const [, value, unit] = match;
  const num = parseInt(value, 10);

  switch (unit) {
    case 's': return num * 1000; // seconds to ms
    case 'm': return num * 60 * 1000; // minutes to ms  
    case 'h': return num * 60 * 60 * 1000; // hours to ms
    case 'd': return num * 24 * 60 * 60 * 1000; // days to ms
    default: throw new Error(`Invalid time unit: ${unit}`);
  }
}

// --- REFACTORING: FSRS Context Configuration ---
// This interface defines the unique models and types for a specific FSRS context
// (e.g., Vocabulary, Listening), allowing us to create generic, reusable functions.
type FsrsContextConfig = {
  stateModel: 'studentCardState' | 'listeningCardState';
  paramsModel: 'studentFsrsParams' | 'listeningFsrsParams';
  reviewType: ReviewType;
};

const VOCABULARY_CONTEXT: FsrsContextConfig = {
  stateModel: 'studentCardState',
  paramsModel: 'studentFsrsParams',
  reviewType: 'VOCABULARY',
};

const LISTENING_CONTEXT: FsrsContextConfig = {
  stateModel: 'listeningCardState',
  paramsModel: 'listeningFsrsParams',
  reviewType: 'LISTENING',
};

// --- REFACTORING: Generic FSRS Core Logic ---

/**
 * [INTERNAL GENERIC IMPLEMENTATION]
 * Records a student's review for any FSRS context (Vocabulary, Listening, etc.).
 * This function contains the core logic for both learning steps and FSRS scheduling.
 *
 * @param context The FSRS context configuration (models and review type).
 * @param studentId The UUID of the student.
 * @param cardId The UUID of the card being reviewed.
 * @param rating The student's performance rating (1-4).
 * @param sessionId Optional session ID.
 * @returns A promise that resolves to the updated card state.
 */
async function _recordReviewInternal(
  context: FsrsContextConfig,
  studentId: string,
  cardId: string,
  rating: FsrsRating,
  sessionId?: string
): Promise<any> {
  return prisma.$transaction(async (tx) => {
    const now = new Date();
    // Cast dynamic model delegates to `any` to avoid union call signature issues.
    // This preserves behavior while keeping the refactor non-breaking.
    const stateDelegate = tx[context.stateModel] as any;
    const paramsDelegate = tx[context.paramsModel] as any;

    // 1. Get learning steps configuration
    let learningSteps = DEFAULT_LEARNING_STEPS;
    if (sessionId) {
      try {
        const session = await tx.session.findUnique({
          where: { id: sessionId },
          select: { progress: true }
        });

        if (session?.progress) {
          const progress = session.progress as any;
          const config = progress?.payload?.config;
          if (config?.learningSteps && Array.isArray(config.learningSteps)) {
            learningSteps = config.learningSteps;
          }
        }
      } catch (error) {
        console.warn('Failed to fetch session config for learning steps, using defaults:', error);
      }
    }

    // 2. Get current card state
    const previousCardState = await stateDelegate.findUnique({
      where: { studentId_cardId: { studentId, cardId } },
    });

    if (!previousCardState) {
      throw new Error(
        `FSRSService Integrity Error (${context.reviewType}): Cannot record review for a card that has no initial state. StudentId: ${studentId}, CardId: ${cardId}`
      );
    }

    // 3. Check if this card should use learning steps
    const shouldUseLearningSteps = await _shouldUseLearningStepsInternal(
      context,
      studentId,
      cardId,
      learningSteps,
      tx
    );

    if (shouldUseLearningSteps) {
      // ============= LEARNING STEPS LOGIC =============
      const { shouldGraduate, newDueDate } = await _calculateLearningStepsDueInternal(
        context,
        studentId,
        cardId,
        rating,
        learningSteps,
        tx
      );

      if (shouldGraduate) {
        // ========= GRADUATION: Fall through to FSRS logic =========
      } else {
        // ========= STAY IN LEARNING STEPS =========
        const newState = (previousCardState.state === 'REVIEW' || previousCardState.state === 'RELEARNING')
          ? 'RELEARNING'
          : 'LEARNING';

        const updatedState = await stateDelegate.update({
          where: { studentId_cardId: { studentId, cardId } },
          data: {
            due: newDueDate,
            lastReview: now,
            lapses: rating === 1 ? { increment: 1 } : undefined,
            state: newState,
          },
        });

        await tx.reviewHistory.create({
          data: {
            studentId,
            cardId,
            rating,
            reviewType: context.reviewType,
            sessionId,
            reviewedAt: now,
            previousState: previousCardState.state,
            previousDifficulty: previousCardState.difficulty,
            previousStability: previousCardState.stability,
            previousDue: previousCardState.due,
            isLearningStep: true,
          },
        });

        return updatedState;
      }
    }

    // ============= FSRS LOGIC =============
    // 4. Get student's FSRS parameters
    const studentParams = await paramsDelegate.findFirst({
      where: { studentId, isActive: true },
    });
    const w = (studentParams?.w as number[]) ?? FSRS_DEFAULT_PARAMETERS;
    const engine = new FSRS(w);

    // 5. Determine memory state
    const currentMemory =
      previousCardState.state === CardState.NEW
        ? undefined
        : new MemoryState(
          previousCardState.stability,
          previousCardState.difficulty
        );

    // 6. Calculate days since last FSRS review
    const daysSinceLastReview = (previousCardState.state === CardState.NEW || !previousCardState.lastReview)
      ? 0
      : Math.round(
        (now.getTime() - previousCardState.lastReview.getTime()) /
        (1000 * 60 * 60 * 24)
      );

    // 7. Get next states from FSRS engine
    const nextStates = engine.nextStates(
      currentMemory,
      DEFAULT_DESIRED_RETENTION,
      daysSinceLastReview
    );

    // 8. Select state based on rating
    let newState;
    switch (rating) {
      case 1:
        newState = nextStates.again;
        break;
      case 2:
        newState = nextStates.hard;
        break;
      case 3:
        newState = nextStates.good;
        break;
      case 4:
        newState = nextStates.easy;
        break;
      default:
        throw new Error(`Invalid FSRS rating: ${rating}`);
    }

    // 9. Calculate new due date
    const newDueDate = new Date(
      now.getTime() + newState.interval * 24 * 60 * 60 * 1000
    );

    // 10. Update card state with FSRS results
    const updatedState = await stateDelegate.update({
      where: { studentId_cardId: { studentId, cardId } },
      data: {
        stability: newState.memory.stability,
        difficulty: newState.memory.difficulty,
        due: newDueDate,
        lastReview: now,
        reps: { increment: 1 },
        lapses: rating === 1 ? { increment: 1 } : undefined,
        state: rating === 1 ? 'RELEARNING' : 'REVIEW',
      },
    });

    // 11. Record as FSRS review
    await tx.reviewHistory.create({
      data: {
        studentId,
        cardId,
        rating,
        reviewType: context.reviewType,
        sessionId,
        reviewedAt: now,
        previousState: previousCardState.state,
        previousDifficulty: previousCardState.difficulty,
        previousStability: previousCardState.stability,
        previousDue: previousCardState.due,
        isLearningStep: false,
      },
    });

    return updatedState;
  });
}

/**
 * [INTERNAL GENERIC IMPLEMENTATION]
 * Determines if a card should use learning steps for a given context.
 */
async function _shouldUseLearningStepsInternal(
  context: FsrsContextConfig,
  studentId: string,
  cardId: string,
  learningSteps: string[],
  tx: any
): Promise<boolean> {
  const stateDelegate = tx[context.stateModel];

  const cardState = await stateDelegate.findUnique({
    where: { studentId_cardId: { studentId, cardId } },
    select: { state: true }
  });

  if (!cardState || (cardState.state !== 'NEW' && cardState.state !== 'RELEARNING')) {
    return false;
  }

  // IMPORTANT FIX: We now correctly scope the learning step count to the review type.
  const learningStepReviews = await tx.reviewHistory.count({
    where: {
      studentId,
      cardId,
      reviewType: context.reviewType,
      isLearningStep: true
    }
  });

  return learningStepReviews < learningSteps.length;
}

/**
 * [INTERNAL GENERIC IMPLEMENTATION]
 * Calculates the next due date for a card in learning steps for a given context.
 */
async function _calculateLearningStepsDueInternal(
  context: FsrsContextConfig,
  studentId: string,
  cardId: string,
  rating: FsrsRating,
  learningSteps: string[],
  tx: any
): Promise<{ shouldGraduate: boolean; newDueDate: Date }> {
  const now = new Date();

  if (rating === 4) {
    return { shouldGraduate: true, newDueDate: now };
  }

  // IMPORTANT FIX: We now correctly scope the learning step count to the review type.
  const currentStepReviews = await tx.reviewHistory.count({
    where: {
      studentId,
      cardId,
      reviewType: context.reviewType,
      isLearningStep: true
    }
  });

  if (rating === 1) {
    const firstStepDuration = parseLearningStepDuration(learningSteps[0]);
    return {
      shouldGraduate: false,
      newDueDate: new Date(now.getTime() + firstStepDuration)
    };
  }

  const nextStep = currentStepReviews + 1;

  if (nextStep >= learningSteps.length) {
    return { shouldGraduate: true, newDueDate: now };
  }

  const nextStepDuration = parseLearningStepDuration(learningSteps[nextStep]);
  return {
    shouldGraduate: false,
    newDueDate: new Date(now.getTime() + nextStepDuration)
  };
}

/**
 * [INTERNAL GENERIC IMPLEMENTATION]
 * Optimizes FSRS parameters for any context.
 */
async function _optimizeParametersInternal(
  context: FsrsContextConfig,
  payload: Prisma.JsonValue
): Promise<{ message: string; params?: any }> {
  const { studentId } = payload as { studentId: string };
  if (!studentId) {
    throw new Error('Invalid payload: studentId is required.');
  }

  const paramsDelegate = prisma[context.paramsModel];

  // Only get FSRS reviews (exclude learning step reviews) for optimization
  const allHistory = await prisma.reviewHistory.findMany({
    where: {
      studentId,
      reviewType: context.reviewType,
      isLearningStep: false
    },
    orderBy: { reviewedAt: 'asc' },
  });

  // FSRS optimization requires a meaningful amount of FSRS data.
  if (allHistory.length < 50) {
    const message = `Skipping optimization for student ${studentId} (${context.reviewType}): insufficient FSRS review history (${allHistory.length} reviews). At least 50 FSRS reviews are recommended.`;
    console.log(message);
    return { message };
  }

  const reviewsByCard = allHistory.reduce((acc, review) => {
    if (!acc[review.cardId]) acc[review.cardId] = [];
    acc[review.cardId].push(review);
    return acc;
  }, {} as Record<string, ReviewHistory[]>);

  const trainingSet = Object.values(reviewsByCard).map((history) => {
    const fsrsReviews = _mapHistoryToFsrsReviews(history as ReviewHistory[]);
    return new FSRSItem(fsrsReviews);
  });

  const engine = new FSRS();
  const newWeights = await engine.computeParameters(trainingSet, true);

  const result = await prisma.$transaction(async (tx) => {
    await (tx[context.paramsModel] as any).updateMany({
      where: { studentId },
      data: { isActive: false },
    });
    const newParams = await (tx[context.paramsModel] as any).create({
      data: {
        studentId,
        w: newWeights,
        isActive: true,
        trainingDataSize: allHistory.length,
        lastOptimized: new Date(),
      },
    });
    return newParams;
  });

  return {
    message: `Successfully optimized parameters for student ${studentId} (${context.reviewType}).`,
    params: result,
  };
}

/**
 * [PRIVATE] A helper function to transform our database ReviewHistory into the
 * FSRSReview[] format required by the FSRS engine.
 */
function _mapHistoryToFsrsReviews(history: ReviewHistory[]): FSRSReview[] {
  return history.map((review, index) => {
    let delta_t = 0;
    if (index > 0) {
      const previousReview = history[index - 1];
      delta_t = Math.round(
        (review.reviewedAt.getTime() - previousReview.reviewedAt.getTime()) /
        (1000 * 60 * 60 * 24)
      );
    }
    return new FSRSReview(review.rating, delta_t);
  });
}

// --- END REFACTORING ---

/**
 * The definitive, re-engineered FSRS Service. This service is the scientific core
 * of the application, leveraging the full power of the `fsrs-rs-nodejs` engine
 * and our "History as Source of Truth" architectural principle.
 */
export const FSRSService = {
  /**
   * [LEGACY COMPATIBILITY] Vocabulary-specific learning steps check.
   * This is now a facade that calls the generic internal implementation.
   */
  async _shouldUseLearningSteps(
    studentId: string,
    cardId: string,
    learningSteps: string[],
    tx?: any
  ): Promise<boolean> {
    return _shouldUseLearningStepsInternal(
      VOCABULARY_CONTEXT,
      studentId,
      cardId,
      learningSteps,
      tx || prisma
    );
  },

  /**
   * [LEGACY COMPATIBILITY] Vocabulary-specific learning steps calculation.
   * This is now a facade that calls the generic internal implementation.
   */
  async _calculateLearningStepsDue(
    studentId: string,
    cardId: string,
    rating: FsrsRating,
    learningSteps: string[],
    tx?: any
  ): Promise<{ shouldGraduate: boolean; newDueDate: Date }> {
    return _calculateLearningStepsDueInternal(
      VOCABULARY_CONTEXT,
      studentId,
      cardId,
      rating,
      learningSteps,
      tx || prisma
    );
  },

  /**
   * [PERFECTED IMPLEMENTATION WITH SIMPLE LEARNING STEPS]
   * Records a student's review with Anki-like learning steps logic.
   * This is now a facade that calls the generic internal implementation.
   */
  async recordReview(
    studentId: string,
    cardId: string,
    rating: FsrsRating,
    reviewType: ReviewType, // reviewType is kept for signature compatibility, but we use the context's type
    sessionId?: string
  ): Promise<StudentCardState> {
    // We ignore the passed `reviewType` and use the one from our static context
    // to ensure the correct logic is always applied for this method.
    return _recordReviewInternal(
      VOCABULARY_CONTEXT,
      studentId,
      cardId,
      rating,
      sessionId
    );
  },

  /**
   * [INTERNAL] Asynchronously computes and saves optimal FSRS parameters for a student.
   * This is now a facade that calls the generic internal implementation.
   */
  async _optimizeParameters(
    payload: Prisma.JsonValue
  ): Promise<{ message: string; params?: any }> {
    return _optimizeParametersInternal(VOCABULARY_CONTEXT, payload);
  },

  /**
   * Assembles the initial review queue for a unified vocabulary session based on student
   * status and session configuration. Properly distinguishes between truly new cards
   * and relearning cards.
   * @param studentId The ID of the student.
   * @param config The configuration for this specific session.
   * @returns An object containing separate arrays for due and new card queue items.
   */
  async getInitialReviewQueue(
    studentId: string,
    config: VocabularyExerciseConfig
  ): Promise<{
    dueItems: StudentCardState[];
    newItems: StudentCardState[];
  }> {
    const now = new Date();
    const defaults = { newCards: 10, maxDue: 50, minDue: 10 };
    const finalConfig = { ...defaults, ...config };

    let dueCards = await prisma.studentCardState.findMany({
      where: {
        studentId,
        due: { lte: now },
        state: { not: 'NEW' },
        card: { deckId: finalConfig.deckId },
      },
      take: finalConfig.maxDue,
      orderBy: { due: 'asc' },
    });

    if (dueCards.length < finalConfig.minDue) {
      const needed = finalConfig.minDue - dueCards.length;
      const endOfDay = new Date();
      endOfDay.setHours(23, 59, 59, 999);

      const supplementalCards = await prisma.studentCardState.findMany({
        where: {
          studentId,
          due: { gt: now, lte: endOfDay },
          state: { not: 'NEW' },
          cardId: { notIn: dueCards.map((c) => c.cardId) },
          card: { deckId: finalConfig.deckId },
        },
        take: needed,
        orderBy: { due: 'asc' },
      });
      dueCards = [...dueCards, ...supplementalCards];
    }

    // Get truly NEW cards (never reviewed)
    const newCards = await prisma.studentCardState.findMany({
      where: {
        studentId,
        state: 'NEW',
        card: { deckId: finalConfig.deckId },
      },
      take: finalConfig.newCards,
      orderBy: { card: { createdAt: 'asc' } },
    });

    const dueItems: StudentCardState[] = dueCards;
    const newItems: StudentCardState[] = newCards;

    return { dueItems, newItems };
  },

  /**
   * Retrieves all vocabulary cards that are due for a student's review session.
   * This operation is status-aware.
   */
  async getDueCardsForStudent(
    studentId: string
  ): Promise<(StudentCardState & { card: VocabularyCard })[]> {
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      select: { status: true },
    });
    if (!student || student.status !== StudentStatus.ACTIVE) return [];

    return prisma.studentCardState.findMany({
      where: { studentId, due: { lte: new Date() } },
      include: { card: true },
      orderBy: { due: 'asc' },
    });
  },

  /**
   * Finds cards suitable for listening practice. This operation is status-aware.
   */
  async getListeningCandidates(studentId: string): Promise<VocabularyCard[]> {
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      select: { status: true },
    });
    if (!student || student.status !== StudentStatus.ACTIVE) return [];

    // This raw query is highly efficient for calculating retrievability on the fly.
    return prisma.$queryRaw<VocabularyCard[]>`
      SELECT vc.*
      FROM "VocabularyCard" vc
      JOIN "StudentCardState" scs ON vc.id = scs."cardId"
      WHERE scs."studentId" = ${studentId}::uuid
        AND scs.state = 'REVIEW'
        AND scs.stability > 0 -- Avoid division by zero
        AND (
          exp(-extract(epoch from (now() - scs."lastReview")) / (86400 * scs.stability)) > ${LISTENING_CANDIDATE_RETRIEVABILITY_THRESHOLD}
        )
      ORDER BY random()
      LIMIT 20;
    `;
  },

  /**
   * [LEGACY COMPATIBILITY] Helper function for mapping history to FSRS reviews.
   * This is now a facade that calls the generic internal implementation.
   */
  _mapHistoryToFsrsReviews(history: ReviewHistory[]): FSRSReview[] {
    return _mapHistoryToFsrsReviews(history);
  },

  /**
   * Retrieves aggregated FSRS statistics for a student.
   * This is a dedicated, performant query to power the analytics dashboard.
   * @param studentId The ID of the student.
   * @param teacherId The ID of the teacher, for authorization.
   * @returns An object containing various FSRS statistics.
   */
  async getFsrsStats(
    studentId: string,
    teacherId: string
  ): Promise<FsrsStats> {
    await authorizeTeacherForStudent(teacherId, studentId);

    const now = new Date();
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);
    const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const stateCountsQuery = prisma.studentCardState.groupBy({
      by: ['state'],
      where: { studentId },
      _count: {
        state: true,
      },
    });

    const dueTodayQuery = prisma.studentCardState.count({
      where: {
        studentId,
        due: { lte: endOfToday },
        state: { not: 'NEW' },
      },
    });

    const dueThisWeekQuery = prisma.studentCardState.count({
      where: {
        studentId,
        due: { lte: nextWeek },
        state: { not: 'NEW' },
      }
    });

    const overdueQuery = prisma.studentCardState.count({
      where: {
        studentId,
        due: { lt: now },
        state: { not: 'NEW' },
      }
    });

    const aggregateStatsQuery = prisma.studentCardState.aggregate({
      where: { studentId },
      _sum: {
        reps: true,
      },
      _avg: {
        retrievability: true,
        averageResponseTimeMs: true,
      },
      _count: {
        _all: true,
      },
    });

    const [stateCounts, dueToday, dueThisWeek, overdue, aggregateStats] = await prisma.$transaction([
      stateCountsQuery,
      dueTodayQuery,
      dueThisWeekQuery,
      overdueQuery,
      aggregateStatsQuery,
    ]);

    const statsMap = stateCounts.reduce((acc, record) => {
      acc[record.state] = record._count.state;
      return acc;
    }, {} as Record<CardState, number>);

    return {
      totalCards: aggregateStats._count._all,
      newCards: statsMap.NEW ?? 0,
      learningCards: statsMap.LEARNING ?? 0,
      reviewCards: statsMap.REVIEW ?? 0,
      relearningCards: statsMap.RELEARNING ?? 0,
      dueToday: dueToday,
      dueThisWeek: dueThisWeek,
      overdue: overdue,
      totalReviews: aggregateStats._sum.reps ?? 0,
      averageRetention: (aggregateStats._avg.retrievability ?? 0) * 100,
      averageResponseTime: aggregateStats._avg.averageResponseTimeMs ?? 0,
    };
  },

  async createRebuildCacheJob(
    studentId: string,
    teacherId: string
  ): Promise<Job> {
    await authorizeTeacherForStudent(teacherId, studentId);
    return JobService.createJob(teacherId, 'REBUILD_FSRS_CACHE', {
      studentId,
    });
  },

  /**
   * Creates a background job to optimize FSRS parameters for a student.
   *
   * @param studentId The UUID of the student.
   * @param teacherId The UUID of the teacher requesting the optimization.
   * @returns A promise that resolves to the created Job object.
   */
  async createOptimizeParametersJob(
    studentId: string,
    teacherId: string
  ): Promise<Job> {
    await authorizeTeacherForStudent(teacherId, studentId, {
      checkIsActive: true,
    });
    return JobService.createJob(teacherId, 'OPTIMIZE_FSRS_PARAMS', {
      studentId,
    });
  },

  /**
   * [PERFECTED IMPLEMENTATION WITH LEARNING STEPS]
   * The internal method for rebuilding the FSRS cache. It now correctly handles both
   * FSRS scheduling and learning steps, ensuring accurate reconstruction of card states.
   */
  async _rebuildCacheForStudent(
    payload: Prisma.JsonValue
  ): Promise<{ cardsRebuilt: number }> {
    const { studentId } = payload as { studentId: string };
    if (!studentId) {
      throw new Error('Invalid payload: studentId is required.');
    }

    const [studentDecks, studentParams] = await Promise.all([
      prisma.studentDeck.findMany({
        where: { studentId, isActive: true },
        include: { deck: { select: { cards: { select: { id: true } } } } },
      }),
      prisma.studentFsrsParams.findFirst({
        where: { studentId, isActive: true },
      }),
    ]);

    const allAssignedCardIds = new Set(
      studentDecks.flatMap((sd) => sd.deck.cards.map((c) => c.id))
    );

    // Get ALL history (learning steps + FSRS) for complete reconstruction
    const allHistory = await prisma.reviewHistory.findMany({
      where: { studentId },
      orderBy: { reviewedAt: 'asc' },
    });
    const historyByCard = allHistory.reduce((acc, review) => {
      if (!acc[review.cardId]) acc[review.cardId] = [];
      acc[review.cardId].push(review);
      return acc;
    }, {} as Record<string, ReviewHistory[]>);

    const w = (studentParams?.w as number[]) ?? FSRS_DEFAULT_PARAMETERS;
    const engine = new FSRS(w);

    const statesFromHistory: Prisma.StudentCardStateCreateManyInput[] = [];
    const reviewedCardIds = new Set<string>();

    for (const cardId in historyByCard) {
      reviewedCardIds.add(cardId);
      const cardHistory = historyByCard[cardId];
      const lastReview = cardHistory[cardHistory.length - 1];

      // Check if this card should still be in learning steps
      // Count only learning step reviews for VOCABULARY (not FSRS reviews)
      const learningSteps = DEFAULT_LEARNING_STEPS;
      const learningStepReviews = cardHistory.filter(h => h.isLearningStep && h.reviewType === 'VOCABULARY').length;
      const shouldBeInLearningSteps = learningStepReviews < learningSteps.length &&
        cardHistory.some(h => h.isLearningStep && h.reviewType === 'VOCABULARY'); // Has vocabulary learning step history

      if (shouldBeInLearningSteps) {
        // Reconstruct learning steps state
        let currentStepIndex = learningStepReviews - 1; // 0-based index of current step
        let dueDate: Date;

        if (lastReview.rating === 1 && lastReview.isLearningStep) {
          // If last rating was "Again" in learning steps, reset to first step
          currentStepIndex = 0;
        }

        // Calculate due date based on learning step
        if (currentStepIndex >= 0 && currentStepIndex < learningSteps.length) {
          const stepDuration = parseLearningStepDuration(learningSteps[currentStepIndex]);
          dueDate = new Date(lastReview.reviewedAt.getTime() + stepDuration);
        } else {
          // Should have graduated - treat as FSRS
          dueDate = new Date(); // Will be recalculated below
        }

        if (currentStepIndex >= 0 && currentStepIndex < learningSteps.length) {
          // Still in learning steps
          statesFromHistory.push({
            studentId,
            cardId,
            stability: 1.0, // Default stability for learning cards
            difficulty: 5.0, // Default difficulty for learning cards  
            due: dueDate,
            lastReview: lastReview.reviewedAt,
            reps: cardHistory.filter(h => !h.isLearningStep).length, // Only count FSRS reviews
            lapses: cardHistory.filter((h) => h.rating === 1).length,
            state: cardHistory.some(h => !h.isLearningStep) ? 'RELEARNING' : 'NEW', // NEW if never graduated, RELEARNING if failed
          });
          continue; // Skip FSRS calculation
        }
      }

      // Use FSRS calculation for graduated or non-learning cards
      // Only use VOCABULARY FSRS reviews (exclude learning step reviews)
      const fsrsOnlyHistory = cardHistory.filter(h => !h.isLearningStep && h.reviewType === 'VOCABULARY');
      const fsrsReviews = _mapHistoryToFsrsReviews(fsrsOnlyHistory);
      const fsrsItem = new FSRSItem(fsrsReviews);
      const finalMemoryState = engine.memoryState(fsrsItem);

      const nextStates = engine.nextStates(
        finalMemoryState,
        DEFAULT_DESIRED_RETENTION,
        0
      );
      let nextState;
      switch (lastReview.rating as FsrsRating) {
        case 1:
          nextState = nextStates.again;
          break;
        case 2:
          nextState = nextStates.hard;
          break;
        case 3:
          nextState = nextStates.good;
          break;
        case 4:
          nextState = nextStates.easy;
          break;
        default:
          throw new Error('Invalid rating in history');
      }

      const accurateDueDate = new Date(
        lastReview.reviewedAt.getTime() +
        nextState.interval * 24 * 60 * 60 * 1000
      );

      statesFromHistory.push({
        studentId,
        cardId,
        stability: finalMemoryState.stability,
        difficulty: finalMemoryState.difficulty,
        due: accurateDueDate,
        lastReview: lastReview.reviewedAt,
        reps: fsrsOnlyHistory.length, // Only count FSRS reviews for reps
        lapses: cardHistory.filter((h) => h.rating === 1).length,
        state: lastReview.rating === 1 ? 'RELEARNING' : 'REVIEW',
      });
    }

    const newCardIds = Array.from(allAssignedCardIds).filter(
      (id) => !reviewedCardIds.has(id as string)
    );
    const newCardStates: Prisma.StudentCardStateCreateManyInput[] =
      newCardIds.map((cardId) => ({
        studentId,
        cardId: cardId as string,
        state: 'NEW',
        due: new Date(),
        stability: 1.0,
        difficulty: 5.0,
        reps: 0,
        lapses: 0,
      }));

    const allStatesToCreate = [...statesFromHistory, ...newCardStates];

    await prisma.$transaction([
      prisma.studentCardState.deleteMany({ where: { studentId } }),
      prisma.studentCardState.createMany({ data: allStatesToCreate }),
    ]);

    return { cardsRebuilt: allStatesToCreate.length };
  },

  // ================================================================= //
  // LISTENING EXERCISE FSRS METHODS (Completely Separate System)
  // ================================================================= //

  /**
   * Smart word selection algorithm for listening exercises.
   * Filters words based on vocabulary confidence and listening readiness.
   */
  async getListeningCandidatesFromVocabulary(
    studentId: string,
    deckId: string,
    config: {
      maxCards?: number;
      vocabularyConfidenceThreshold?: number;
      listeningCandidateThreshold?: number;
    } = {}
  ): Promise<{
    candidates: VocabularyCard[];
    warnings?: {
      suboptimalCandidates: number;
      recommendedMaxCards: number;
    };
  }> {
    const {
      maxCards = 20,
      vocabularyConfidenceThreshold = 0.8, // High vocabulary confidence required
      listeningCandidateThreshold = 0.6,   // Threshold for listening readiness
    } = config;

    const student = await prisma.student.findUnique({
      where: { id: studentId },
      select: { status: true },
    });
    if (!student || student.status !== 'ACTIVE') {
      return { candidates: [] };
    }

    // Get all cards from the specified deck with their vocabulary and listening states
    const cardsWithStates = await prisma.$queryRaw<Array<{
      id: string;
      englishWord: string;
      chineseTranslation: string;
      pinyin: string | null;
      audioUrl: string | null;
      vocabularyRetrievability: number | null;
      vocabularyStability: number | null;
      listeningRetrievability: number | null;
      listeningStability: number | null;
      hasListeningState: boolean;
    }>>`
      SELECT 
        vc.id,
        vc."englishWord",
        vc."chineseTranslation",
        vc.pinyin,
        vc."audioUrl",
        CASE 
          WHEN scs.stability > 0 AND scs."lastReview" IS NOT NULL THEN
            exp(-extract(epoch from (now() - scs."lastReview")) / (86400 * scs.stability))
          ELSE NULL
        END as "vocabularyRetrievability",
        scs.stability as "vocabularyStability",
        CASE 
          WHEN lcs.stability > 0 AND lcs."lastReview" IS NOT NULL THEN
            exp(-extract(epoch from (now() - lcs."lastReview")) / (86400 * lcs.stability))
          ELSE NULL
        END as "listeningRetrievability",
        lcs.stability as "listeningStability",
        CASE WHEN lcs.id IS NOT NULL THEN true ELSE false END as "hasListeningState"
      FROM "VocabularyCard" vc
      LEFT JOIN "StudentCardState" scs ON vc.id = scs."cardId" AND scs."studentId" = ${studentId}::uuid
      LEFT JOIN "ListeningCardState" lcs ON vc.id = lcs."cardId" AND lcs."studentId" = ${studentId}::uuid
      WHERE vc."deckId" = ${deckId}::uuid
        AND vc."audioUrl" IS NOT NULL -- Must have audio for listening practice
        AND scs.id IS NOT NULL -- Must have learned this word vocabularily
        AND scs.state = 'REVIEW' -- Must be in review state (not learning)
    `;

    // Filter and sort candidates
    let candidates = cardsWithStates
      // Filter: Must have high vocabulary confidence
      .filter(card =>
        card.vocabularyRetrievability !== null &&
        card.vocabularyRetrievability >= vocabularyConfidenceThreshold
      )
      // Filter: Exclude cards already mastered for listening
      .filter(card =>
        !card.hasListeningState ||
        (card.listeningRetrievability !== null && card.listeningRetrievability < 0.9)
      )
      // Sort by vocabulary confidence (descending) - focus on best-known vocabulary
      .sort((a, b) => (b.vocabularyRetrievability || 0) - (a.vocabularyRetrievability || 0));

    // Analyze warnings for suboptimal candidates
    let warnings: { suboptimalCandidates: number; recommendedMaxCards: number } | undefined;

    if (candidates.length > 0) {
      const requestedCandidates = candidates.slice(0, maxCards);
      const suboptimalCount = requestedCandidates.filter(card =>
        !card.hasListeningState ||
        (card.listeningRetrievability !== null && card.listeningRetrievability < listeningCandidateThreshold)
      ).length;

      if (suboptimalCount > 0) {
        // Find optimal session size
        const optimalCandidates = candidates.filter(card =>
          card.hasListeningState &&
          card.listeningRetrievability !== null &&
          card.listeningRetrievability >= listeningCandidateThreshold
        );

        warnings = {
          suboptimalCandidates: suboptimalCount,
          recommendedMaxCards: Math.max(1, optimalCandidates.length)
        };
      }
    }

    // Convert to VocabularyCard format
    const finalCandidates: VocabularyCard[] = candidates.slice(0, maxCards).map(card => ({
      id: card.id,
      deckId,
      englishWord: card.englishWord,
      chineseTranslation: card.chineseTranslation,
      pinyin: card.pinyin,
      ipaPronunciation: null,
      exampleSentences: null,
      wordType: null,
      difficultyLevel: 1,
      audioUrl: card.audioUrl,
      imageUrl: null,
      videoUrl: null,
      frequencyRank: null,
      tags: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    return {
      candidates: finalCandidates,
      warnings
    };
  },

  /**
   * Gets vocabulary cards suitable for fill-in-blank exercises based on vocabulary confidence.
   * 
   * Fill-in-blank exercises require high vocabulary confidence (≥0.8 retrievability) and
   * exclude cards that have already been marked as "seen" in fill-in-blank exercises.
   * 
   * Unlike listening exercises, fill-in-blank cards are not tracked via FSRS - they're simply
   * marked as "seen" once completed and never shown again to that student.
   */
  async getFillInBlankCandidatesFromVocabulary(
    studentId: string,
    deckId: string,
    config: {
      maxCards?: number;
      vocabularyConfidenceThreshold?: number;
    } = {}
  ): Promise<{
    candidates: VocabularyCard[];
    warnings?: {
      suboptimalCandidates: number;
      recommendedMaxCards: number;
    };
  }> {
    const {
      maxCards = 20,
      vocabularyConfidenceThreshold = 0.8, // High vocabulary confidence required
    } = config;

    const student = await prisma.student.findUnique({
      where: { id: studentId },
      select: { status: true },
    });
    if (!student || student.status !== 'ACTIVE') {
      return { candidates: [] };
    }

    // Get all cards from the specified deck with their vocabulary states and fill-in-blank completion status
    const cardsWithStates = await prisma.$queryRaw<Array<{
      id: string;
      englishWord: string;
      chineseTranslation: string;
      pinyin: string | null;
      audioUrl: string | null;
      vocabularyRetrievability: number | null;
      vocabularyStability: number | null;
      hasBeenSeen: boolean;
    }>>`
      SELECT 
        vc.id,
        vc."englishWord",
        vc."chineseTranslation",
        vc.pinyin,
        vc."audioUrl",
        CASE 
          WHEN scs.stability > 0 AND scs."lastReview" IS NOT NULL THEN
            exp(-extract(epoch from (now() - scs."lastReview")) / (86400 * scs.stability))
          ELSE NULL
        END as "vocabularyRetrievability",
        scs.stability as "vocabularyStability",
        CASE WHEN fcs.id IS NOT NULL AND fcs."isSeen" = true THEN true ELSE false END as "hasBeenSeen"
      FROM "VocabularyCard" vc
      LEFT JOIN "StudentCardState" scs ON vc.id = scs."cardId" AND scs."studentId" = ${studentId}::uuid
      LEFT JOIN "FillInBlankCardState" fcs ON vc.id = fcs."cardId" AND fcs."studentId" = ${studentId}::uuid
      WHERE vc."deckId" = ${deckId}::uuid
        AND vc."englishWord" IS NOT NULL -- Must have English word for fill-in-blank
        AND vc."chineseTranslation" IS NOT NULL -- Must have Chinese translation to show as prompt
        AND scs.id IS NOT NULL -- Must have learned this word vocabularily
        AND scs.state = 'REVIEW' -- Must be in review state (not learning)
    `;

    // Filter and sort candidates
    let candidates = cardsWithStates
      // Filter: Must have high vocabulary confidence
      .filter(card =>
        card.vocabularyRetrievability !== null &&
        card.vocabularyRetrievability >= vocabularyConfidenceThreshold
      )
      // Filter: Exclude cards already marked as "seen" in fill-in-blank exercises
      .filter(card => !card.hasBeenSeen)
      // Sort by vocabulary confidence (descending) - focus on best-known vocabulary
      .sort((a, b) => (b.vocabularyRetrievability || 0) - (a.vocabularyRetrievability || 0));

    // Analyze warnings for suboptimal candidates (optional for fill-in-blank)
    let warnings: { suboptimalCandidates: number; recommendedMaxCards: number } | undefined;

    if (candidates.length > 0) {
      const requestedCandidates = candidates.slice(0, maxCards);
      
      // For fill-in-blank, we might warn if vocabulary confidence is below optimal
      const suboptimalCount = requestedCandidates.filter(card =>
        card.vocabularyRetrievability !== null && 
        card.vocabularyRetrievability < 0.9 // Very high confidence preferred
      ).length;

      if (suboptimalCount > 0) {
        // Find optimal session size with very high confidence cards
        const optimalCandidates = candidates.filter(card =>
          card.vocabularyRetrievability !== null &&
          card.vocabularyRetrievability >= 0.9
        );

        warnings = {
          suboptimalCandidates: suboptimalCount,
          recommendedMaxCards: Math.max(1, optimalCandidates.length)
        };
      }
    }

    // Convert to VocabularyCard format
    const finalCandidates: VocabularyCard[] = candidates.slice(0, maxCards).map(card => ({
      id: card.id,
      deckId,
      englishWord: card.englishWord,
      chineseTranslation: card.chineseTranslation,
      pinyin: card.pinyin,
      ipaPronunciation: null,
      exampleSentences: null,
      wordType: null,
      difficultyLevel: 1,
      audioUrl: card.audioUrl,
      imageUrl: null,
      videoUrl: null,
      frequencyRank: null,
      tags: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    return {
      candidates: finalCandidates,
      warnings
    };
  },

  /**
   * Get the initial listening review queue for a session.
   * Similar to vocabulary but uses ListeningCardState.
   */
  async getListeningReviewQueue(
    studentId: string,
    deckId: string,
    config: {
      newCards?: number;
      maxDue?: number;
      minDue?: number;
      vocabularyConfidenceThreshold?: number;
      listeningCandidateThreshold?: number;
    } = {}
  ): Promise<{
    dueItems: Array<any>;
    newItems: Array<any>;
    warnings?: {
      suboptimalCandidates: number;
      recommendedMaxCards: number;
    };
  }> {
    const {
      newCards = 10,
      maxDue = 20,
      minDue = 0,
      vocabularyConfidenceThreshold = 0.8,
      listeningCandidateThreshold = 0.6,
    } = config;

    const now = new Date();

    // Get due listening cards
    const dueItems = await prisma.listeningCardState.findMany({
      where: {
        studentId,
        due: { lte: now },
        card: { deckId }
      },
      include: { card: true },
      orderBy: { due: 'asc' },
      take: Math.max(maxDue, minDue),
    });

    // For new cards, use the smart candidate selection
    const { candidates, warnings } = await this.getListeningCandidatesFromVocabulary(
      studentId,
      deckId,
      {
        maxCards: newCards,
        vocabularyConfidenceThreshold,
        listeningCandidateThreshold,
      }
    );

    // Convert candidates to new listening card states
    const newItems = await Promise.all(
      candidates.map(async (card) => {
        // Check if listening state already exists
        const existingState = await prisma.listeningCardState.findUnique({
          where: {
            studentId_cardId: { studentId, cardId: card.id }
          }
        });

        if (existingState) {
          return existingState;
        }

        // Create new listening card state
        return prisma.listeningCardState.create({
          data: {
            studentId,
            cardId: card.id,
            stability: 1.0,
            difficulty: 5.0,
            due: now,
            state: 'NEW',
          },
          include: { card: true }
        });
      })
    );

    return {
      dueItems: dueItems.slice(minDue),
      newItems,
      warnings
    };
  },

  /**
   * Record a listening review (completely separate from vocabulary reviews).
   * This is now a facade that calls the generic internal implementation.
   */
  async recordListeningReview(
    studentId: string,
    cardId: string,
    rating: FsrsRating,
    sessionId?: string
  ): Promise<any> {
    return _recordReviewInternal(
      LISTENING_CONTEXT,
      studentId,
      cardId,
      rating,
      sessionId
    );
  },

  /**
   * Get listening-specific FSRS statistics.
   */
  async getListeningStats(studentId: string): Promise<any> {
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      select: { status: true },
    });
    if (!student || student.status !== 'ACTIVE') return null;

    const stats = await prisma.$queryRaw<Array<{
      totalCards: bigint;
      newCards: bigint;
      learningCards: bigint;
      reviewCards: bigint;
      relearningCards: bigint;
      dueToday: bigint;
      dueThisWeek: bigint;
      overdue: bigint;
      totalReviews: bigint;
      averageRetention: number | null;
      averageResponseTime: number | null;
    }>>`
      SELECT
        COUNT(*) as "totalCards",
        COUNT(CASE WHEN state = 'NEW' THEN 1 END) as "newCards",
        COUNT(CASE WHEN state = 'LEARNING' THEN 1 END) as "learningCards",
        COUNT(CASE WHEN state = 'REVIEW' THEN 1 END) as "reviewCards",
        COUNT(CASE WHEN state = 'RELEARNING' THEN 1 END) as "relearningCards",
        COUNT(CASE WHEN due <= CURRENT_DATE THEN 1 END) as "dueToday",
        COUNT(CASE WHEN due <= CURRENT_DATE + INTERVAL '7 days' THEN 1 END) as "dueThisWeek",
        COUNT(CASE WHEN due < CURRENT_DATE THEN 1 END) as "overdue",
        (SELECT COUNT(*) FROM "ReviewHistory" WHERE "studentId" = ${studentId}::uuid AND "reviewType" = 'LISTENING') as "totalReviews",
        AVG(CASE WHEN stability > 0 THEN stability END) as "averageRetention",
        AVG("averageResponseTimeMs") as "averageResponseTime"
      FROM "ListeningCardState"
      WHERE "studentId" = ${studentId}::uuid
    `;

    const result = stats[0];
    return {
      totalCards: Number(result.totalCards),
      newCards: Number(result.newCards),
      learningCards: Number(result.learningCards),
      reviewCards: Number(result.reviewCards),
      relearningCards: Number(result.relearningCards),
      dueToday: Number(result.dueToday),
      dueThisWeek: Number(result.dueThisWeek),
      overdue: Number(result.overdue),
      totalReviews: Number(result.totalReviews),
      averageRetention: result.averageRetention || 0,
      averageResponseTime: result.averageResponseTime || 0,
    };
  },

  /**
   * Create job for optimizing listening FSRS parameters.
   */
  async createOptimizeListeningParametersJob(studentId: string): Promise<any> {
    const teacherId = await prisma.student.findUnique({
      where: { id: studentId },
      select: { teacherId: true }
    });

    if (!teacherId) {
      throw new Error('Student not found');
    }

    return JobService.createJob(
      teacherId.teacherId,
      'OPTIMIZE_LISTENING_FSRS_PARAMS',
      { studentId }
    );
  },

  /**
   * Internal: Optimize listening FSRS parameters (called by worker).
   * This is now a facade that calls the generic internal implementation.
   */
  async _optimizeListeningParameters(
    payload: Prisma.JsonValue
  ): Promise<{ message: string; params?: any }> {
    return _optimizeParametersInternal(LISTENING_CONTEXT, payload);
  },

  /**
   * Create job for rebuilding listening FSRS cache.
   */
  async createRebuildListeningCacheJob(studentId: string): Promise<any> {
    const teacherId = await prisma.student.findUnique({
      where: { id: studentId },
      select: { teacherId: true }
    });

    if (!teacherId) {
      throw new Error('Student not found');
    }

    return JobService.createJob(
      teacherId.teacherId,
      'REBUILD_LISTENING_FSRS_CACHE',
      { studentId }
    );
  },

  /**
   * Internal: Rebuild listening FSRS cache from review history (called by worker).
   */
  async _rebuildListeningCacheForStudent(
    payload: Prisma.JsonValue
  ): Promise<{ cardsRebuilt: number }> {
    const { studentId } = RebuildCachePayloadSchema.parse(payload);
    const listeningReviews = await prisma.reviewHistory.findMany({
      where: {
        studentId,
        reviewType: 'LISTENING',
      },
      orderBy: [{ cardId: 'asc' }, { reviewedAt: 'asc' }],
    });

    const cardStateMap = new Map<string, any>();

    // Process listening reviews chronologically per card
    for (const review of listeningReviews) {
      if (!cardStateMap.has(review.cardId)) {
        cardStateMap.set(review.cardId, {
          studentId,
          cardId: review.cardId,
          stability: 1.0,
          difficulty: 5.0,
          due: new Date(),
          lastReview: null,
          reps: 0,
          lapses: 0,
          state: 'NEW',
          averageResponseTimeMs: 0,
          consecutiveCorrect: 0,
          retrievability: null,
          intervalDays: null,
          createdAt: review.reviewedAt,
          updatedAt: review.reviewedAt,
        });
      }

      if (!review.isLearningStep) {
        const state = cardStateMap.get(review.cardId);
        state.reps += 1;
        if (review.rating === 1) state.lapses += 1;
        state.lastReview = review.reviewedAt;
        state.updatedAt = review.reviewedAt;
        // FSRS calculations would be applied here in a real implementation
      }
    }

    const statesFromHistory = Array.from(cardStateMap.values());

    // Get all vocabulary cards that might need listening states but don't have history
    const allCards = await prisma.vocabularyCard.findMany({
      where: {
        audioUrl: { not: null },
        deck: {
          studentDecks: {
            some: { studentId }
          }
        }
      },
      select: { id: true }
    });

    const cardsWithHistory = new Set(statesFromHistory.map(s => s.cardId));
    const newCardStates = allCards
      .filter(card => !cardsWithHistory.has(card.id))
      .map(card => ({
        studentId,
        cardId: card.id,
        stability: 1.0,
        difficulty: 5.0,
        due: new Date(),
        lastReview: null,
        reps: 0,
        lapses: 0,
        state: 'NEW',
        averageResponseTimeMs: 0,
        consecutiveCorrect: 0,
        retrievability: null,
        intervalDays: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }));

    const allStatesToCreate = [...statesFromHistory, ...newCardStates];

    await prisma.$transaction([
      prisma.listeningCardState.deleteMany({ where: { studentId } }),
      prisma.listeningCardState.createMany({ data: allStatesToCreate }),
    ]);

    return { cardsRebuilt: allStatesToCreate.length };
  },
};
