import { NextRequest } from 'next/server';
import { StudentService } from '@/lib/actions/students';
import { apiResponse, handleApiError } from '@/lib/api-utils';

export async function GET(req: NextRequest) {
  try {
    const teacherId = req.headers.get('X-Teacher-ID');
    if (!teacherId) {
      return apiResponse(401, null, 'Unauthorized: Missing X-Teacher-ID header.');
    }

    const students = await StudentService.getStudentsForTeacher(teacherId);
    return apiResponse(200, students, null);
  } catch (error) {
    return handleApiError(error);
  }
}