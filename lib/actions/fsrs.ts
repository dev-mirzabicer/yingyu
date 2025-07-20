import { prisma } from '@/lib/db';
import { createFsrsEngine, FsrsRating } from '@/lib/fsrs/engine';
import { StudentCardState, VocabularyCard } from '@prisma/client';

/**
 * The scientific core of the application. This service encapsulates all FSRS calculations
 * and interactions with a student's spaced repetition schedule. It is completely agnostic
 * of the underlying FSRS library implementation thanks to an abstraction layer.
 */
export const FSRSService = {
  /**
   * Retrieves all vocabulary cards that are due for a student's review session.
   *
   * @param studentId The UUID of the student.
   * @returns A promise that resolves to an array of due StudentCardState objects, with their cards populated.
   */
  async getDueCardsForStudent(
    studentId: string
  ): Promise<(StudentCardState & { card: VocabularyCard })[]> {
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
      // 1. Fetch the current state of the card and the student's FSRS parameters.
      const currentState = await tx.studentCardState.findUnique({
        where: { studentId_cardId: { studentId, cardId } },
      });

      if (!currentState) {
        throw new Error(
          `Card state not found for student ${studentId} and card ${cardId}.`
        );
      }

      const studentParams = await tx.studentFsrsParams.findUnique({
        where: { studentId, isActive: true },
      });

      // 2. Use the factory to create an FSRS engine instance.
      const engine = createFsrsEngine(studentParams);
      const now = new Date();

      // 3. Perform the FSRS calculation.
      const schedulingResult = engine.repeat(currentState, now);
      const newCardState = schedulingResult[rating];

      // 4. Update the card state in the database with the new calculated values.
      const updatedState = await tx.studentCardState.update({
        where: { id: currentState.id },
        data: {
          ...newCardState,
          lastReview: now,
        },
      });

      // 5. Log this review in the history for future parameter optimization.
      await tx.reviewHistory.create({
        data: {
          studentId,
          cardId,
          rating,
          reviewedAt: now,
          // Store the state *before* the review for accurate optimization.
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
   * or long review intervals, ensuring practice doesn't interfere with the learning curve.
   *
   * @param studentId The UUID of the student.
   * @returns A promise that resolves to an array of suitable VocabularyCard objects.
   */
  async getListeningCandidates(studentId: string): Promise<VocabularyCard[]> {
    // This query directly implements the logic from our original plan.
    // It finds cards in the 'REVIEW' state that have either a very high stability
    // (which implies high retrievability) or are not due for a long time.
    // NOTE: `exp(-1 / stability)` is a proxy for retrievability. A value > 0.36
    // corresponds to a stability > 1, which is a reasonable threshold for "known".
    const candidates = await prisma.$queryRaw<VocabularyCard[]>`
      SELECT vc.*
      FROM "VocabularyCard" vc
      JOIN "StudentCardState" scs ON vc.id = scs."cardId"
      WHERE scs."studentId" = ${studentId}::uuid
        AND scs.state = 'REVIEW'
        AND (
          exp(-1.0 / scs.stability) > 0.36
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
   * In a real system, this would add a job to a message queue (e.g., RabbitMQ, SQS).
   *
   * @param studentId The UUID of the student whose parameters should be optimized.
   */
  async triggerParameterOptimization(studentId: string): Promise<void> {
    console.log(
      `[FSRSService] Job requested: Optimize FSRS parameters for student ${studentId}.`
    );
    // TODO: Implement actual job queuing logic.
    // await messageQueue.add('fsrs-optimization', { studentId });
  },
};
