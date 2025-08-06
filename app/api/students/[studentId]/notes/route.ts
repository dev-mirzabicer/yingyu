import { NextRequest } from 'next/server';
import { StudentService } from '@/lib/actions/students';
import { apiResponse, handleApiError } from '@/lib/api-utils';
import { UpdateNotesSchema } from '@/lib/schemas';

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ studentId: string }> }
) {
  try {
    // 1. Authentication & Authorization
    const teacherId = req.headers.get('X-Teacher-ID');
    if (!teacherId) {
      return apiResponse(401, null, 'Unauthorized: Missing X-Teacher-ID header.');
    }
    // The service method below will perform the necessary authorization check.

    // 2. Parameter & Body Validation
    const { studentId } = await params;
    const body = await req.json();
    const { notes } = UpdateNotesSchema.parse(body);

    // 3. Delegate to Service Layer
    const updatedStudent = await StudentService.updateStudentNotes(
      studentId,
      teacherId,
      notes ?? ''
    );

    // 4. Return Success Response
    return apiResponse(200, updatedStudent, null);
  } catch (error) {
    // 5. Centralized Error Handling
    return handleApiError(error);
  }
}

