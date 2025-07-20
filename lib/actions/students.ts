import { prisma } from '@/lib/db';
import { authorizeTeacherForStudent } from '@/lib/auth';
import { FullStudentProfile, PopulatedStudentDeck } from '@/lib/types';
import {
  CardState,
  Payment,
  Prisma,
  Student,
  StudentDeck,
} from '@prisma/client';

/**
 * Service responsible for managing student profiles, their assignments,
 * and other student-related business logic.
 */
export const StudentService = {
  /**
   * Retrieves a complete, rich profile for a single student.
   * This includes calculated fields like classes remaining and detailed relational data.
   *
   * @param studentId The UUID of the student to retrieve.
   * @param teacherId The UUID of the teacher requesting the profile (for authorization).
   * @returns A promise that resolves to a FullStudentProfile object or null if not found/authorized.
   */
  async getStudentProfile(
    studentId: string,
    teacherId: string
  ): Promise<FullStudentProfile | null> {
    // 1. Authorization: Ensure the teacher has access to this student.
    await authorizeTeacherForStudent(teacherId, studentId);

    // 2. Data Fetching: Get the student and all relevant related data.
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: {
        payments: { orderBy: { paymentDate: 'desc' } },
        studentDecks: {
          include: { deck: true },
          orderBy: { assignedAt: 'desc' },
        },
        classSchedules: {
          where: { scheduledTime: { gte: new Date() } },
          orderBy: { scheduledTime: 'asc' },
        },
      },
    });

    if (!student) {
      return null;
    }

    // 3. Business Logic: Calculate remaining classes in the application layer.
    const totalPurchased = student.payments.reduce(
      (sum, p) => sum + p.classesPurchased,
      0
    );
    const totalUsed = student.payments.reduce(
      (sum, p) => sum + p.classesUsed,
      0
    );
    const classesRemaining = totalPurchased - totalUsed;

    // 4. Return a well-structured, typed object.
    return {
      ...student,
      classesRemaining,
      upcomingClasses: student.classSchedules,
      studentDecks: student.studentDecks as PopulatedStudentDeck[],
    };
  },

  /**
   * Assigns a vocabulary deck to a student or updates the settings if already assigned.
   * This function is idempotent.
   *
   * @param studentId The UUID of the student.
   * @param teacherId The UUID of the teacher performing the action.
   * @param deckId The UUID of the global vocabulary deck to assign.
   * @param settings Student-specific settings for this deck.
   * @returns A promise that resolves to the created or updated StudentDeck record.
   */
  async assignDeckToStudent(
    studentId: string,
    teacherId: string,
    deckId: string,
    settings: { dailyNewCards?: number; dailyReviewLimit?: number }
  ): Promise<StudentDeck> {
    await authorizeTeacherForStudent(teacherId, studentId);

    return prisma.studentDeck.upsert({
      where: { studentId_deckId: { studentId, deckId } },
      update: { ...settings, isActive: true },
      create: {
        studentId,
        deckId,
        ...settings,
      },
    });
  },

  /**
   * Records a new payment for a student.
   *
   * @param studentId The UUID of the student.
   * @param teacherId The UUID of the teacher performing the action.
   * @param paymentData The details of the payment.
   * @returns A promise that resolves to the newly created Payment record.
   */
  async recordPayment(
    studentId: string,
    teacherId: string,
    paymentData: Omit<Payment, 'id' | 'studentId' | 'createdAt'>
  ): Promise<Payment> {
    await authorizeTeacherForStudent(teacherId, studentId);

    return prisma.payment.create({
      data: {
        ...paymentData,
        studentId,
      },
    });
  },

  /**
   * Updates the private notes a teacher keeps for a student.
   *
   * @param studentId The UUID of the student.
   * @param teacherId The UUID of the teacher performing the action.
   * @param notes The new text for the notes.
   * @returns A promise that resolves to the updated Student object.
   */
  async updateStudentNotes(
    studentId: string,
    teacherId: string,
    notes: string
  ): Promise<Student> {
    await authorizeTeacherForStudent(teacherId, studentId);

    return prisma.student.update({
      where: { id: studentId },
      data: { notes },
    });
  },

  /**
   * [INTERNAL METHOD] Initializes the FSRS state for every card in a given deck for a specific student.
   * This method is designed to be called by a trusted background worker, not directly from the API.
   * It performs a high-volume, efficient bulk insertion.
   *
   * @param payload The job payload, expected to contain studentId and deckId.
   * @returns A result object indicating the number of cards initialized.
   * @throws {Error} if payload is invalid or resources are not found.
   */
  async _initializeCardStates(
    payload: Prisma.JsonValue
  ): Promise<{ cardsInitialized: number }> {
    // 1. Meticulous Payload Validation
    const { studentId, deckId } = payload as {
      studentId: string;
      deckId: string;
    };
    if (!studentId || !deckId) {
      throw new Error('Invalid payload: studentId and deckId are required.');
    }

    // 2. Fetch all card IDs from the specified deck.
    const cards = await prisma.vocabularyCard.findMany({
      where: { deckId: deckId },
      select: { id: true },
    });

    if (cards.length === 0) {
      return { cardsInitialized: 0 }; // Nothing to do.
    }

    const now = new Date();
    const defaultDifficulty = 5.0;
    const defaultStability = 1.0;

    // 3. Prepare the data for bulk insertion.
    const cardStatesToCreate: Prisma.StudentCardStateCreateManyInput[] =
      cards.map((card) => ({
        studentId: studentId,
        cardId: card.id,
        state: CardState.NEW,
        due: now,
        difficulty: defaultDifficulty,
        stability: defaultStability,
        reps: 0,
        lapses: 0,
      }));

    // 4. Perform a single, highly efficient bulk creation operation.
    const result = await prisma.studentCardState.createMany({
      data: cardStatesToCreate,
      skipDuplicates: true, // Prevents errors if a card state somehow already exists.
    });

    return { cardsInitialized: result.count };
  },
};
