import { NextRequest } from 'next/server';
import { JobService } from '@/lib/actions/jobs';
import { apiResponse, handleApiError } from '@/lib/api-utils';
import { getAuth } from '@clerk/nextjs/server';

/**
 * GET /api/jobs/{jobId}
 * Retrieves the status and details of a specific background job.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { jobId: string } }
) {
  try {
    const { userId: teacherId } = getAuth(req);
    if (!teacherId) {
      return apiResponse(401, null, 'Unauthorized');
    }

    const job = await JobService.getJobStatus(params.jobId, teacherId);
    return apiResponse(200, job, null);
  } catch (error) {
    return handleApiError(error);
  }
}
