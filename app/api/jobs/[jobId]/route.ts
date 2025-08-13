import { NextRequest } from 'next/server';
import { JobService } from '@/lib/actions/jobs';
import { apiResponse, handleApiError } from '@/lib/api-utils';
import { requireAuth } from '@/lib/auth';


/**
 * GET /api/jobs/{jobId}
 * Retrieves the status and details of a specific background job.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const teacherId = await requireAuth(req);
    
    const { jobId } = await params;
    const job = await JobService.getJobStatus(jobId, teacherId);
    return apiResponse(200, job, null);
  } catch (error) {
    return handleApiError(error);
  }
}
