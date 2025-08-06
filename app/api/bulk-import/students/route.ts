import { NextResponse } from 'next/server';
import { JobService } from '@/lib/actions/jobs';
import { apiResponse, handleApiError } from '@/lib/api-utils';
import { getAuth } from '@clerk/nextjs/server';
import { NextApiRequest } from 'next';

export async function POST(req: NextApiRequest) {
  try {
    const { userId: teacherId } = getAuth(req);
    if (!teacherId) {
      return apiResponse({
        status: 401,
        message: 'Unauthorized',
      });
    }
    const payload = await req.json();
    const job = await JobService.createBulkImportStudentsJob(teacherId, payload);
    return apiResponse({ data: job });
  } catch (error) {
    return handleApiError(error);
  }
}