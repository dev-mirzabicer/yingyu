import { NextRequest } from 'next/server';
import { FSRSService } from '@/lib/actions/fsrs';
import { apiResponse, handleApiError } from '@/lib/api-utils';
import { authorizeTeacherForStudent, requireAuth } from '@/lib/auth';

/**
 * GET /api/students/[studentId]/fsrs/listening-stats
 * Retrieves comprehensive listening FSRS statistics for a student.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ studentId: string }> }
) {
  try {
    const teacherId = await requireAuth(req);
    const { studentId } = await params;

    await authorizeTeacherForStudent(teacherId, studentId);

    const stats = await FSRSService.getListeningStats(studentId);

    return apiResponse(200, stats, null);
  } catch (error) {
    return handleApiError(error);
  }
}