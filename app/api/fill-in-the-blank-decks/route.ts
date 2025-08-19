import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { ContentService } from '@/lib/actions/content';
import { CreateFillInTheBlankDeckSchema } from '@/lib/schemas';
import { apiResponse, handleApiError } from '@/lib/api-utils';

/**
 * GET /api/fill-in-the-blank-decks
 * Retrieves all Fill in the Blank decks for the authenticated teacher.
 */
export async function GET(request: NextRequest) {
  try {
    const teacherId = await requireAuth(request);

    const decks = await ContentService.getFillInTheBlankDecksForTeacher(teacherId);
    
    return apiResponse(200, decks, null);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/fill-in-the-blank-decks
 * Creates a new Fill in the Blank deck for the authenticated teacher.
 */
export async function POST(request: NextRequest) {
  try {
    const teacherId = await requireAuth(request);
    
    const body = await request.json();
    const validatedData = CreateFillInTheBlankDeckSchema.parse(body);

    const deck = await ContentService.createFillInTheBlankDeck({
      ...validatedData,
      creatorId: teacherId,
    });

    return apiResponse(201, { deck }, null);
  } catch (error) {
    return handleApiError(error);
  }
}