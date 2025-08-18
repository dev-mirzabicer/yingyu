import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { ContentService } from '@/lib/actions/content';
import { CreateFillInTheBlankCardSchema } from '@/lib/schemas';
import { apiResponse, apiError } from '@/lib/api-utils';
import { prisma } from '@/lib/db';

interface RouteContext {
  params: { deckId: string };
}

/**
 * GET /api/fill-in-the-blank-decks/[deckId]/cards
 * Retrieves all cards for a specific Fill in the Blank deck.
 */
export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const { teacherId } = await requireAuth(request);
    const { deckId } = params;

    // First check if the deck exists and if teacher has access
    const deck = await prisma.fillInTheBlankDeck.findUnique({
      where: { id: deckId },
      select: { 
        id: true, 
        creatorId: true, 
        isPublic: true 
      },
    });

    if (!deck) {
      return apiError(new Error('Deck not found'), 'Fill in the Blank deck not found', { status: 404 });
    }

    // Check access permissions
    if (!deck.isPublic && deck.creatorId !== teacherId) {
      return apiError(new Error('Access denied'), 'You do not have access to this deck', { status: 403 });
    }

    const cards = await prisma.fillInTheBlankCard.findMany({
      where: { deckId },
      include: {
        boundVocabularyCard: {
          select: {
            id: true,
            englishWord: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return apiResponse({ cards });
  } catch (error) {
    return apiError(error, 'Failed to fetch Fill in the Blank cards');
  }
}

/**
 * POST /api/fill-in-the-blank-decks/[deckId]/cards
 * Creates a new Fill in the Blank card in the specified deck.
 */
export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const { teacherId } = await requireAuth(request);
    const { deckId } = params;
    
    const body = await request.json();
    const validatedData = CreateFillInTheBlankCardSchema.parse(body);

    const card = await ContentService.addCardToFillInTheBlankDeck(
      deckId,
      teacherId,
      validatedData
    );

    return apiResponse({ card }, { status: 201 });
  } catch (error) {
    return apiError(error, 'Failed to create Fill in the Blank card');
  }
}