import { JobService } from '@/lib/actions/jobs';
import { BulkImportVocabularyPayloadSchema } from '@/lib/schemas/bulk-import';
import { apiResponse, handleApiError } from '@/lib/api-utils';
import { authorize } from '@/lib/auth';

export async function POST(req: Request) {
  try {
    const teacherId = await authorize();
    const payload = await req.json();

    const validatedPayload = BulkImportVocabularyPayloadSchema.parse(payload);

    const job = await JobService.createBulkImportVocabularyJob(
      teacherId,
      validatedPayload as any
    );

    return apiResponse({
      data: job,
      message: 'Successfully created bulk import job for vocabulary.',
    });
  } catch (error) {
    return handleApiError(error);
  }
}
