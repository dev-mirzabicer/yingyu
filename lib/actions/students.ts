import { prisma } from '@/lib/db';
import { authorizeTeacherForStudent } from '@/lib/auth';
import { FullStudentProfile, PopulatedStudentDeck } from '@/lib/types';
import { Payment, Student, StudentDeck } from '@prisma/client';

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
};
