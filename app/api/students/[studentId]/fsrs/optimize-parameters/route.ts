import { NextRequest } from 'next/server';
import { FSRSService } from '@/lib/actions/fsrs';
import { apiResponse, handleApiError } from '@/lib/api-utils';

/**
 * POST /api/students/[studentId]/fsrs/optimize-parameters
 * Creates a background job to calculate and save optimal FSRS parameters
 * for a student based on their entire review history.
 */
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

