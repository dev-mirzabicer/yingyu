import { NextRequest } from 'next/server';
import { FSRSService } from '@/lib/actions/fsrs';
import { apiResponse, handleApiError } from '@/lib/api-utils';
import { authorizeTeacherForStudent, requireAuth } from '@/lib/auth';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ studentId: string }> }
) {
  try {
    const teacherId = await requireAuth(req);

    const { studentId } = await params;

    // Explicit authorization before calling the service.
    await authorizeTeacherForStudent(teacherId, studentId);

    const dueCards = await FSRSService.getDueCardsForStudent(studentId);

    return apiResponse(200, dueCards, null);
  } catch (error) {
    return handleApiError(error);
  }
}

