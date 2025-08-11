import { prisma } from '@/lib/db';
import { authorizeTeacherForStudent, AuthorizationError } from '@/lib/auth';
import {
  FullSessionState,
  AnswerPayload,
  SubmissionResult,
  SessionProgress,
} from '@/lib/types';
import { Prisma, SessionStatus } from '@prisma/client';
import { getHandler } from '../exercises/dispatcher';
import { fullSessionStateInclude } from '../prisma-includes';

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
        ...fullSessionStateInclude,
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
      },
    });

    if (!session || session.teacherId !== teacherId) {
      return null;
    }

    return session as unknown as FullSessionState;
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
    unitId: string,
    configOverrides?: { [key: string]: any }
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

    if (configOverrides) {
      unit.items.forEach(item => {
        if (configOverrides[item.id]) {
          item.exerciseConfig = {
            ...item.exerciseConfig as any,
            ...configOverrides[item.id],
          };
        }
      });
    }

    const firstItem = unit.items[0];

    const newSession = await prisma.session.create({
      data: {
        teacherId,
        studentId,
        unitId,
        status: SessionStatus.IN_PROGRESS,
        currentUnitItemId: firstItem.id,
      },
      include: fullSessionStateInclude,
    });

    // Construct the initial state in-memory instead of re-fetching.
    // This preserves the configOverrides applied to the `unit` object.
    let sessionState: FullSessionState = {
      ...(newSession as unknown as FullSessionState),
      unit: {
        ...unit,
        items: unit.items.map(item => ({
          ...item,
          // The `unit` object from prisma only has the IDs, not the full
          // relations. The handler is responsible for fetching the full item details.
          // We ensure the properties exist as null for type consistency.
          vocabularyDeck: null,
          grammarExercise: null,
          listeningExercise: null,
          vocabFillInBlankExercise: null,
        })),
      },
    };

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
    return prisma.$transaction(async (tx) => {
      const sessionState = (await tx.session.findFirst({
        where: { id: sessionId, teacherId },
        include: fullSessionStateInclude,
      })) as FullSessionState | null;

      if (!sessionState || !sessionState.currentUnitItem) {
        throw new AuthorizationError(
          'Session not found or you are not authorized.'
        );
      }
      if (sessionState.status !== SessionStatus.IN_PROGRESS) {
        throw new Error('This session is not active.');
      }

      const handler = getHandler(sessionState.currentUnitItem.type);
      const [submissionResult, newProgress] = await handler.submitAnswer(
        sessionState,
        payload,
        tx
      );

      sessionState.progress = newProgress as SessionProgress;

      const isItemComplete = await handler.isComplete(sessionState);

      const updateData: Prisma.SessionUpdateInput = { progress: newProgress };
      let nextItem = null;

      if (isItemComplete) {
        const currentItemIndex = sessionState.unit.items.findIndex(
          (item) => item.id === sessionState.currentUnitItemId
        );
        nextItem = sessionState.unit.items[currentItemIndex + 1];

        if (nextItem) {
          updateData.currentUnitItem = { connect: { id: nextItem.id } };
          updateData.progress = Prisma.JsonNull;
        } else {
          updateData.status = SessionStatus.COMPLETED;
          updateData.endTime = new Date();
          updateData.currentUnitItem = { disconnect: true };
          updateData.progress = Prisma.JsonNull;
        }
      }

      const updatedSession = await tx.session.update({
        where: { id: sessionId },
        data: updateData,
        include: fullSessionStateInclude,
      });

      let finalState = updatedSession as unknown as FullSessionState;

      if (isItemComplete && nextItem) {
        const nextHandler = getHandler(nextItem.type);
        finalState = await nextHandler.initialize(finalState, tx);
      }

      return { newState: finalState, submissionResult };
    });
  },

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

    const updatedSession = await prisma.session.update({
      where: { id: sessionId },
      data: {
        status: SessionStatus.COMPLETED,
        endTime: new Date(),
        currentUnitItemId: null,
        progress: Prisma.JsonNull,
      },
      include: fullSessionStateInclude,
    });

    return updatedSession as unknown as FullSessionState;
  },

  /**
   * Retrieves all sessions for a specific teacher, ordered by creation date (newest first).
   * This provides the data needed for the sessions overview page.
   *
   * @param teacherId The UUID of the teacher.
   * @returns A promise that resolves to an array of session summaries.
   */
  async getAllSessionsForTeacher(teacherId: string): Promise<any[]> {
    const sessions = await prisma.session.findMany({
      where: { teacherId },
      include: {
        student: {
          select: {
            id: true,
            name: true,
          },
        },
        unit: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { startTime: 'desc' },
    });

    // Transform the sessions to match the expected format for the frontend
    return sessions.map(session => {
      const duration = session.endTime && session.startTime 
        ? Math.round((session.endTime.getTime() - session.startTime.getTime()) / 60000)
        : session.startTime 
          ? Math.round((new Date().getTime() - session.startTime.getTime()) / 60000)
          : 0;

      // Calculate real metrics from session progress
      const cardsReviewed = session.progress ? 
        (session.progress as any)?.payload?.queue?.length || 0 : 0;
      
      return {
        id: session.id,
        studentId: session.student.id,
        studentName: session.student.name,
        unitName: session.unit.name,
        status: session.status,
        startedAt: session.startTime,
        endedAt: session.endTime,
        duration,
        cardsReviewed,
      };
    });
  },
};

