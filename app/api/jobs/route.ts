import { NextRequest, NextResponse } from 'next/server';
import { JobService } from '@/lib/actions/jobs';
import { apiResponse, handleApiError } from '@/lib/api-utils';

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const teacherId = req.headers.get('X-Teacher-ID');
    if (!teacherId) {
      return apiResponse(401, null, 'Unauthorized: Missing X-Teacher-ID header.');
    }

    // Get all jobs for the teacher
    const jobs = await JobService.getAllJobsForTeacher(teacherId);

    return apiResponse(200, jobs, null);
  } catch (error) {
    return handleApiError(error);
  }
}