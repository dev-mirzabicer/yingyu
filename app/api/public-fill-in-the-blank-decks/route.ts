import { NextRequest } from 'next/server';
import { ContentService } from '@/lib/actions/content';
import { apiResponse, apiError } from '@/lib/api-utils';

/**
 * GET /api/public-fill-in-the-blank-decks
 * Retrieves all public Fill in the Blank decks.
 * This endpoint doesn't require authentication as public decks are available to all teachers.
 */
export async function GET(request: NextRequest) {
  try {
    const decks = await ContentService.getPublicFillInTheBlankDecks();
    
    return apiResponse({ decks });
  } catch (error) {
    return apiError(error, 'Failed to fetch public Fill in the Blank decks');
  }
}