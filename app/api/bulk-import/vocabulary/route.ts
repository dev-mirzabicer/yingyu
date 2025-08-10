import { JobService } from '@/lib/actions/jobs';
import { BulkImportVocabularyPayloadSchema } from '@/lib/schemas';
import { apiResponse, handleApiError } from '@/lib/api-utils';
import { getAuth } from '@clerk/nextjs/server';
import { NextRequest } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { userId: teacherId } = getAuth(req);
    if (!teacherId) {
      return apiResponse(401, null, 'Unauthorized');
    }
    const payload = await req.json();

    const validatedPayload = BulkImportVocabularyPayloadSchema.parse(payload);

    const job = await JobService.createBulkImportVocabularyJob(
      teacherId,
      validatedPayload as any
    );

    return apiResponse(
      201,
      job,
      'Successfully created bulk import job for vocabulary.'
    );
  } catch (error) {
    return handleApiError(error);
  }
}
