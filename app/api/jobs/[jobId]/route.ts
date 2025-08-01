import { NextRequest, NextResponse } from 'next/server';
import { JobService } from '@/lib/actions/jobs';
import { apiResponse, handleApiError } from '@/lib/api-utils';

export async function GET(
  req: NextRequest,
  { params }: { params: { jobId: string } }
): Promise<NextResponse> {
  try {
    const teacherId = req.headers.get('X-Teacher-ID');
    if (!teacherId) {
      return apiResponse(401, null, 'Unauthorized: Missing X-Teacher-ID header.');
    }

    const { jobId } = params;

    // The getJobStatus service method is already secure and ensures
    // a teacher can only query their own jobs.
    const job = await JobService.getJobStatus(jobId, teacherId);

    if (!job) {
      return apiResponse(404, null, 'Job not found or you are not authorized to view it.');
    }

    return apiResponse(200, job, null);
  } catch (error) {
    return handleApiError(error);
  }
}

