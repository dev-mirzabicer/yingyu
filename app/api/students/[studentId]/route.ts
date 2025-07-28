import { NextRequest } from 'next/server';
import { StudentService } from '@/lib/actions/students';
import { apiResponse, handleApiError } from '@/lib/api-utils';

export async function GET(
  req: NextRequest,
  { params }: { params: { studentId: string } }
) {
  try {
    const teacherId = req.headers.get('X-Teacher-ID');
    if (!teacherId) {
      return apiResponse(401, null, 'Unauthorized: Missing X-Teacher-ID header.');
    }

    const { studentId } = params;
    const studentProfile = await StudentService.getStudentProfile(
      studentId,
      teacherId
    );

    return apiResponse(200, studentProfile, null);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { studentId: string } }
) {
  try {
    const teacherId = req.headers.get('X-Teacher-ID');
    if (!teacherId) {
      return apiResponse(401, null, 'Unauthorized: Missing X-Teacher-ID header.');
    }

    const { studentId } = params;
    const archivedStudent = await StudentService.archiveStudent(
      studentId,
      teacherId
    );

    return apiResponse(200, { message: 'Student archived successfully.', student: archivedStudent }, null);
  } catch (error) {
    return handleApiError(error);
  }
}

