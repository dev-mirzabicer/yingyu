import { ContentService } from '@/lib/actions/content';
import { apiResponse, handleApiError } from '@/lib/api-utils';

/**
 * GET /api/public-fill-in-the-blank-decks
 * Retrieves all public Fill in the Blank decks.
 * This endpoint doesn't require authentication as public decks are available to all teachers.
 */
export async function GET() {
  try {
    const decks = await ContentService.getPublicFillInTheBlankDecks();
    
    return apiResponse(200, decks, null);
  } catch (error) {
    return handleApiError(error);
  }
}