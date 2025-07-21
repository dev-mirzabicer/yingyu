import { prisma } from '@/lib/db';
import { createFsrsEngine, FsrsRating } from '@/lib/fsrs/engine';
import {
  StudentCardState,
  VocabularyCard,
  StudentStatus,
} from '@prisma/client';

/**
 * A constant representing the minimum retrievability (a value from 0 to 1)
 * for a card to be considered "known" enough for listening practice.
 * Retrievability is estimated as exp(-t/S), where t is time and S is stability.
 * When t=S, R is ~0.36. This threshold selects cards with a stability
 * greater than their current interval, making them good candidates for recall practice.
 */
const LISTENING_CANDIDATE_RETRIEVABILITY_THRESHOLD = 0.36;

/**
 * The scientific core of the application. This service encapsulates all FSRS calculations
 * and interactions with a student's spaced repetition schedule. It is completely agnostic
 * of the underlying FSRS library implementation thanks to an abstraction layer.
 */
export const FSRSService = {
  /**
   * Retrieves all vocabulary cards that are due for a student's review session.
   * This operation is now status-aware and will return nothing for inactive students.
   *
   * @param studentId The UUID of the student.
   * @returns A promise that resolves to an array of due StudentCardState objects, with their cards populated.
   */
  async getDueCardsForStudent(
    studentId: string
  ): Promise<(StudentCardState & { card: VocabularyCard })[]> {
    // 1. Meticulous Status Check: Before performing any query, verify the student is active.
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      select: { status: true },
    });

    // If the student is not active, there are no due cards by definition.
    if (!student || student.status !== StudentStatus.ACTIVE) {
      return [];
    }

    // 2. Proceed with the query only for active students.
    return prisma.studentCardState.findMany({
      where: {
        studentId: studentId,
        due: { lte: new Date() },
      },
      include: {
        card: true,
      },
      orderBy: {
        due: 'asc',
      },
    });
  },

  /**
   * Records a student's review of a single card and calculates the next review date.
   * This is the most critical FSRS operation and is performed as an atomic database transaction.
   * Note: We do not check for student status here, as a review should be recorded
   * regardless. The initiation of the session itself is blocked by the SessionService.
   *
   * @param studentId The UUID of the student.
   * @param cardId The UUID of the card being reviewed.
   * @param rating The student's performance rating (1-4).
   * @returns A promise that resolves to the updated StudentCardState.
   */
  async recordReview(
    studentId: string,
    cardId: string,
    rating: FsrsRating
  ): Promise<StudentCardState> {
    return prisma.$transaction(async (tx) => {
      const currentState = await tx.studentCardState.findUnique({
        where: { studentId_cardId: { studentId, cardId } },
      });

      if (!currentState) {
        throw new Error(
          `Card state not found for student ${studentId} and card ${cardId}.`
        );
      }

      const studentParams = await tx.studentFsrsParams.findFirst({
        where: { studentId, isActive: true },
      });

      const engine = createFsrsEngine(studentParams);
      const now = new Date();

      const schedulingResult = engine.repeat(currentState, now);
      const newCardState = schedulingResult[rating];

      const updatedState = await tx.studentCardState.update({
        where: { id: currentState.id },
        data: {
          ...newCardState,
          lastReview: now,
        },
      });

      await tx.reviewHistory.create({
        data: {
          studentId,
          cardId,
          rating,
          reviewedAt: now,
          previousState: currentState.state,
          previousDifficulty: currentState.difficulty,
          previousStability: currentState.stability,
          previousDue: currentState.due,
        },
      });

      return updatedState;
    });
  },

  /**
   * Finds cards suitable for listening practice based on high confidence (retrievability)
   * or long review intervals. This operation is also status-aware.
   *
   * @param studentId The UUID of the student.
   * @returns A promise that resolves to an array of suitable VocabularyCard objects.
   */
  async getListeningCandidates(studentId: string): Promise<VocabularyCard[]> {
    // 1. Meticulous Status Check: Ensure the student is active before searching.
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      select: { status: true },
    });

    if (!student || student.status !== StudentStatus.ACTIVE) {
      return [];
    }

    // 2. Proceed with the query, now using a named constant for clarity.
    const candidates = await prisma.$queryRaw<VocabularyCard[]>`
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
    return candidates;
  },

  /**
   * Placeholder for triggering the asynchronous FSRS parameter optimization job.
   *
   * @param studentId The UUID of the student whose parameters should be optimized.
   */
  async triggerParameterOptimization(studentId: string): Promise<void> {
    console.log(
      `[FSRSService] Job requested: Optimize FSRS parameters for student ${studentId}.`
    );
    // TODO: Fully implement this, ... JobService.createJob(...)
    // The FSRS service is still largely a placeholder.
  },
};
