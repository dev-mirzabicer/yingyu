import { NextRequest } from 'next/server';
import { FSRSService } from '@/lib/actions/fsrs';
import { apiResponse, handleApiError } from '@/lib/api-utils';
import { requireAuth } from '@/lib/auth';

/**
 * POST /api/students/[studentId]/fsrs/optimize-parameters
 * Creates a background job to calculate and save optimal FSRS parameters
 * for a student based on their entire review history.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ studentId: string }> }
) {
  try {
    const teacherId = await requireAuth(req);

    const { studentId } = await params;

    const job = await FSRSService.createOptimizeParametersJob(
      studentId,
      teacherId
    );

    // Return 202 Accepted to indicate the task was accepted for background processing.
    return apiResponse(202, job, null);
  } catch (error) {
    return handleApiError(error);
  }
}

