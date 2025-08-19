import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { ContentService } from '@/lib/actions/content';
import { CreateFillInTheBlankDeckSchema } from '@/lib/schemas';
import { apiResponse, handleApiError } from '@/lib/api-utils';
import { UnitItemType } from '@prisma/client';
import { prisma } from '@/lib/db';

interface RouteContext {
  params: { deckId: string };
}

/**
 * GET /api/fill-in-the-blank-decks/[deckId]
 * Retrieves a specific Fill in the Blank deck with its cards.
 */
export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const teacherId = await requireAuth(request);
    const { deckId } = params;

    const deck = await prisma.fillInTheBlankDeck.findUnique({
      where: { id: deckId },
      include: {
        cards: {
          include: {
            boundVocabularyCard: {
              select: {
                id: true,
                englishWord: true,
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
        boundVocabularyDeck: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: {
            cards: true,
          },
        },
      },
    });

    if (!deck) {
      return apiResponse(404, null, 'Fill in the Blank deck not found');
    }

    // Check if teacher has access (either owner or public deck)
    if (!deck.isPublic && deck.creatorId !== teacherId) {
      return apiResponse(403, null, 'You do not have access to this deck');
    }

    return apiResponse(200, { deck }, null);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * PUT /api/fill-in-the-blank-decks/[deckId]
 * Updates a Fill in the Blank deck.
 */
export async function PUT(request: NextRequest, { params }: RouteContext) {
  try {
    const teacherId = await requireAuth(request);
    const { deckId } = params;
    
    const body = await request.json();
    const validatedData = CreateFillInTheBlankDeckSchema.partial().parse(body);

    const deck = await ContentService.updateFillInTheBlankDeck(deckId, teacherId, validatedData);

    return apiResponse(200, { deck }, null);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * DELETE /api/fill-in-the-blank-decks/[deckId]
 * Archives (soft-deletes) a Fill in the Blank deck.
 */
export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    const teacherId = await requireAuth(request);
    const { deckId } = params;

    const archivedDeck = await ContentService.archiveExercise(
      UnitItemType.FILL_IN_THE_BLANK_EXERCISE,
      deckId,
      teacherId
    );

    return apiResponse(200, { deck: archivedDeck }, null);
  } catch (error) {
    return handleApiError(error);
  }
}