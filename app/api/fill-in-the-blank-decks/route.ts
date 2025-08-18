import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { ContentService } from '@/lib/actions/content';
import { CreateFillInTheBlankDeckSchema } from '@/lib/schemas';
import { apiResponse, apiError } from '@/lib/api-utils';

/**
 * GET /api/fill-in-the-blank-decks
 * Retrieves all Fill in the Blank decks for the authenticated teacher.
 */
export async function GET(request: NextRequest) {
  try {
    const { teacherId } = await requireAuth(request);

    const decks = await ContentService.getFillInTheBlankDecksForTeacher(teacherId);
    
    return apiResponse({ decks });
  } catch (error) {
    return apiError(error, 'Failed to fetch Fill in the Blank decks');
  }
}

/**
 * POST /api/fill-in-the-blank-decks
 * Creates a new Fill in the Blank deck for the authenticated teacher.
 */
export async function POST(request: NextRequest) {
  try {
    const { teacherId } = await requireAuth(request);
    
    const body = await request.json();
    const validatedData = CreateFillInTheBlankDeckSchema.parse(body);

    const deck = await ContentService.createFillInTheBlankDeck({
      ...validatedData,
      creatorId: teacherId,
    });

    return apiResponse({ deck }, { status: 201 });
  } catch (error) {
    return apiError(error, 'Failed to create Fill in the Blank deck');
  }
}