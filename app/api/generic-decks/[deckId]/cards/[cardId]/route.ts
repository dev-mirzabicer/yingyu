import { NextRequest } from 'next/server';
import { ContentService } from '@/lib/actions/content';
import { apiResponse, handleApiError } from '@/lib/api-utils';
import { UpdateGenericCardSchema } from '@/lib/schemas';
import { requireAuth } from '@/lib/auth';

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ deckId: string; cardId: string }> }
) {
  try {
    // 1. Authentication
    const teacherId = await requireAuth(req);

    // 2. Parameter & Body Validation
    const { deckId, cardId } = await params;
    if (!deckId || !cardId) {
      return apiResponse(400, null, 'Bad Request: Missing deckId or cardId parameter.');
    }
    
    const body = await req.json();
    const cardData = UpdateGenericCardSchema.parse(body);

    // 3. Delegate to Service Layer
    const updatedCard = await ContentService.updateGenericCard(cardId, deckId, teacherId, cardData);

    // 4. Return Success Response
    return apiResponse(200, updatedCard, null);
  } catch (error) {
    // 5. Centralized Error Handling
    return handleApiError(error);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ deckId: string; cardId: string }> }
) {
  try {
    // 1. Authentication
    const teacherId = await requireAuth(req);

    // 2. Parameter Validation
    const { deckId, cardId } = await params;
    if (!deckId || !cardId) {
      return apiResponse(400, null, 'Bad Request: Missing deckId or cardId parameter.');
    }

    // 3. Delegate to Service Layer
    await ContentService.deleteGenericCard(cardId, deckId, teacherId);

    // 4. Return Success Response
    return apiResponse(200, null, 'Generic card deleted successfully.');
  } catch (error) {
    // 5. Centralized Error Handling
    return handleApiError(error);
  }
}