import { NextRequest } from 'next/server';
import { ContentService } from '@/lib/actions/content';
import { apiResponse, handleApiError } from '@/lib/api-utils';
import { CreateDeckSchema } from '@/lib/schemas';
import { requireAuth } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const teacherId = await requireAuth(req);

    const decks = await ContentService.getDecksForTeacher(teacherId);
    return apiResponse(200, decks, null);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const teacherId = await requireAuth(req);

    const body = await req.json();
    const deckData = CreateDeckSchema.parse(body);

    const newDeck = await ContentService.createDeck({
      ...deckData,
      creatorId: teacherId,
    });

    return apiResponse(201, newDeck, null);
  } catch (error) {
    return handleApiError(error);
  }
}