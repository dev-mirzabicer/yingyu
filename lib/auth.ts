import { prisma } from '@/lib/db';

/**
 * A custom error class for authorization failures.
 * This allows us to catch authorization-specific errors distinctly from other errors.
 */
export class AuthorizationError extends Error {
  constructor(message = 'You are not authorized to perform this action.') {
    super(message);
    this.name = 'AuthorizationError';
  }
}

/**
 * Verifies that a teacher has the authority to perform an action on a student-related resource.
 * This is a critical security function that MUST be called at the beginning of any service
 * method that accesses or modifies a specific student's data.
 *
 * @param teacherId The ID of the teacher performing the action.
 * @param studentId The ID of the student being accessed.
 * @throws {AuthorizationError} if the student does not exist or does not belong to the teacher.
 * @returns A promise that resolves to void if the teacher is authorized.
 */
export async function authorizeTeacherForStudent(
  teacherId: string,
  studentId: string
): Promise<void> {
  if (!teacherId || !studentId) {
    throw new AuthorizationError('Invalid teacher or student ID provided.');
  }

  const student = await prisma.student.findFirst({
    where: {
      id: studentId,
      teacherId: teacherId,
    },
    select: {
      id: true, // We only need to select one field to check for existence.
    },
  });

  if (!student) {
    throw new AuthorizationError(
      'Access denied: The specified student does not exist or you do not have permission to access them.'
    );
  }
}
