import { prisma } from '@/lib/db';
import { authorizeTeacherForStudent } from '@/lib/auth';
import { FullStudentProfile, PopulatedStudentDeck } from '@/lib/types';
import {
  CardState,
  Job,
  Payment,
  Prisma,
  Student,
  StudentDeck,
} from '@prisma/client';
import { CreateStudentSchema, RecordPaymentSchema } from '../schemas';
import { z } from 'zod';

// This import is no longer needed as the service is self-contained.
// import { JobService } from './jobs';

type CreateStudentInput = z.infer<typeof CreateStudentSchema>;
type RecordPaymentInput = z.infer<typeof RecordPaymentSchema>;

/**
 * Service responsible for managing student profiles, their assignments,
 * and other student-related business logic.
 */
export const StudentService = {
  /**
   * Creates a new student record associated with a teacher.
   *
   * @param teacherId The UUID of the owning teacher.
   * @param studentData The validated data for the new student.
   * @returns A promise that resolves to the newly created Student object.
   */
  async createStudent(
    teacherId: string,
    studentData: CreateStudentInput
  ): Promise<Student> {
    CreateStudentSchema.parse(studentData);
    return prisma.student.create({
      data: {
        ...studentData,
        teacherId: teacherId,
      },
    });
  },

  /**
   * Archives a student, effectively soft-deleting them from the system.
   *
   * @param studentId The UUID of the student to archive.
   * @param teacherId The UUID of the teacher for authorization.
   * @returns A promise that resolves to the archived Student object.
   */
  async archiveStudent(studentId: string, teacherId: string): Promise<Student> {
    await authorizeTeacherForStudent(teacherId, studentId);
    return prisma.student.update({
      where: { id: studentId },
      data: { isArchived: true },
    });
  },

  /**
   * Retrieves a complete, rich profile for a single student.
   *
   * @param studentId The UUID of the student to retrieve.
   * @param teacherId The UUID of the teacher requesting the profile (for authorization).
   * @returns A promise that resolves to a FullStudentProfile object or null if not found/authorized.
   */
  async getStudentProfile(
    studentId: string,
    teacherId: string
  ): Promise<FullStudentProfile | null> {
    await authorizeTeacherForStudent(teacherId, studentId);
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: {
        payments: { orderBy: { paymentDate: 'desc' } },
        studentDecks: {
          where: { deck: { isArchived: false } },
          include: { deck: true },
          orderBy: { assignedAt: 'desc' },
        },
        classSchedules: {
          where: { scheduledTime: { gte: new Date() } },
          orderBy: { scheduledTime: 'asc' },
        },
      },
    });
    if (!student) return null;
    const totalPurchased = student.payments.reduce(
      (sum, p) => sum + p.classesPurchased,
      0
    );
    const totalUsed = student.payments.reduce(
      (sum, p) => sum + p.classesUsed,
      0
    );
    const classesRemaining = totalPurchased - totalUsed;
    return {
      ...student,
      classesRemaining,
      upcomingClasses: student.classSchedules,
      studentDecks: student.studentDecks as PopulatedStudentDeck[],
    };
  },

  /**
   * Assigns a vocabulary deck to a student. If it's a new assignment, it atomically
   * creates a background job to initialize the FSRS card states within the same transaction.
   *
   * @param studentId The UUID of the student.
   * @param teacherId The UUID of the teacher performing the action.
   * @param deckId The UUID of the global vocabulary deck to assign.
   * @param settings Student-specific settings for this deck.
   * @returns A promise that resolves to an object containing the StudentDeck record
   *          and the Job if one was created.
   */
  async assignDeckToStudent(
    studentId: string,
    teacherId: string,
    deckId: string,
    settings: { dailyNewCards?: number; dailyReviewLimit?: number }
  ): Promise<{ studentDeck: StudentDeck; job: Job | null }> {
    await authorizeTeacherForStudent(teacherId, studentId, {
      checkIsActive: true,
    });

    // The transaction is now fully managed within this service.
    return prisma.$transaction(async (tx) => {
      const existingAssignment = await tx.studentDeck.findUnique({
        where: { studentId_deckId: { studentId, deckId } },
      });

      if (existingAssignment) {
        const updatedAssignment = await tx.studentDeck.update({
          where: { id: existingAssignment.id },
          data: { ...settings, isActive: true },
        });
        return { studentDeck: updatedAssignment, job: null };
      } else {
        const newAssignment = await tx.studentDeck.create({
          data: { studentId, deckId, ...settings },
        });

        // The job creation is now a direct database operation within the transaction.
        const newJob = await tx.job.create({
          data: {
            ownerId: teacherId,
            type: 'INITIALIZE_CARD_STATES',
            payload: { studentId, deckId },
          },
        });

        return { studentDeck: newAssignment, job: newJob };
      }
    });
  },

  /**
   * Records a new payment for a student.
   *
   * @param studentId The UUID of the student.
   * @param teacherId The UUID of the teacher performing the action.
   * @param paymentData The validated details of the payment.
   * @returns A promise that resolves to the newly created Payment record.
   */
  async recordPayment(
    studentId: string,
    teacherId: string,
    paymentData: RecordPaymentInput
  ): Promise<Payment> {
    await authorizeTeacherForStudent(teacherId, studentId);
    RecordPaymentSchema.parse(paymentData);
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
   * Retrieves all students for a given teacher with their basic profile information.
   * 
   * @param teacherId The UUID of the teacher.
   * @returns A promise that resolves to an array of students with calculated classes remaining.
   */
  async getStudentsForTeacher(teacherId: string): Promise<FullStudentProfile[]> {
    const students = await prisma.student.findMany({
      where: { 
        teacherId: teacherId,
        isArchived: false 
      },
      include: {
        payments: { orderBy: { paymentDate: 'desc' } },
        studentDecks: {
          where: { deck: { isArchived: false } },
          include: { deck: true },
          orderBy: { assignedAt: 'desc' },
        },
        classSchedules: {
          where: { scheduledTime: { gte: new Date() } },
          orderBy: { scheduledTime: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return students.map(student => {
      const totalPurchased = student.payments.reduce(
        (sum, p) => sum + p.classesPurchased,
        0
      );
      const totalUsed = student.payments.reduce(
        (sum, p) => sum + p.classesUsed,
        0
      );
      const classesRemaining = totalPurchased - totalUsed;
      
      return {
        ...student,
        classesRemaining,
        upcomingClasses: student.classSchedules,
      };
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
    const { studentId, deckId } = payload as {
      studentId: string;
      deckId: string;
    };
    if (!studentId || !deckId) {
      throw new Error('Invalid payload: studentId and deckId are required.');
    }
    const cards = await prisma.vocabularyCard.findMany({
      where: { deckId: deckId },
      select: { id: true },
    });
    if (cards.length === 0) return { cardsInitialized: 0 };
    const now = new Date();
    const defaultDifficulty = 5.0;
    const defaultStability = 1.0;
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
    const result = await prisma.studentCardState.createMany({
      data: cardStatesToCreate,
      skipDuplicates: true,
    });
    return { cardsInitialized: result.count };
  },
};
