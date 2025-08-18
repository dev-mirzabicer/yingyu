import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { JobService } from '@/lib/actions/jobs';
import { BulkImportFillInTheBlankPayloadSchema } from '@/lib/schemas';
import { apiResponse, apiError } from '@/lib/api-utils';

/**
 * POST /api/bulk-import/fill-in-the-blank
 * Creates a job to bulk import Fill in the Blank cards into a deck.
 * 
 * Expected payload:
 * {
 *   deckId: string,
 *   cards: Array<{
 *     question: string,
 *     answer: string,
 *     options?: string, // Comma-separated for CSV import
 *     explanation?: string,
 *     boundVocabularyCardId?: string
 *   }>
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const { teacherId } = await requireAuth(request);
    
    const body = await request.json();
    const validatedPayload = BulkImportFillInTheBlankPayloadSchema.parse(body);

    // Create a background job for bulk import
    const job = await JobService.createJob(teacherId, {
      type: 'BULK_IMPORT_FILL_IN_THE_BLANK',
      payload: validatedPayload,
    });

    return apiResponse({ 
      job: {
        id: job.id,
        status: job.status,
        createdAt: job.createdAt,
      },
      message: `Bulk import job created for ${validatedPayload.cards.length} Fill in the Blank cards.`,
      cardsToImport: validatedPayload.cards.length,
    }, { status: 202 }); // 202 Accepted for async processing
  } catch (error) {
    return apiError(error, 'Failed to create bulk import job for Fill in the Blank cards');
  }
}