import { NextRequest } from 'next/server';
import { FSRSService } from '@/lib/actions/fsrs';
import { apiResponse, handleApiError } from '@/lib/api-utils';
import { requireAuth } from '@/lib/auth';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ studentId: string }> }
) {
  try {
    const teacherId = await requireAuth(req);

    const { studentId } = await params;

    // The service method handles its own authorization check.
    const job = await FSRSService.createRebuildCacheJob(studentId, teacherId);

    // Return 202 Accepted to indicate the task was accepted for background processing.
    return apiResponse(202, job, null);
  } catch (error) {
    return handleApiError(error);
  }
}

