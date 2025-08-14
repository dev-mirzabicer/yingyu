import { NextRequest } from 'next/server';
import { FSRSService } from '@/lib/actions/fsrs';
import { apiResponse, handleApiError } from '@/lib/api-utils';
import { authorizeTeacherForStudent, requireAuth } from '@/lib/auth';

/**
 * POST /api/students/[studentId]/fsrs/optimize-listening-parameters
 * Creates a background job to optimize listening FSRS parameters for a student.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ studentId: string }> }
) {
  try {
    const teacherId = await requireAuth(req);
    const { studentId } = await params;

    await authorizeTeacherForStudent(teacherId, studentId);

    const job = await FSRSService.createOptimizeListeningParametersJob(studentId);

    return apiResponse(200, { job }, null);
  } catch (error) {
    return handleApiError(error);
  }
}