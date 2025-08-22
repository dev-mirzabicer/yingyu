import { JobService } from '@/lib/actions/jobs';
import { BulkImportGenericDeckPayloadSchema } from '@/lib/schemas';
import { apiResponse, handleApiError } from '@/lib/api-utils';
import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const teacherId = await requireAuth(req);
    const payload = await req.json();

    const validatedPayload = BulkImportGenericDeckPayloadSchema.parse(payload);

    const job = await JobService.createBulkImportGenericDeckJob(
      teacherId,
      validatedPayload as any
    );

    return apiResponse(
      201,
      job,
      'Successfully created bulk import job for generic deck.'
    );
  } catch (error) {
    return handleApiError(error);
  }
}