import { NextRequest } from 'next/server';
import { apiResponse, handleApiError } from '@/lib/api-utils';
import { requireAuth } from '@/lib/auth';
import { ListeningFSRSService } from '@/lib/actions/listening';

/**
 * POST /api/students/[studentId]/listening/optimize-parameters
 * Creates a background job to optimize listening FSRS parameters for a student.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ studentId: string }> }
) {
  try {
    const teacherId = await requireAuth(req);
    const { studentId } = await params;
    const job = await ListeningFSRSService.createOptimizeParametersJob(studentId, teacherId);
    return apiResponse(202, job, null);
  } catch (error) {
    return handleApiError(error);
  }
}

