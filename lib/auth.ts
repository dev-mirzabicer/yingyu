import { prisma } from '@/lib/db';
import { StudentStatus } from '@prisma/client';

/**
 * A custom error class for authorization failures.
 */
export class AuthorizationError extends Error {
  constructor(message = 'You are not authorized to perform this action.') {
    super(message);
    this.name = 'AuthorizationError';
  }
}

/**
 * Verifies that a teacher has the authority to perform an action on a student resource.
 * This is a critical security and business logic function.
 *
 * @param teacherId The ID of the teacher performing the action.
 * @param studentId The ID of the student being accessed.
 * @param options.checkIsActive If true, the function will also throw an error if the student is not in 'ACTIVE' status.
 * @throws {AuthorizationError} if the student does not exist, does not belong to the teacher, or fails the active status check.
 * @returns A promise that resolves to void if the teacher is authorized.
 */
export async function authorizeTeacherForStudent(
  teacherId: string,
  studentId: string,
  options: { checkIsActive: boolean } = { checkIsActive: false }
): Promise<void> {
  if (!teacherId || !studentId) {
    throw new AuthorizationError('Invalid teacher or student ID provided.');
  }

  // The global Prisma extension already filters for `isArchived: false`.
  const student = await prisma.student.findFirst({
    where: {
      id: studentId,
      teacherId: teacherId,
    },
    select: {
      id: true,
      status: true,
    },
  });

  if (!student) {
    throw new AuthorizationError(
      'Access denied: The specified student does not exist or you do not have permission to access them.'
    );
  }

  // If the 'checkIsActive' option is enabled, perform the status check.
  if (options.checkIsActive && student.status !== StudentStatus.ACTIVE) {
    throw new AuthorizationError(
      `Operation failed: Student is not active (status: ${student.status}).`
    );
  }
}
