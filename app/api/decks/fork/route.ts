import { NextRequest } from 'next/server';
import { ContentService } from '@/lib/actions/content';
import { apiResponse, handleApiError } from '@/lib/api-utils';
import { z } from 'zod';
import { UnitItemType } from '@prisma/client';
import { requireAuth } from '@/lib/auth';

const ForkDeckBodySchema = z.object({
  deckId: z.string().uuid('Invalid deck ID format.'),
});

/**
 * POST /api/decks/fork
 * Creates a private, editable copy (a "fork") of a public vocabulary deck
 * for the authenticated teacher. This performs a deep copy, including all cards.
 */
export async function POST(req: NextRequest) {
  try {
    const teacherId = await requireAuth(req);

    const body = await req.json();
    const { deckId } = ForkDeckBodySchema.parse(body);

    const forkedDeck = await ContentService.forkExercise(
      UnitItemType.VOCABULARY_DECK,
      deckId,
      teacherId
    );

    return apiResponse(201, forkedDeck, null);
  } catch (error) {
    return handleApiError(error);
  }
}

