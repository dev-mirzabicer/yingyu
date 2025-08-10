import { NextRequest, NextResponse } from 'next/server';
import { JobService } from '@/lib/actions/jobs';
import { apiResponse, handleApiError } from '@/lib/api-utils';


export async function POST(req: NextRequest) {
  try {
    const teacherId = req.headers.get('X-Teacher-ID');
    if (!teacherId) {
      return apiResponse(401, null, 'Unauthorized: Missing X-Teacher-ID header.');
    }
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