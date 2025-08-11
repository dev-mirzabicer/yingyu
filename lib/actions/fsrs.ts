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

/**
 * The definitive, re-engineered FSRS Service. This service is the scientific core
 * of the application, leveraging the full power of the `fsrs-rs-nodejs` engine
 * and our "History as Source of Truth" architectural principle.
 */
export const FSRSService = {
  /**
   * Determines if a card should use learning steps instead of FSRS scheduling.
   * FSRS-compliant logic: NEW or RELEARNING cards that haven't completed learning steps.
   * 
   * @param studentId The student's UUID
   * @param cardId The card's UUID  
   * @param learningSteps The configured learning steps array
   * @param tx Optional transaction client
   * @returns Promise<boolean> - true if learning steps should be used
   */
  async _shouldUseLearningSteps(
    studentId: string,
    cardId: string,
    learningSteps: string[],
    tx?: any
  ): Promise<boolean> {
    const client = tx || prisma;
    
    // Get current card state
    const cardState = await client.studentCardState.findUnique({
      where: { studentId_cardId: { studentId, cardId } },
      select: { state: true }
    });
    
    // Only NEW or RELEARNING cards use learning steps
    if (!cardState || (cardState.state !== 'NEW' && cardState.state !== 'RELEARNING')) {
      return false;
    }
    
    // Count learning step reviews (not FSRS reviews)
    const learningStepReviews = await client.reviewHistory.count({
      where: { 
        studentId, 
        cardId, 
        isLearningStep: true 
      }
    });
    
    // Use learning steps if we haven't completed all steps yet
    return learningStepReviews < learningSteps.length;
  },

  /**
   * Implements the simple Anki-like learning steps logic:
   * - If rating != "Again": advance to next step or graduate
   * - If rating == "Again": reset to step 0
   * 
   * @param studentId The student's UUID
   * @param cardId The card's UUID
   * @param rating The submitted rating (1-4)
   * @param learningSteps The configured learning steps array
   * @param tx Optional transaction client
   * @returns Promise<{shouldGraduate: boolean, newDueDate: Date}> - graduation flag and due date
   */
  async _calculateLearningStepsDue(
    studentId: string,
    cardId: string,
    rating: FsrsRating,
    learningSteps: string[],
    tx?: any
  ): Promise<{ shouldGraduate: boolean; newDueDate: Date }> {
    const client = tx || prisma;
    const now = new Date();

    // If the user rates a card as "Easy", graduate it immediately.
    if (rating === 4) {
      return {
        shouldGraduate: true,
        newDueDate: now
      };
    }

    const currentStepReviews = await client.reviewHistory.count({
      where: { 
        studentId, 
        cardId, 
        isLearningStep: true 
      }
    });
    
    if (rating === 1) {
      // "Again" rating: reset to step 0
      const firstStepDuration = parseLearningStepDuration(learningSteps[0]);
      return {
        shouldGraduate: false,
        newDueDate: new Date(now.getTime() + firstStepDuration)
      };
    }
    
    // Rating is 2 (Hard) or 3 (Good): advance to next step
    const nextStep = currentStepReviews + 1;
    
    if (nextStep >= learningSteps.length) {
      return {
        shouldGraduate: true,
        newDueDate: now
      };
    }
    
    const nextStepDuration = parseLearningStepDuration(learningSteps[nextStep]);
    return {
      shouldGraduate: false,
      newDueDate: new Date(now.getTime() + nextStepDuration)
    };
  },
  /**
   * [PERFECTED IMPLEMENTATION WITH SIMPLE LEARNING STEPS]
   * Records a student's review with Anki-like learning steps logic.
   * Pure approach: learning step reviews stay separate from FSRS history.
   *
   * @param studentId The UUID of the student.
   * @param cardId The UUID of the card being reviewed.
   * @param rating The student's performance rating (1-4).
   * @param reviewType The context of the review (e.g., VOCABULARY, LISTENING).
   * @param sessionId Optional session ID to retrieve learning steps configuration.
   * @returns A promise that resolves to the updated StudentCardState.
   */
  async recordReview(
    studentId: string,
    cardId: string,
    rating: FsrsRating,
    reviewType: ReviewType,
    sessionId?: string
  ): Promise<StudentCardState> {
    return prisma.$transaction(async (tx) => {
      const now = new Date();
      
      // 1. Get learning steps configuration from session (if available)
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
      const previousCardState = await tx.studentCardState.findUnique({
        where: { studentId_cardId: { studentId, cardId } },
      });

      if (!previousCardState) {
        throw new Error(
          `FSRSService Integrity Error: Cannot record review for a card that has no initial state. StudentId: ${studentId}, CardId: ${cardId}`
        );
      }
      
      // 3. Check if this card should use learning steps
      const shouldUseLearningSteps = await this._shouldUseLearningSteps(
        studentId, 
        cardId, 
        learningSteps, 
        tx
      );
      
      if (shouldUseLearningSteps) {
        // ============= LEARNING STEPS LOGIC =============
        console.log('Learning steps DEBUG:', {
          cardId: cardId.substring(0, 8),
          rating,
          learningSteps,
          message: 'Using learning steps logic'
        });
        
        const { shouldGraduate, newDueDate } = await this._calculateLearningStepsDue(
          studentId,
          cardId,
          rating,
          learningSteps,
          tx
        );
        
        if (shouldGraduate) {
          // ========= GRADUATION: First FSRS Review =========
          console.log('Learning steps GRADUATION:', {
            cardId: cardId.substring(0, 8),
            message: 'Graduating to FSRS scheduling'
          });
          
          // This review becomes the FIRST FSRS review - fall through to FSRS logic
          // Don't return here, let FSRS handle this review
        } else {
          // ========= STAY IN LEARNING STEPS =========
          
          // Determine appropriate state for learning steps
          const newState = (previousCardState.state === 'REVIEW' || previousCardState.state === 'RELEARNING')
            ? 'RELEARNING'
            : 'LEARNING';
          
          // Update card state with learning step due date
          const updatedState = await tx.studentCardState.update({
            where: { studentId_cardId: { studentId, cardId } },
            data: {
              due: newDueDate,
              lastReview: now,
              // DON'T increment reps during learning steps - keep it at 0
              lapses: rating === 1 ? { increment: 1 } : undefined,
              state: newState,
            },
          });
          
          // Record as learning step review (NOT an FSRS review)
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
              isLearningStep: true, // Mark as learning step review
            },
          });
          
          return updatedState;
        }
      }
      
      // ============= FSRS LOGIC =============
      // (Either not in learning steps, or graduating from learning steps)
      
      // 4. Get student's FSRS parameters
      const studentParams = await tx.studentFsrsParams.findFirst({
        where: { studentId, isActive: true },
      });
      const w = (studentParams?.w as number[]) ?? FSRS_DEFAULT_PARAMETERS;
      const engine = new FSRS(w);

      // 5. Determine memory state (NEW cards or graduated cards have no prior memory)
      const currentMemory =
        previousCardState.state === CardState.NEW
          ? undefined
          : new MemoryState(
            previousCardState.stability,
            previousCardState.difficulty
          );

      // 6. Calculate days since last FSRS review (not learning step review)
      // For graduated cards, this should be 0 since it's their first FSRS review
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
      
      console.log('FSRS Intervals DEBUG:', {
        cardState: previousCardState.state,
        daysSinceLastReview,
        intervals: {
          again: nextStates.again.interval,
          hard: nextStates.hard.interval, 
          good: nextStates.good.interval,
          easy: nextStates.easy.interval
        }
      });

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
      const updatedState = await tx.studentCardState.update({
        where: { studentId_cardId: { studentId, cardId } },
        data: {
          stability: newState.memory.stability,
          difficulty: newState.memory.difficulty,
          due: newDueDate,
          lastReview: now,
          reps: { increment: 1 }, // NOW we increment reps for FSRS
          lapses: rating === 1 ? { increment: 1 } : undefined,
          state: rating === 1 ? 'RELEARNING' : 'REVIEW',
        },
      });

      // 11. Record as FSRS review (NOT a learning step)
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
          isLearningStep: false, // Mark as FSRS review
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

    // Only get FSRS reviews (exclude learning step reviews) for optimization
    const allHistory = await prisma.reviewHistory.findMany({
      where: { 
        studentId,
        isLearningStep: false // Only FSRS reviews for parameter optimization
      },
      orderBy: { reviewedAt: 'asc' },
    });

    // FSRS optimization requires a meaningful amount of FSRS data.
    if (allHistory.length < 50) {
      const message = `Skipping optimization for student ${studentId}: insufficient FSRS review history (${allHistory.length} reviews). At least 50 FSRS reviews are recommended.`;
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

    // THE FIX: Use student-specific parameters if they exist, otherwise use defaults.
    const w = (studentParams?.w as number[]) ?? FSRS_DEFAULT_PARAMETERS;
    const engine = new FSRS(w);

    const statesFromHistory: Prisma.StudentCardStateCreateManyInput[] = [];
    const reviewedCardIds = new Set<string>();

    for (const cardId in historyByCard) {
      reviewedCardIds.add(cardId);
      const cardHistory = historyByCard[cardId];
      const lastReview = cardHistory[cardHistory.length - 1];
      
      // Check if this card should still be in learning steps
      // Count only learning step reviews (not FSRS reviews)
      const learningSteps = DEFAULT_LEARNING_STEPS;
      const learningStepReviews = cardHistory.filter(h => h.isLearningStep).length;
      const shouldBeInLearningSteps = learningStepReviews < learningSteps.length && 
                                     cardHistory.some(h => h.isLearningStep); // Has learning step history
      
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
      // Only use FSRS reviews (exclude learning step reviews)
      const fsrsOnlyHistory = cardHistory.filter(h => !h.isLearningStep);
      const fsrsReviews = this._mapHistoryToFsrsReviews(fsrsOnlyHistory);
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

