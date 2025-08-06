import { NextRequest } from 'next/server';
import { FSRSService } from '@/lib/actions/fsrs';
import { apiResponse, handleApiError } from '@/lib/api-utils';
import { authorizeTeacherForStudent } from '@/lib/auth';

/**
 * GET /api/students/[studentId]/fsrs/listening-candidates
 * Retrieves a list of well-known vocabulary cards that are suitable
 * for listening practice for a given student.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ studentId: string }> }
) {
  try {
    const teacherId = req.headers.get('X-Teacher-ID');
    if (!teacherId) {
      return apiResponse(401, null, 'Unauthorized: Missing X-Teacher-ID header.');
    }

    const { studentId } = await params;

    // Explicit authorization before calling the service.
    await authorizeTeacherForStudent(teacherId, studentId);

    const candidates = await FSRSService.getListeningCandidates(studentId);

    return apiResponse(200, candidates, null);
  } catch (error) {
    return handleApiError(error);
  }
}

