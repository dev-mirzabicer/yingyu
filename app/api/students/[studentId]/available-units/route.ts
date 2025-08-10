import { NextRequest } from 'next/server';
import { StudentService } from '@/lib/actions/students';
import { apiResponse, handleApiError } from '@/lib/api-utils';
import { getAuth } from '@clerk/nextjs/server';

/**
 * GET /api/students/{studentId}/available-units
 * Retrieves all units a student can potentially start, calculating their readiness status.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { studentId: string } }
) {
  try {
    const { userId: teacherId } = getAuth(req);
    if (!teacherId) {
      return apiResponse(401, null, 'Unauthorized');
    }

    const availableUnits = await StudentService.getAvailableUnitsForStudent(
      params.studentId,
      teacherId
    );
    return apiResponse(200, availableUnits, null);
  } catch (error) {
    return handleApiError(error);
  }
}