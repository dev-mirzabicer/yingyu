import { NextRequest } from 'next/server';
import { ContentService } from '@/lib/actions/content';
import { apiResponse, handleApiError } from '@/lib/api-utils';
import { prisma } from '@/lib/db';
import { CreateGenericCardSchema } from '@/lib/schemas';
import { Prisma } from '@prisma/client';
import { requireAuth } from '@/lib/auth';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ deckId: string }> }
) {
  try {
    // 1. Authentication
    const teacherId = await requireAuth(req);

    // 2. Parameter Validation
    const { deckId } = await params;
    if (!deckId) {
      return apiResponse(400, null, 'Bad Request: Missing deckId parameter.');
    }

    // 3. Check if the deck exists and the teacher has access to it
    const deck = await prisma.genericDeck.findUnique({
      where: { id: deckId },
      select: { creatorId: true, isPublic: true },
    });

    if (!deck) {
      return apiResponse(404, null, 'Generic deck not found.');
    }

    // Check if the teacher has access to this deck (either owned by them or it's public)
    if (!deck.isPublic && deck.creatorId !== teacherId) {
      return apiResponse(403, null, 'Access denied: You do not have permission to access this generic deck.');
    }

    // 4. Fetch all cards for this deck
    const cards = await prisma.genericCard.findMany({
      where: { deckId },
      include: {
        boundVocabularyCard: {
          select: { id: true, englishWord: true }
        }
      },
      orderBy: { createdAt: 'desc' },
    });

    // 5. Return Success Response
    return apiResponse(200, { cards }, null);
  } catch (error) {
    // 6. Centralized Error Handling
    return handleApiError(error);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ deckId: string }> }
) {
  try {
    // 1. Authentication
    const teacherId = await requireAuth(req);

    // 2. Parameter & Body Validation
    const { deckId } = await params;
    if (!deckId) {
      return apiResponse(400, null, 'Bad Request: Missing deckId parameter.');
    }
    const body = await req.json();
    const cardData = CreateGenericCardSchema.parse(body);

    // 3. Delegate to Service Layer
    const newCard = await ContentService.addCardToGenericDeck(
      deckId,
      teacherId,
      cardData
    );

    // 4. Return Success Response
    return apiResponse(201, newCard, null);
  } catch (error) {
    // 5. Centralized Error Handling
    return handleApiError(error);
  }
}