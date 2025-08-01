import { NextRequest } from 'next/server';
import { FSRSService } from '@/lib/actions/fsrs';
import { apiResponse, handleApiError } from '@/lib/api-utils';
import { authorizeTeacherForStudent } from '@/lib/auth';

export async function GET(
  req: NextRequest,
  { params }: { params: { studentId: string } }
) {
  try {
    const teacherId = req.headers.get('X-Teacher-ID');
    if (!teacherId) {
      return apiResponse(401, null, 'Unauthorized: Missing X-Teacher-ID header.');
    }

    const { studentId } = params;

    // Explicit authorization before calling the service.
    await authorizeTeacherForStudent(teacherId, studentId);

    const dueCards = await FSRSService.getDueCardsForStudent(studentId);

    return apiResponse(200, dueCards, null);
  } catch (error) {
    return handleApiError(error);
  }
}

