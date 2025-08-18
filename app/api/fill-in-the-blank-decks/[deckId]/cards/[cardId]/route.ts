import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { ContentService } from '@/lib/actions/content';
import { UpdateFillInTheBlankCardSchema } from '@/lib/schemas';
import { apiResponse, apiError } from '@/lib/api-utils';

interface RouteContext {
  params: { deckId: string; cardId: string };
}

/**
 * PUT /api/fill-in-the-blank-decks/[deckId]/cards/[cardId]
 * Updates a specific Fill in the Blank card.
 */
export async function PUT(request: NextRequest, { params }: RouteContext) {
  try {
    const { teacherId } = await requireAuth(request);
    const { deckId, cardId } = params;
    
    const body = await request.json();
    const validatedData = UpdateFillInTheBlankCardSchema.parse(body);

    const card = await ContentService.updateFillInTheBlankCard(
      cardId,
      deckId,
      teacherId,
      validatedData
    );

    return apiResponse({ card });
  } catch (error) {
    return apiError(error, 'Failed to update Fill in the Blank card');
  }
}

/**
 * DELETE /api/fill-in-the-blank-decks/[deckId]/cards/[cardId]
 * Deletes a specific Fill in the Blank card.
 */
export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    const { teacherId } = await requireAuth(request);
    const { deckId, cardId } = params;

    await ContentService.deleteFillInTheBlankCard(cardId, deckId, teacherId);

    return apiResponse({ success: true });
  } catch (error) {
    return apiError(error, 'Failed to delete Fill in the Blank card');
  }
}