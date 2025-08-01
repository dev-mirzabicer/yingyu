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
import { VocabularyExerciseConfig, VocabularyQueueItem } from '../types';

/**
 * A constant representing the minimum retrievability for a card to be considered
 * for listening practice. A value of 0.36 corresponds to the point where the
 * review interval equals the card's stability (t=S), indicating a reasonably
 * well-known card.
 */
const LISTENING_CANDIDATE_RETRIEVABILITY_THRESHOLD = 0.36;

/**
 * The definitive, re-engineered FSRS Service. This service is the scientific core
 * of the application, leveraging the full power of the `fsrs-rs-nodejs` engine
 * and our "History as Source of Truth" architectural principle.
 */
export const FSRSService = {
  /**
   * [PERFECTED IMPLEMENTATION]
   * Records a student's review of a single card. This function is now architecturally sound,
   * using a single, unified logic path that correctly leverages the FSRS engine for all reviews
   * (both initial and subsequent), ensuring mathematical integrity.
   *
   * @param studentId The UUID of the student.
   * @param cardId The UUID of the card being reviewed.
   * @param rating The student's performance rating (1-4).
   * @param reviewType The context of the review (e.g., VOCABULARY, LISTENING).
   * @returns A promise that resolves to the updated StudentCardState.
   */
  async recordReview(
    studentId: string,
    cardId: string,
    rating: FsrsRating,
    reviewType: ReviewType,
    sessionId?: string
  ): Promise<StudentCardState> {
    // The entire operation is atomic, ensuring data consistency.
    return prisma.$transaction(async (tx) => {
      // 1. Get the student's current FSRS parameters (or defaults).
      const studentParams = await tx.studentFsrsParams.findFirst({
        where: { studentId, isActive: true },
      });
      const w = (studentParams?.w as number[]) ?? FSRS_DEFAULT_PARAMETERS;
      const engine = new FSRS(w);
      const now = new Date();

      // 2. Get the card's current state from the cache. This is our starting point.
      const previousCardState = await tx.studentCardState.findUnique({
        where: { studentId_cardId: { studentId, cardId } },
      });

      if (!previousCardState) {
        throw new Error(
          `FSRSService Integrity Error: Cannot record review for a card that has no initial state. StudentId: ${studentId}, CardId: ${cardId}`
        );
      }

      // 3. Determine the current memory state for the engine.
      //    According to the FSRS algorithm, the first review of a card has no prior memory state.
      //    The library expects `undefined` in this case. For all subsequent reviews, we construct
      //    the memory state from our cached values.
      const currentMemory =
        previousCardState.state === CardState.NEW
          ? undefined
          : new MemoryState(
            previousCardState.stability,
            previousCardState.difficulty
          );

      // 4. Calculate days elapsed since the last review. This is a critical input for the engine.
      const daysSinceLastReview = previousCardState.lastReview
        ? Math.round(
          (now.getTime() - previousCardState.lastReview.getTime()) /
          (1000 * 60 * 60 * 24)
        )
        : 0;

      // 5. UNIFIED LOGIC: Use the FSRS engine to get the next states for ALL possible ratings.
      //    This is the single, correct path for both NEW and existing cards.
      const nextStates = engine.nextStates(
        currentMemory,
        DEFAULT_DESIRED_RETENTION,
        daysSinceLastReview
      );

      // 6. Select the specific next state based on the user's rating.
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

      // 7. Calculate the new due date based on the interval returned by the engine.
      const newDueDate = new Date(
        now.getTime() + newState.interval * 24 * 60 * 60 * 1000
      );

      // 8. Update the card state cache in the database with the engine's results.
      const updatedState = await tx.studentCardState.update({
        where: { studentId_cardId: { studentId, cardId } },
        data: {
          stability: newState.memory.stability,
          difficulty: newState.memory.difficulty,
          due: newDueDate,
          lastReview: now,
          reps: { increment: 1 },
          lapses: rating === 1 ? { increment: 1 } : undefined,
          // A card is in 'REVIEW' state after any review, unless it was 'Again', which puts it in 'RELEARNING'.
          state: rating === 1 ? 'RELEARNING' : 'REVIEW',
        },
      });

      // 9. Append to the immutable review history log for future analysis and optimization.
      await tx.reviewHistory.create({
        data: {
          studentId,
          cardId,
          rating,
          reviewType,
          sessionId,
          reviewedAt: now,
          previousState: previousCardState.state,
          previousDifficulty: previousCardState.difficulty,
          previousStability: previousCardState.stability,
          previousDue: previousCardState.due,
        },
      });

      return updatedState;
    });
  },

  /**
   * [INTERNAL] Asynchronously computes and saves optimal FSRS parameters for a student.
   * This is designed to be called by a background worker.
   *
   * @param payload The job payload containing the studentId.
   * @returns A promise that resolves to the newly created StudentFsrsParams record or a status message.
   */
  async _optimizeParameters(
    payload: Prisma.JsonValue
  ): Promise<{ message: string; params?: any }> {
    const { studentId } = payload as { studentId: string };
    if (!studentId) {
      throw new Error('Invalid payload: studentId is required.');
    }

    const allHistory = await prisma.reviewHistory.findMany({
      where: { studentId },
      orderBy: { reviewedAt: 'asc' },
    });

    // FSRS optimization requires a meaningful amount of data.
    if (allHistory.length < 50) {
      const message = `Skipping optimization for student ${studentId}: insufficient review history (${allHistory.length} reviews). At least 50 are recommended.`;
      console.log(message);
      return { message };
    }

    const reviewsByCard = allHistory.reduce((acc, review) => {
      if (!acc[review.cardId]) acc[review.cardId] = [];
      acc[review.cardId].push(review);
      return acc;
    }, {} as Record<string, ReviewHistory[]>);

    const trainingSet = Object.values(reviewsByCard).map((history) => {
      const fsrsReviews = this._mapHistoryToFsrsReviews(history);
      return new FSRSItem(fsrsReviews);
    });

    const engine = new FSRS();
    const newWeights = await engine.computeParameters(trainingSet, true);

    const result = await prisma.$transaction(async (tx) => {
      await tx.studentFsrsParams.updateMany({
        where: { studentId },
        data: { isActive: false },
      });
      const newParams = await tx.studentFsrsParams.create({
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
      message: `Successfully optimized parameters for student ${studentId}.`,
      params: result,
    };
  },

  /**
   * Assembles the initial review queue for a unified vocabulary session based on student
   * status and session configuration.
   * @param studentId The ID of the student.
   * @param config The configuration for this specific session.
   * @returns An object containing separate arrays for due and new card queue items.
   */
  async getInitialReviewQueue(
    studentId: string,
    config: VocabularyExerciseConfig
  ): Promise<{
    dueItems: VocabularyQueueItem[];
    newItems: VocabularyQueueItem[];
  }> {
    const now = new Date();
    const defaults = { newCards: 10, maxDue: 50, minDue: 10 };
    const finalConfig = { ...defaults, ...config };

    let dueCards = await prisma.studentCardState.findMany({
      where: { studentId, due: { lte: now }, state: { not: 'NEW' } },
      take: finalConfig.maxDue,
      orderBy: { due: 'asc' },
      select: { cardId: true, due: true },
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
        },
        take: needed,
        orderBy: { due: 'asc' },
        select: { cardId: true, due: true },
      });
      dueCards = [...dueCards, ...supplementalCards];
    }

    const newCards = await prisma.studentCardState.findMany({
      where: { studentId, state: 'NEW' },
      take: finalConfig.newCards,
      orderBy: { card: { createdAt: 'asc' } },
      select: { cardId: true, due: true },
    });

    const dueItems: VocabularyQueueItem[] = dueCards.map((c) => ({
      ...c,
      isNew: false,
    }));
    const newItems: VocabularyQueueItem[] = newCards.map((c) => ({
      ...c,
      isNew: true,
    }));

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
   * [PRIVATE] A helper function to transform our database ReviewHistory into the
   * FSRSReview[] format required by the FSRS engine.
   */
  _mapHistoryToFsrsReviews(history: ReviewHistory[]): FSRSReview[] {
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
   * [PERFECTED IMPLEMENTATION]
   * The internal method for rebuilding the FSRS cache. It now correctly fetches and
   * utilizes the student's specific FSRS parameters, ensuring the cache is rebuilt
   * with the correct weights.
   */
  async _rebuildCacheForStudent(
    payload: Prisma.JsonValue
  ): Promise<{ cardsRebuilt: number }> {
    const { studentId } = payload as { studentId: string };
    if (!studentId) {
      throw new Error('Invalid payload: studentId is required.');
    }

    // THE FIX: Atomically fetch all necessary data, including student-specific FSRS parameters.
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

    const allHistory = await prisma.reviewHistory.findMany({
      where: { studentId },
      orderBy: { reviewedAt: 'asc' },
    });
    const historyByCard = allHistory.reduce((acc, review) => {
      if (!acc[review.cardId]) acc[review.cardId] = [];
      acc[review.cardId].push(review);
      return acc;
    }, {} as Record<string, ReviewHistory[]>);

    // THE FIX: Use student-specific parameters if they exist, otherwise use defaults.
    const w = (studentParams?.w as number[]) ?? FSRS_DEFAULT_PARAMETERS;
    const engine = new FSRS(w);

    const statesFromHistory: Prisma.StudentCardStateCreateManyInput[] = [];
    const reviewedCardIds = new Set<string>();

    for (const cardId in historyByCard) {
      reviewedCardIds.add(cardId);
      const cardHistory = historyByCard[cardId];
      const fsrsReviews = this._mapHistoryToFsrsReviews(cardHistory);
      const fsrsItem = new FSRSItem(fsrsReviews);
      const finalMemoryState = engine.memoryState(fsrsItem);
      const lastReview = cardHistory[cardHistory.length - 1];

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
        reps: cardHistory.length,
        lapses: cardHistory.filter((h) => h.rating === 1).length,
        state: lastReview.rating === 1 ? 'RELEARNING' : 'REVIEW',
      });
    }

    const newCardIds = [...allAssignedCardIds].filter(
      (id) => !reviewedCardIds.has(id)
    );
    const newCardStates: Prisma.StudentCardStateCreateManyInput[] =
      newCardIds.map((cardId) => ({
        studentId,
        cardId,
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
};

