import { NextRequest } from 'next/server';
import { StudentService } from '@/lib/actions/students';
import { apiResponse, handleApiError } from '@/lib/api-utils';


/**
 * GET /api/students/{studentId}/available-units
 * Retrieves all units a student can potentially start, calculating their readiness status.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ studentId: string }> }
) {
  try {
    const teacherId = req.headers.get('X-Teacher-ID');
    if (!teacherId) {
      return apiResponse(401, null, 'Unauthorized: Missing X-Teacher-ID header.');
    }
    
    const { studentId } = await params;
    const availableUnits = await StudentService.getAvailableUnitsForStudent(
      studentId,
      teacherId
    );
    return apiResponse(200, availableUnits, null);
  } catch (error) {
    return handleApiError(error);
  }
}