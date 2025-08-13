import { NextRequest, NextResponse } from 'next/server';
import { SessionService } from '@/lib/actions/sessions';
import { apiResponse, handleApiError } from '@/lib/api-utils';
import { requireAuth } from '@/lib/auth';

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const teacherId = await requireAuth(req);

    // Get all sessions for the teacher
    const sessions = await SessionService.getAllSessionsForTeacher(teacherId);

    return apiResponse(200, sessions, null);
  } catch (error) {
    return handleApiError(error);
  }
}