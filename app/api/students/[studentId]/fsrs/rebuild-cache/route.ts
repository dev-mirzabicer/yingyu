import { NextRequest } from 'next/server';
import { FSRSService } from '@/lib/actions/fsrs';
import { apiResponse, handleApiError } from '@/lib/api-utils';

export async function POST(
  req: NextRequest,
  { params }: { params: { studentId: string } }
) {
  try {
    const teacherId = req.headers.get('X-Teacher-ID');
    if (!teacherId) {
      return apiResponse(401, null, 'Unauthorized: Missing X-Teacher-ID header.');
    }

    const { studentId } = params;

    // The service method handles its own authorization check.
    const job = await FSRSService.createRebuildCacheJob(studentId, teacherId);

    // Return 202 Accepted to indicate the task was accepted for background processing.
    return apiResponse(202, job, null);
  } catch (error) {
    return handleApiError(error);
  }
}

