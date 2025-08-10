import { NextRequest, NextResponse } from 'next/server';
import { JobService } from '@/lib/actions/jobs';
import { apiResponse, handleApiError } from '@/lib/api-utils';
import { getAuth } from '@clerk/nextjs/server';

export async function POST(req: NextRequest) {
  try {
    const { userId: teacherId } = getAuth(req);
    if (!teacherId) {
      return apiResponse(401, null, 'Unauthorized');
    }
    const payload = await req.json();
    const job = await JobService.createBulkImportStudentsJob(teacherId, payload);
    return apiResponse(200, job, null);
  } catch (error) {
    return handleApiError(error);
  }
}