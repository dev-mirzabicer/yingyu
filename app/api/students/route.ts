import { NextRequest } from 'next/server';
import { StudentService } from '@/lib/actions/students';
import { apiResponse, handleApiError } from '@/lib/api-utils';
import { requireAuth } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const teacherId = await requireAuth(req);

    const students = await StudentService.getStudentsForTeacher(teacherId);
    return apiResponse(200, students, null);
  } catch (error) {
    return handleApiError(error);
  }
}