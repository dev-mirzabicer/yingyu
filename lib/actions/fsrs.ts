import { prisma } from '@/lib/db';
import {
  FSRS,
  FSRSItem,
  FSRSReview,
  FsrsRating,
  FSRS_DEFAULT_PARAMETERS,
  DEFAULT_DESIRED_RETENTION,
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
   * Records a student's review of a single card. This is the most critical function
   * in the service. It recalculates the card's entire FSRS state from its history,
   * determines the next state, updates the cache (`StudentCardState`), and appends
   * the new review to the immutable history log, all within a single atomic transaction.
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
    reviewType: ReviewType // The new, required parameter.
  ): Promise<StudentCardState> {
    return prisma.$transaction(async (tx) => {
      // 1. Fetch all necessary data in parallel for maximum efficiency.
      const [studentParams, reviewHistory, previousCardState] =
        await Promise.all([
          tx.studentFsrsParams.findFirst({
            where: { studentId, isActive: true },
          }),
          tx.reviewHistory.findMany({
            where: { studentId, cardId },
            orderBy: { reviewedAt: 'asc' },
          }),
          tx.studentCardState.findUnique({
            where: { studentId_cardId: { studentId, cardId } },
          }),
        ]);

      // 2. Meticulous Validation.
      if (!previousCardState) {
        throw new Error(
          `FSRSService Integrity Error: Cannot record review for a card that has no initial state. StudentId: ${studentId}, CardId: ${cardId}`
        );
      }

      // 3. Instantiate the FSRS engine.
      const engine = new FSRS(
        (studentParams?.w as number[]) ?? FSRS_DEFAULT_PARAMETERS
      );

      // 4. Transform history into FSRSItem.
      const fsrsReviews = this._mapHistoryToFsrsReviews(reviewHistory);
      const fsrsItem = new FSRSItem(fsrsReviews);

      // 5. Calculate the card's state from its complete history.
      const stateBeforeReview = engine.memoryState(fsrsItem);

      // 6. Calculate days elapsed and the next possible states.
      const now = new Date();
      const daysSinceLastReview = previousCardState.lastReview
        ? Math.round(
            (now.getTime() - previousCardState.lastReview.getTime()) /
              (1000 * 60 * 60 * 24)
          )
        : 0;
      const nextStates = engine.nextStates(
        stateBeforeReview,
        DEFAULT_DESIRED_RETENTION,
        daysSinceLastReview
      );

      // 7. Select the new state based on the user's rating.
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

      // 8. Determine the new due date and the correct FSRS state machine value.
      const newDueDate = new Date(
        now.getTime() + newState.interval * 24 * 60 * 60 * 1000
      );
      const newCardStateValue: CardState =
        rating === 1 ? 'RELEARNING' : 'REVIEW';

      // 9. Update the cache table (`StudentCardState`).
      const updatedState = await tx.studentCardState.update({
        where: { studentId_cardId: { studentId, cardId } },
        data: {
          stability: newState.memory.stability,
          difficulty: newState.memory.difficulty,
          due: newDueDate,
          lastReview: now,
          reps: { increment: 1 },
          state: newCardStateValue,
        },
      });

      // 10. Append the new review to the immutable history log with the correct type.
      await tx.reviewHistory.create({
        data: {
          studentId,
          cardId,
          rating,
          reviewType, // The fix is applied here.
          reviewedAt: now,
          previousState: previousCardState.state,
          previousDifficulty: stateBeforeReview.difficulty,
          previousStability: stateBeforeReview.stability,
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
   * @param studentId The UUID of the student to optimize.
   * @returns A promise that resolves to the newly created StudentFsrsParams record.
   */
  async _optimizeParameters(studentId: string) {
    const allHistory = await prisma.reviewHistory.findMany({
      where: { studentId },
      orderBy: { reviewedAt: 'asc' },
    });

    if (allHistory.length < 100) {
      console.log(
        `Skipping optimization for student ${studentId}: insufficient review history.`
      );
      return null;
    }

    const reviewsByCard = allHistory.reduce((acc, review) => {
      if (!acc[review.cardId]) {
        acc[review.cardId] = [];
      }
      acc[review.cardId].push(review);
      return acc;
    }, {} as Record<string, ReviewHistory[]>);

    const trainingSet = Object.values(reviewsByCard).map((history) => {
      const fsrsReviews = this._mapHistoryToFsrsReviews(history);
      return new FSRSItem(fsrsReviews);
    });

    const engine = new FSRS();
    const newWeights = await engine.computeParameters(trainingSet, true);

    return prisma.$transaction(async (tx) => {
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
        },
      });
      return newParams;
    });
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

    return prisma.$queryRaw<VocabularyCard[]>`
      SELECT vc.*
      FROM "VocabularyCard" vc
      JOIN "StudentCardState" scs ON vc.id = scs."cardId"
      WHERE scs."studentId" = ${studentId}::uuid
        AND scs.state = 'REVIEW'
        AND (
          exp(-1.0 / scs.stability) > ${LISTENING_CANDIDATE_RETRIEVABILITY_THRESHOLD}
          OR
          scs.due > NOW() + INTERVAL '30 days'
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
   * REFINEMENT: The new, bulletproof internal method for rebuilding the FSRS cache.
   */
  async _rebuildCacheForStudent(
    payload: Prisma.JsonValue
  ): Promise<{ cardsRebuilt: number }> {
    const { studentId } = payload as { studentId: string };
    if (!studentId) {
      throw new Error('Invalid payload: studentId is required.');
    }

    // 1. Get ALL assigned card IDs for the student. This is the master list.
    const studentDecks = await prisma.studentDeck.findMany({
      where: { studentId, isActive: true },
      include: { deck: { select: { cards: { select: { id: true } } } } },
    });
    const allAssignedCardIds = new Set(
      studentDecks.flatMap((sd) => sd.deck.cards.map((c) => c.id))
    );

    // 2. Fetch and process history as planned.
    const allHistory = await prisma.reviewHistory.findMany({
      where: { studentId },
      orderBy: { reviewedAt: 'asc' },
    });
    const historyByCard = allHistory.reduce((acc, review) => {
      if (!acc[review.cardId]) acc[review.cardId] = [];
      acc[review.cardId].push(review);
      return acc;
    }, {} as Record<string, ReviewHistory[]>);

    const engine = new FSRS(FSRS_DEFAULT_PARAMETERS);
    const statesFromHistory: Prisma.StudentCardStateCreateManyInput[] = [];
    const reviewedCardIds = new Set<string>();

    // 3. For states from history, calculate a more accurate due date.
    for (const cardId in historyByCard) {
      reviewedCardIds.add(cardId);
      const cardHistory = historyByCard[cardId];
      const fsrsReviews = this._mapHistoryToFsrsReviews(cardHistory);
      const fsrsItem = new FSRSItem(fsrsReviews);
      const finalMemoryState = engine.memoryState(fsrsItem);
      const lastReview = cardHistory[cardHistory.length - 1];

      // Simulate the next step to get the correct interval.
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

    // 4. The crucial addition: Identify and create states for 'NEW' cards.
    const newCardIds = [...allAssignedCardIds].filter(
      (id) => !reviewedCardIds.has(id)
    );
    const newCardStates: Prisma.StudentCardStateCreateManyInput[] =
      newCardIds.map((cardId) => ({
        studentId,
        cardId,
        state: 'NEW',
        due: new Date(),
        stability: 1.0, // Default initial values
        difficulty: 5.0, // Default initial values
        reps: 0,
        lapses: 0,
      }));

    // 5. Combine the two lists.
    const allStatesToCreate = [...statesFromHistory, ...newCardStates];

    // 6. Perform the atomic delete and createMany as planned.
    await prisma.$transaction([
      prisma.studentCardState.deleteMany({ where: { studentId } }),
      prisma.studentCardState.createMany({ data: allStatesToCreate }),
    ]);

    return { cardsRebuilt: allStatesToCreate.length };
  },
};
