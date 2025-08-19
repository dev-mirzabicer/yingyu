import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { ContentService } from '@/lib/actions/content';
import { CreateFillInTheBlankCardSchema } from '@/lib/schemas';
import { apiResponse, handleApiError } from '@/lib/api-utils';
import { prisma } from '@/lib/db';

/**
 * GET /api/fill-in-the-blank-decks/[deckId]/cards
 * Retrieves all cards for a specific Fill in the Blank deck.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ deckId: string }> }
) {
  try {
    const teacherId = await requireAuth(request);
    const { deckId } = await params;

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
      return apiResponse(404, null, 'Fill in the Blank deck not found');
    }

    // Check access permissions
    if (!deck.isPublic && deck.creatorId !== teacherId) {
      return apiResponse(403, null, 'You do not have access to this deck');
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

    return apiResponse(200, { cards }, null);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/fill-in-the-blank-decks/[deckId]/cards
 * Creates a new Fill in the Blank card in the specified deck.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ deckId: string }> }
) {
  try {
    const teacherId = await requireAuth(request);
    const { deckId } = await params;
    
    const body = await request.json();
    const validatedData = CreateFillInTheBlankCardSchema.parse(body);

    const card = await ContentService.addCardToFillInTheBlankDeck(
      deckId,
      teacherId,
      validatedData
    );

    return apiResponse(201, { card }, null);
  } catch (error) {
    return handleApiError(error);
  }
}