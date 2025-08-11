import { JobService } from '@/lib/actions/jobs';
import { BulkImportVocabularyPayloadSchema } from '@/lib/schemas';
import { apiResponse, handleApiError } from '@/lib/api-utils';
import { NextRequest } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const teacherId = req.headers.get('X-Teacher-ID');
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
