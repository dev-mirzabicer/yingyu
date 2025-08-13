import { NextRequest } from 'next/server';
import { FSRSService } from '@/lib/actions/fsrs';
import { apiResponse, handleApiError } from '@/lib/api-utils';
import { requireAuth } from '@/lib/auth';


/**
 * GET /api/students/{studentId}/fsrs/stats
 * Retrieves detailed FSRS statistics for a student.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ studentId: string }> }
) {
  try {
    const teacherId = await requireAuth(req);

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
