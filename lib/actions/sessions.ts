import { prisma } from '@/lib/db';
import { authorizeTeacherForStudent, AuthorizationError } from '@/lib/auth';
import { FullSessionState, AnswerPayload } from '@/lib/types';
import { ContentService } from './content';
import { SessionStatus } from '@prisma/client';

/**
 * Service responsible for orchestrating a live teaching session.
 * It manages the state of the session, guiding the flow from one exercise (UnitItem)
 * to the next and dispatching tasks to the appropriate Exercise Handlers.
 */
export const SessionService = {
  /**
   * Retrieves the complete, current state of a session.
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

    return session as FullSessionState;
  },

  /**
   * Starts a new session for a student based on a specific unit.
   *
   * @param teacherId The UUID of the teacher initiating the session.
   * @param studentId The UUID of the student.
   * @param unitId The UUID of the unit to be taught.
   * @returns A promise that resolves to the initial FullSessionState of the new session.
   */
  async startSession(
    teacherId: string,
    studentId: string,
    unitId: string
  ): Promise<FullSessionState> {
    await authorizeTeacherForStudent(teacherId, studentId);

    const unit = await ContentService.getUnitWithDetails(unitId);
    if (!unit || unit.items.length === 0) {
      throw new Error(
        'Cannot start a session with an empty or non-existent unit.'
      );
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
    });

    const sessionState = await this.getFullState(newSession.id, teacherId);
    if (!sessionState)
      throw new Error('Failed to create and retrieve session state.');
    return sessionState;
  },

  /**
   * Processes a student's answer for the current item in the session.
   * This function will act as a dispatcher, delegating the actual work to the
   * appropriate Exercise Handler based on the current UnitItem's type.
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
  ): Promise<FullSessionState> {
    const sessionState = await this.getFullState(sessionId, teacherId);
    if (!sessionState || !sessionState.currentUnitItem) {
      throw new AuthorizationError(
        'Session not found or you are not authorized.'
      );
    }
    if (sessionState.status !== SessionStatus.IN_PROGRESS) {
      throw new Error('This session is not active.');
    }

    // TODO: PHASE 3 IMPLEMENTATION
    // 1. Create Handler Dispatcher (`lib/exercises/dispatcher.ts`)
    // 2. The dispatcher will look at `sessionState.currentUnitItem.type`.
    // 3. It will call the `submitAnswer` method of the corresponding handler
    //    (e.g., `VocabularyDeckHandler.submitAnswer(sessionState, payload)`).
    // 4. The handler will perform the specific logic (e.g., call FSRSService) and return a boolean for correctness.
    console.log(
      `Dispatching answer for item type: ${sessionState.currentUnitItem.type}`
    );
    console.log(`Payload:`, payload);

    // --- State Transition Logic ---
    const currentItemIndex = sessionState.unit.items.findIndex(
      (item) => item.id === sessionState.currentUnitItemId
    );
    const nextItem = sessionState.unit.items[currentItemIndex + 1];

    if (nextItem) {
      await prisma.session.update({
        where: { id: sessionId },
        data: { currentUnitItemId: nextItem.id },
      });
    } else {
      return this.endSession(sessionId, teacherId);
    }

    const newSessionState = await this.getFullState(sessionId, teacherId);
    if (!newSessionState)
      throw new Error('Failed to retrieve updated session state.');
    return newSessionState;
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
    if (!session)
      throw new AuthorizationError(
        'Session not found or you are not authorized.'
      );

    await prisma.session.update({
      where: { id: sessionId },
      data: {
        status: SessionStatus.COMPLETED,
        endTime: new Date(),
        currentUnitItemId: null,
      },
    });

    const finalState = await this.getFullState(sessionId, teacherId);
    if (!finalState) throw new Error('Failed to retrieve final session state.');
    return finalState;
  },
};
