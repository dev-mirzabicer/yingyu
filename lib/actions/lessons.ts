import { prisma } from '@/lib/db';
import { authorizeTeacherForStudent, AuthorizationError } from '@/lib/auth';
import { FullLessonState } from '@/lib/types';
import { ContentService } from './content';
import { FSRSService } from './fsrs';
import { FsrsRating } from '../fsrs/engine';

/**
 * Service responsible for orchestrating the live teaching experience.
 * It acts as a state machine, managing the flow of a lesson and calling
 * other services (Content, FSRS, etc.) to perform specific actions.
 */
export const LessonService = {
  /**
   * Retrieves the complete, current state of a lesson.
   * This is the primary "read" operation for the lesson flow.
   *
   * @param lessonId The UUID of the lesson.
   * @param teacherId The UUID of the teacher for authorization.
   * @returns A promise that resolves to the FullLessonState or null if not found/authorized.
   */
  async getFullLessonState(
    lessonId: string,
    teacherId: string
  ): Promise<FullLessonState | null> {
    const lesson = await prisma.lesson.findUnique({
      where: { id: lessonId },
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

    if (!lesson || lesson.teacherId !== teacherId) {
      return null;
    }

    return lesson as FullLessonState;
  },

  /**
   * Starts a new lesson for a student with a specific unit.
   *
   * @param teacherId The UUID of the teacher initiating the lesson.
   * @param studentId The UUID of the student.
   * @param unitId The UUID of the unit to be taught.
   * @returns A promise that resolves to the initial FullLessonState of the new lesson.
   */
  async startLesson(
    teacherId: string,
    studentId: string,
    unitId: string
  ): Promise<FullLessonState> {
    await authorizeTeacherForStudent(teacherId, studentId);

    const unit = await ContentService.getUnitWithDetails(unitId);
    if (!unit || unit.items.length === 0) {
      throw new Error(
        'Cannot start a lesson with an empty or non-existent unit.'
      );
    }

    const firstItem = unit.items[0];

    const newLesson = await prisma.lesson.create({
      data: {
        teacherId,
        studentId,
        unitId,
        status: 'IN_PROGRESS',
        currentUnitItemId: firstItem.id,
      },
    });

    const lessonState = await this.getFullLessonState(newLesson.id, teacherId);
    if (!lessonState)
      throw new Error('Failed to create and retrieve lesson state.');
    return lessonState;
  },

  /**
   * Processes a student's answer for the current item in the lesson and advances the state.
   *
   * @param lessonId The UUID of the active lesson.
   * @param teacherId The UUID of the teacher for authorization.
   * @param answerData Data containing the answer (e.g., { cardId: '...', rating: 3 }).
   * @returns A promise that resolves to the new FullLessonState.
   */
  async submitAnswer(
    lessonId: string,
    teacherId: string,
    answerData: { cardId: string; rating: FsrsRating }
  ): Promise<FullLessonState> {
    const lessonState = await this.getFullLessonState(lessonId, teacherId);
    if (!lessonState || !lessonState.currentUnitItem) {
      throw new AuthorizationError(
        'Lesson not found or you are not authorized.'
      );
    }
    if (lessonState.status !== 'IN_PROGRESS') {
      throw new Error('This lesson is not active.');
    }

    // --- Orchestration Logic ---
    // 1. Process the answer based on the current item type.
    if (lessonState.currentUnitItem.vocabularyDeckId) {
      await FSRSService.recordReview(
        lessonState.studentId,
        answerData.cardId,
        answerData.rating
      );
    }
    // TODO: Add logic for other exercise types (grammar, listening, etc.)

    // --- State Transition Logic ---
    // 2. Find the next item in the sequence.
    const currentItemIndex = lessonState.unit.items.findIndex(
      (item) => item.id === lessonState.currentUnitItemId
    );
    const nextItem = lessonState.unit.items[currentItemIndex + 1];

    // 3. Advance the lesson state.
    if (nextItem) {
      await prisma.lesson.update({
        where: { id: lessonId },
        data: { currentUnitItemId: nextItem.id },
      });
    } else {
      // If there's no next item, the lesson is over.
      return this.endLesson(lessonId, teacherId);
    }

    // 4. Return the new state of the lesson.
    const newLessonState = await this.getFullLessonState(lessonId, teacherId);
    if (!newLessonState)
      throw new Error('Failed to retrieve updated lesson state.');
    return newLessonState;
  },

  /**
   * Finalizes a lesson, setting its status to COMPLETED.
   *
   * @param lessonId The UUID of the lesson to end.
   * @param teacherId The UUID of the teacher for authorization.
   * @returns A promise that resolves to the final, completed FullLessonState.
   */
  async endLesson(
    lessonId: string,
    teacherId: string
  ): Promise<FullLessonState> {
    const lesson = await prisma.lesson.findFirst({
      where: { id: lessonId, teacherId },
    });
    if (!lesson)
      throw new AuthorizationError(
        'Lesson not found or you are not authorized.'
      );

    await prisma.lesson.update({
      where: { id: lessonId },
      data: {
        status: 'COMPLETED',
        endTime: new Date(),
        currentUnitItemId: null, // Clean up the current item link
      },
    });

    // TODO: Trigger asynchronous post-lesson jobs, like PDF generation.
    // PDFService.requestPracticeSheetGeneration(lesson.studentId, 3);

    const finalState = await this.getFullLessonState(lessonId, teacherId);
    if (!finalState) throw new Error('Failed to retrieve final lesson state.');
    return finalState;
  },
};
