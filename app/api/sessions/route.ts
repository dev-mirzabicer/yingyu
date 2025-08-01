import { NextRequest, NextResponse } from 'next/server';
import { SessionService } from '@/lib/actions/sessions';
import { apiResponse, handleApiError } from '@/lib/api-utils';

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const teacherId = req.headers.get('X-Teacher-ID');
    if (!teacherId) {
      return apiResponse(401, null, 'Unauthorized: Missing X-Teacher-ID header.');
    }

    // Get all sessions for the teacher
    const sessions = await SessionService.getAllSessionsForTeacher(teacherId);

    return apiResponse(200, sessions, null);
  } catch (error) {
    return handleApiError(error);
  }
}