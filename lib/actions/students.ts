import { prisma } from '@/lib/db';
import { authorizeTeacherForStudent, AuthorizationError } from '@/lib/auth';
import { AvailableUnit, FullStudentProfile, PopulatedStudentDeck } from '@/lib/types';
import {
  CardState,
  Job,
  Payment,
  Prisma,
  Student,
  StudentDeck,
  ClassSchedule,
  ClassStatus,
} from '@prisma/client';
import {
  CreateStudentSchema,
  RecordPaymentSchema,
  CreateScheduleSchema,
  UpdateScheduleSchema,
  UpdateStudentSchema,
} from '../schemas';
import { z } from 'zod';
import {
  BulkImportSchedulesPayloadSchema,
  BulkImportStudentsPayloadSchema,
} from '../schemas';

type CreateStudentInput = z.infer<typeof CreateStudentSchema>;
type RecordPaymentInput = z.infer<typeof RecordPaymentSchema>;
type CreateScheduleInput = z.infer<typeof CreateScheduleSchema>;
type UpdateScheduleInput = z.infer<typeof UpdateScheduleSchema>;
type UpdateStudentInput = z.infer<typeof UpdateStudentSchema>;

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
   * Updates student details like name, email, phone, proficiency level, and notes.
   *
   * @param studentId The UUID of the student to update.
   * @param teacherId The UUID of the teacher for authorization.
   * @param updateData The validated data to update.
   * @returns A promise that resolves to the updated Student object.
   */
  async updateStudent(
    studentId: string,
    teacherId: string,
    updateData: UpdateStudentInput
  ): Promise<Student> {
    await authorizeTeacherForStudent(teacherId, studentId);
    UpdateStudentSchema.parse(updateData);
    return prisma.student.update({
      where: { id: studentId },
      data: updateData,
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
          include: {
            deck: {
              include: {
                _count: {
                  select: {
                    cards: true,
                  },
                },
              },
            },
          },
          orderBy: { assignedAt: 'desc' },
        },
        classSchedules: {
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
      studentDecks: student.studentDecks as any, // Cast for now, fix PopulatedStudentDeck if needed
      notes: student.notes, // Ensure notes is passed correctly
    } as FullStudentProfile; // Cast to the correct, extended type
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

        // Check deck size to decide between sync and async initialization
        const cardCount = await tx.vocabularyCard.count({
          where: { deckId },
        });

        if (cardCount <= 50) {
          // Initialize card states synchronously for small decks
          const cards = await tx.vocabularyCard.findMany({
            where: { deckId },
            select: { id: true },
          });

          if (cards.length > 0) {
            const now = new Date();
            const defaultDifficulty = 5.0;
            const defaultStability = 1.0;
            const cardStatesToCreate = cards.map((card) => ({
              studentId: studentId,
              cardId: card.id,
              state: CardState.NEW,
              due: now,
              difficulty: defaultDifficulty,
              stability: defaultStability,
              reps: 0,
              lapses: 0,
            }));

            await tx.studentCardState.createMany({
              data: cardStatesToCreate,
              skipDuplicates: true,
            });
          }

          return { studentDeck: newAssignment, job: null };
        } else {
          // Use job system for larger decks
          const newJob = await tx.job.create({
            data: {
              ownerId: teacherId,
              type: 'INITIALIZE_CARD_STATES',
              payload: { studentId, deckId },
            },
          });

          return { studentDeck: newAssignment, job: newJob };
        }
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
   * Retrieves all payments for a specific student.
   * @param studentId The UUID of the student.
   * @returns A promise that resolves to an array of Payment objects.
   */
  async getPaymentsForStudent(studentId: string): Promise<Payment[]> {
    // Authorization is handled at the API route layer for this read-only operation.
    return prisma.payment.findMany({
      where: { studentId },
      orderBy: { paymentDate: 'desc' },
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
          include: {
            deck: {
              include: {
                _count: {
                  select: {
                    cards: true,
                  },
                },
              },
            },
          },
          orderBy: { assignedAt: 'desc' },
        },
        classSchedules: {
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
        studentDecks: student.studentDecks as any,
        notes: student.notes,
      } as FullStudentProfile; // Cast each object in the array
    });
  },

  // --- NEW CLASS SCHEDULING METHODS ---

  /**
   * Retrieves all class schedules for a specific student.
   * @param studentId The UUID of the student.
   * @param teacherId The UUID of the teacher for authorization.
   * @returns A promise that resolves to an array of ClassSchedule objects.
   */
  async getSchedulesForStudent(
    studentId: string,
    teacherId: string
  ): Promise<ClassSchedule[]> {
    await authorizeTeacherForStudent(teacherId, studentId);
    return prisma.classSchedule.findMany({
      where: { studentId },
      orderBy: { scheduledTime: 'asc' },
    });
  },

  /**
   * Creates a new class schedule for a student.
   * @param studentId The UUID of the student.
   * @param teacherId The UUID of the teacher for authorization.
   * @param scheduleData The data for the new schedule.
   * @returns A promise that resolves to the newly created ClassSchedule object.
   */
  async createSchedule(
    studentId: string,
    teacherId: string,
    scheduleData: CreateScheduleInput
  ): Promise<ClassSchedule> {
    await authorizeTeacherForStudent(teacherId, studentId, {
      checkIsActive: true,
    });
    return prisma.classSchedule.create({
      data: {
        studentId,
        scheduledTime: scheduleData.scheduledTime,
        duration: scheduleData.duration,
        notes: scheduleData.notes,
      },
    });
  },

  /**
   * Updates an existing class schedule.
   * @param scheduleId The UUID of the schedule to update.
   * @param teacherId The UUID of the teacher for authorization.
   * @param updateData The data to update on the schedule.
   * @returns A promise that resolves to the updated ClassSchedule object.
   */
  async updateSchedule(
    scheduleId: string,
    teacherId: string,
    updateData: UpdateScheduleInput
  ): Promise<ClassSchedule> {
    const schedule = await prisma.classSchedule.findUnique({
      where: { id: scheduleId },
      select: { studentId: true, student: { select: { teacherId: true } } },
    });

    if (!schedule || schedule.student.teacherId !== teacherId) {
      throw new AuthorizationError(
        'Schedule not found or you are not authorized to modify it.'
      );
    }

    // Use a transaction to ensure atomicity of status update and payment deduction
    return prisma.$transaction(async (tx) => {
      const updatedSchedule = await tx.classSchedule.update({
        where: { id: scheduleId },
        data: updateData,
      });

      // If the class is marked as COMPLETED, deduct a class credit
      if (updateData.status === ClassStatus.COMPLETED) {
        const paymentToUpdate = await tx.payment.findFirst({
          where: {
            studentId: schedule.studentId,
            classesUsed: {
              lt: prisma.payment.fields.classesPurchased,
            },
          },
          orderBy: {
            paymentDate: 'asc',
          },
        });

        if (paymentToUpdate) {
          await tx.payment.update({
            where: { id: paymentToUpdate.id },
            data: {
              classesUsed: {
                increment: 1,
              },
            },
          });
        }
        // Note: If no payment with available classes is found, the class is still
        // marked as completed. This is a business decision - we don't block
        // completion if the student is out of credits. An alert system could
        // be built on top of this.
      }

      return updatedSchedule;
    });
  },

  /**
   * Deletes a class schedule.
   * @param scheduleId The UUID of the schedule to delete.
   * @param teacherId The UUID of the teacher for authorization.
   * @returns A promise that resolves to the deleted ClassSchedule object.
   */
  async deleteSchedule(
    scheduleId: string,
    teacherId: string
  ): Promise<ClassSchedule> {
    const schedule = await prisma.classSchedule.findUnique({
      where: { id: scheduleId },
      select: { student: { select: { teacherId: true } } },
    });

    if (!schedule || schedule.student.teacherId !== teacherId) {
      throw new AuthorizationError(
        'Schedule not found or you are not authorized to delete it.'
      );
    }

    return prisma.classSchedule.delete({
      where: { id: scheduleId },
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

  /**
   * [INTERNAL METHOD] Bulk adds students to a teacher's account.
   *
   * @param teacherId The UUID of the teacher.
   * @param payload The job payload, containing the students data.
   * @returns A result object indicating the number of students created.
   */
  async _bulkAddStudents(
    teacherId: string,
    payload: z.infer<typeof BulkImportStudentsPayloadSchema>
  ) {
    const { students } = payload;

    const studentsToCreate = students.map((student) => ({
      ...student,
      teacherId,
    }));

    const result = await prisma.student.createMany({
      data: studentsToCreate,
      skipDuplicates: true,
    });

    return { createdCount: result.count };
  },

  /**
   * [INTERNAL METHOD] Bulk adds schedules for students.
   *
   * @param payload The job payload, containing the schedules data.
   * @returns A result object indicating the number of schedules created.
   */
  async _bulkAddSchedules(
    payload: z.infer<typeof BulkImportSchedulesPayloadSchema>
  ) {
    const { schedules } = payload;

    const schedulesToCreate = await Promise.all(
      schedules.map(async (schedule) => {
        const student = await prisma.student.findFirst({
          where: { email: schedule.studentEmail },
        });

        if (!student) {
          return null;
        }

        return {
          studentId: student.id,
          scheduledTime: new Date(schedule.scheduledTime),
          duration: schedule.duration,
          notes: schedule.notes,
        };
      })
    );

    const validSchedules = schedulesToCreate.filter(
      (schedule) => schedule !== null
    ) as Prisma.ClassScheduleCreateManyInput[];

    const result = await prisma.classSchedule.createMany({
      data: validSchedules,
      skipDuplicates: true,
    });

    return { createdCount: result.count };
  },

  /**
   * Retrieves all units a student can potentially start, calculating their readiness status.
   * @param studentId The UUID of the student.
   * @param teacherId The UUID of the teacher for authorization.
   * @returns A promise that resolves to an array of AvailableUnit objects.
   */
  async getAvailableUnitsForStudent(
    studentId: string,
    teacherId: string
  ): Promise<AvailableUnit[]> {
    await authorizeTeacherForStudent(teacherId, studentId);

    const now = new Date();

    // 1. Get all units available to the teacher
    const allUnits = await prisma.unit.findMany({
      where: {
        OR: [{ isPublic: true }, { creatorId: teacherId }],
        isArchived: false,
      },
      include: {
        items: {
          include: {
            vocabularyDeck: {
              include: {
                cards: { select: { id: true } },
                _count: {
                  select: { cards: true },
                },
              },
            },
            grammarExercise: true,
            listeningExercise: true,
            fillInTheBlankDeck: {
              include: {
                cards: { select: { id: true } },
              },
            },
          },
          orderBy: { order: 'asc' },
        },
      },
    });

    // 2. Get all decks assigned to the student
    const studentDecks = await prisma.studentDeck.findMany({
      where: { studentId },
      select: { deckId: true },
    });
    const assignedDeckIds = new Set(studentDecks.map((sd) => sd.deckId));

    // 3. Get all card states for the student to calculate readiness
    const studentCardStates = await prisma.studentCardState.findMany({
      where: { studentId },
      select: {
        state: true,
        due: true,
        card: { select: { deckId: true } },
      },
    });

    // Map card states by deck for efficient lookup
    const statesByDeck = studentCardStates.reduce((acc, state) => {
      const deckId = state.card.deckId;
      if (!acc[deckId]) {
        acc[deckId] = [];
      }
      acc[deckId].push(state);
      return acc;
    }, {} as Record<string, typeof studentCardStates>);


    const availableUnits: AvailableUnit[] = allUnits.map((unit) => {
      const unitDecks = unit.items
        .map((item) => item.vocabularyDeck)
        .filter((deck): deck is NonNullable<typeof deck> => !!deck);

      const missingPrerequisites: string[] = [];
      let isAvailable = true;
      let totalCards = 0;
      let readyCards = 0;

      for (const deck of unitDecks) {
        totalCards += deck._count?.cards || 0;
        if (!assignedDeckIds.has(deck.id)) {
          isAvailable = false;
          missingPrerequisites.push(deck.name);
        } else {
          const deckStates = statesByDeck[deck.id] || [];
          const dueInDeck = deckStates.filter(
            (s) => s.state !== 'NEW' && new Date(s.due) <= now
          ).length;
          const newInDeck = deckStates.filter((s) => s.state === 'NEW').length;
          readyCards += dueInDeck + newInDeck;
        }
      }

      return {
        ...unit,
        items: unit.items,
        isAvailable,
        missingPrerequisites,
        cardStats: {
          total: totalCards,
          ready: readyCards,
        },
        exerciseCount: unit.items.length,
      };
    });

    return availableUnits;
  },
};

