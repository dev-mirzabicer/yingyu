import { NextRequest, NextResponse } from 'next/server';
import { JobService } from '@/lib/actions/jobs';
import { apiResponse, handleApiError } from '@/lib/api-utils';
import { requireAuth } from '@/lib/auth';


export async function POST(req: NextRequest) {
  try {
    const teacherId = await requireAuth(req);
    const payload = await req.json();
    const job = await JobService.createBulkImportSchedulesJob(
      teacherId,
      payload
    );
    return apiResponse(200, job, null);
  } catch (error) {
    return handleApiError(error);
  }
}