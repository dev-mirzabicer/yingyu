import { NextRequest } from 'next/server';
import { StudentService } from '@/lib/actions/students';
import { apiResponse, handleApiError } from '@/lib/api-utils';
import { UpdateStudentSchema } from '@/lib/schemas';

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
    const studentProfile = await StudentService.getStudentProfile(
      studentId,
      teacherId
    );

    return apiResponse(200, studentProfile, null);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ studentId: string }> }
) {
  try {
    const teacherId = req.headers.get('X-Teacher-ID');
    if (!teacherId) {
      return apiResponse(401, null, 'Unauthorized: Missing X-Teacher-ID header.');
    }

    const { studentId } = await params;
    const body = await req.json();
    const updateData = UpdateStudentSchema.parse(body);

    const updatedStudent = await StudentService.updateStudent(
      studentId,
      teacherId,
      updateData
    );

    return apiResponse(200, updatedStudent, null);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ studentId: string }> }
) {
  try {
    const teacherId = req.headers.get('X-Teacher-ID');
    if (!teacherId) {
      return apiResponse(401, null, 'Unauthorized: Missing X-Teacher-ID header.');
    }

    const { studentId } = await params;
    const archivedStudent = await StudentService.archiveStudent(
      studentId,
      teacherId
    );

    return apiResponse(200, { message: 'Student archived successfully.', student: archivedStudent }, null);
  } catch (error) {
    return handleApiError(error);
  }
}

