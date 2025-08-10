import { NextRequest } from 'next/server';
import { FSRSService } from '@/lib/actions/fsrs';
import { apiResponse, handleApiError } from '@/lib/api-utils';


/**
 * GET /api/students/{studentId}/fsrs/stats
 * Retrieves detailed FSRS statistics for a student.
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
    const stats = await FSRSService.getFsrsStats(
      studentId,
      teacherId
    );
    return apiResponse(200, stats, null);
  } catch (error) {
    return handleApiError(error);
  }
}
