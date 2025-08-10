import { NextRequest } from 'next/server';
import { FSRSService } from '@/lib/actions/fsrs';
import { apiResponse, handleApiError } from '@/lib/api-utils';
import { getAuth } from '@clerk/nextjs/server';

/**
 * GET /api/students/{studentId}/fsrs/stats
 * Retrieves detailed FSRS statistics for a student.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { studentId: string } }
) {
  try {
    const { userId: teacherId } = getAuth(req);
    if (!teacherId) {
      return apiResponse(401, null, 'Unauthorized');
    }

    const stats = await FSRSService.getStudentStats(
      params.studentId,
      teacherId
    );
    return apiResponse(200, stats, null);
  } catch (error) {
    return handleApiError(error);
  }
}
