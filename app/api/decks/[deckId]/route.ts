import { NextRequest } from 'next/server';
import { ContentService } from '@/lib/actions/content';
import { apiResponse, handleApiError } from '@/lib/api-utils';
import { UnitItemType } from '@prisma/client';

export async function DELETE(
  req: NextRequest,
  { params }: { params: { deckId: string } }
) {
  try {
    const teacherId = req.headers.get('X-Teacher-ID');
    if (!teacherId) {
      return apiResponse(401, null, 'Unauthorized: Missing X-Teacher-ID header.');
    }

    const { deckId } = params;

    // The service method handles its own authorization check.
    const archivedDeck = await ContentService.archiveExercise(
      UnitItemType.VOCABULARY_DECK,
      deckId,
      teacherId
    );

    return apiResponse(200, archivedDeck, null);
  } catch (error) {
    return handleApiError(error);
  }
}

