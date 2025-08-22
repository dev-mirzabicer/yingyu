import { NextRequest } from 'next/server';
import { ContentService } from '@/lib/actions/content';
import { apiResponse, handleApiError } from '@/lib/api-utils';
import { UnitItemType } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ deckId: string }> }
) {
  try {
    const teacherId = await requireAuth(req);

    const { deckId } = await params;

    // Fetch the generic deck by ID
    const deck = await prisma.genericDeck.findUnique({
      where: {
        id: deckId,
      },
      include: {
        _count: {
          select: {
            cards: true,
          },
        },
      },
    });

    if (!deck) {
      return apiResponse(404, null, 'Generic deck not found.');
    }

    // Check if the teacher has access to this deck (either owned by them or it's public)
    if (!deck.isPublic && deck.creatorId !== teacherId) {
      return apiResponse(403, null, 'Access denied: You do not have permission to access this generic deck.');
    }

    return apiResponse(200, deck, null);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ deckId: string }> }
) {
  try {
    const teacherId = await requireAuth(req);

    const { deckId } = await params;

    // The service method handles its own authorization check.
    const archivedDeck = await ContentService.archiveExercise(
      UnitItemType.GENERIC_DECK,
      deckId,
      teacherId
    );

    return apiResponse(200, archivedDeck, null);
  } catch (error) {
    return handleApiError(error);
  }
}