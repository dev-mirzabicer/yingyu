import { NextResponse } from 'next/server';
import { ContentService } from '@/lib/actions/content';
import { apiResponse, handleApiError } from '@/lib/api-utils';

export async function GET() {
  try {
    const decks = await ContentService.getPublicDecks();
    return apiResponse({ data: decks });
  } catch (error) {
    return handleApiError(error);
  }
}
