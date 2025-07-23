import { prisma } from '@/lib/db';
import { authorizeTeacherForStudent, AuthorizationError } from '@/lib/auth';
import { FullSessionState, AnswerPayload, SubmissionResult } from '@/lib/types';
import { Prisma, SessionStatus } from '@prisma/client';
import { getHandler } from '../exercises/dispatcher';

/**
 * The definitive service for orchestrating a live teaching session (v6.0).
 *
 * This service manages the high-level state machine of a session. Its core
 * responsibilities are:
 * 1. Starting and ending sessions.
 * 2. Retrieving the complete, current state of a session for the UI.
 * 3. Orchestrating the lifecycle of a UnitItem by delegating to the appropriate
 *    ExerciseHandler for initialization, answer submission, and completion checks.
 */
export const SessionService = {
  /**
   * Retrieves the complete, current state of a session, including all nested
   * data required by the frontend. This is the primary "read" operation.
   *
   * @param sessionId The UUID of the session.
   * @param teacherId The UUID of the teacher for authorization.
   * @returns A promise that resolves to the FullSessionState or null if not found/authorized.
   */
  async getFullState(
    sessionId: string,
    teacherId: string
  ): Promise<FullSessionState | null> {
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        student: true,
        unit: {
          include: {
            items: {
              orderBy: { order: 'asc' },
              include: {
                vocabularyDeck: {
                  include: { cards: { select: { id: true } } },
                },
                grammarExercise: true,
                listeningExercise: true,
                vocabFillInBlankExercise: true,
              },
            },
          },
        },
        currentUnitItem: {
          include: {
            vocabularyDeck: { include: { cards: { select: { id: true } } } },
            grammarExercise: true,
            listeningExercise: true,
            vocabFillInBlankExercise: true,
          },
        },
      },
    });

    if (!session || session.teacherId !== teacherId) {
      return null;
    }

    // The `progress` field from the DB is JSON, so we cast it to our strong type.
    return session as FullSessionState;
  },

  /**
   * Starts a new session for a student. It authorizes the request, creates the
   * session record, and then immediately calls the appropriate handler to initialize
   * the very first UnitItem.
   *
   * @param teacherId The UUID of the teacher initiating the session.
   * @param studentId The UUID of the student.
   * @param unitId The UUID of the unit to be taught.
   * @returns A promise that resolves to the initial, fully initialized FullSessionState.
   */
  async startSession(
    teacherId: string,
    studentId: string,
    unitId: string
  ): Promise<FullSessionState> {
    await authorizeTeacherForStudent(teacherId, studentId, {
      checkIsActive: true,
    });

    const unit = await prisma.unit.findUnique({
      where: { id: unitId },
      include: { items: { orderBy: { order: 'asc' } } },
    });

    if (!unit || unit.items.length === 0) {
      throw new Error(
        'Cannot start a session with an empty or non-existent unit.'
      );
    }

    const firstItem = unit.items[0];

    // Create the session record with the first item active.
    const newSession = await prisma.session.create({
      data: {
        teacherId,
        studentId,
        unitId,
        status: SessionStatus.IN_PROGRESS,
        currentUnitItemId: firstItem.id,
      },
    });

    // Immediately fetch the full state to pass to the initializer.
    let sessionState = await this.getFullState(newSession.id, teacherId);
    if (!sessionState) {
      throw new Error('Failed to create and retrieve session state.');
    }

    // Delegate to the handler to initialize the first item's progress.
    const handler = getHandler(firstItem.type);
    sessionState = await handler.initialize(sessionState);

    return sessionState;
  },

  /**
   * Processes a student's answer. This is the core of the state machine logic.
   * It orchestrates the handler calls for submission and completion checks,
   * and manages the transition between UnitItems.
   *
   * @param sessionId The UUID of the active session.
   * @param teacherId The UUID of the teacher for authorization.
   * @param payload The answer data from the frontend.
   * @returns A promise that resolves to the new FullSessionState.
   */
  async submitAnswer(
    sessionId: string,
    teacherId: string,
    payload: AnswerPayload
  ): Promise<{
    newState: FullSessionState;
    submissionResult: SubmissionResult;
  }> {
    let sessionState = await this.getFullState(sessionId, teacherId);
    if (!sessionState || !sessionState.currentUnitItem) {
      throw new AuthorizationError(
        'Session not found or you are not authorized.'
      );
    }
    if (sessionState.status !== SessionStatus.IN_PROGRESS) {
      throw new Error('This session is not active.');
    }

    // 1. Get the handler for the *current* item.
    const handler = getHandler(sessionState.currentUnitItem.type);

    // 2. Delegate the answer submission to the handler.
    // The handler will execute the correct operator and update the session's progress field.
    const submissionResult = await handler.submitAnswer(sessionState, payload);

    // 3. Re-fetch the state to get the updated progress from the handler's transaction.
    sessionState = await this.getFullState(sessionId, teacherId);
    if (!sessionState) {
      throw new Error('Failed to retrieve state after submission.');
    }

    // 4. Check if the current UnitItem is now complete.
    const isItemComplete = await handler.isComplete(sessionState);

    if (isItemComplete) {
      // 5. If complete, transition to the next item.
      const currentItemIndex = sessionState.unit.items.findIndex(
        (item) => item.id === sessionState.currentUnitItemId
      );
      const nextItem = sessionState.unit.items[currentItemIndex + 1];

      if (nextItem) {
        // There is a next item: update the session to point to it and clear progress.
        await prisma.session.update({
          where: { id: sessionId },
          data: {
            currentUnitItemId: nextItem.id,
            progress: Prisma.AnyNull, // Clear progress for the new item.
          },
        });

        // Re-fetch state one last time to pass to the new item's initializer.
        let nextState = await this.getFullState(sessionId, teacherId);
        if (!nextState) throw new Error('Failed to transition state.');

        // Initialize the *new* current item.
        const nextHandler = getHandler(nextItem.type);
        nextState = await nextHandler.initialize(nextState);
        return { newState: nextState, submissionResult };
      } else {
        // No next item: the session is complete.
        const finalState = await this.endSession(sessionId, teacherId);
        return { newState: finalState, submissionResult };
      }
    } else {
      // 6. If not complete, simply return the updated state.
      return { newState: sessionState, submissionResult };
    }
  },

  /**
   * Finalizes a session, setting its status to COMPLETED.
   *
   * @param sessionId The UUID of the session to end.
   * @param teacherId The UUID of the teacher for authorization.
   * @returns A promise that resolves to the final, completed FullSessionState.
   */
  async endSession(
    sessionId: string,
    teacherId: string
  ): Promise<FullSessionState> {
    const session = await prisma.session.findFirst({
      where: { id: sessionId, teacherId },
    });
    if (!session) {
      throw new AuthorizationError(
        'Session not found or you are not authorized.'
      );
    }

    await prisma.session.update({
      where: { id: sessionId },
      data: {
        status: SessionStatus.COMPLETED,
        endTime: new Date(),
        currentUnitItemId: null,
        progress: Prisma.AnyNull, // Ensure progress is cleared on session end.
      },
    });

    const finalState = await this.getFullState(sessionId, teacherId);
    if (!finalState) {
      throw new Error('Failed to retrieve final session state.');
    }
    return finalState;
  },
};
