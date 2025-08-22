import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { ContentService } from '@/lib/actions/content';
import { apiResponse, handleApiError } from '@/lib/api-utils';
import { prisma } from '@/lib/db';
import { z } from 'zod';

/**
 * POST /api/fill-in-the-blank-decks/[deckId]/bind
 * Auto-binds Fill in the Blank cards to vocabulary cards in the bound vocabulary deck.
 * Returns matches, ambiguities, and cards with no matches.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ deckId: string }> }
) {
  try {
    const teacherId = await requireAuth(request);
    const { deckId } = await params;

    const result = await ContentService.autoBindVocabulary(deckId, teacherId);

    // Get card details for the frontend
    const cardIds = [
      ...result.matches.map(m => m.fillInTheBlankCardId),
      ...result.ambiguities.map(a => a.fillInTheBlankCardId),
      ...result.noMatch.map(n => n.fillInTheBlankCardId)
    ];

    const cards = await prisma.fillInTheBlankCard.findMany({
      where: { id: { in: cardIds } },
      select: { id: true, question: true, answer: true, options: true, explanation: true, createdAt: true, updatedAt: true }
    });

    const cardMap = new Map(cards.map(card => [card.id, card]));

    // Transform to match frontend expectations
    const automaticMatches = result.matches.map(match => ({
      fillInTheBlankCard: cardMap.get(match.fillInTheBlankCardId)!,
      vocabularyCard: {
        id: match.vocabularyCardId,
        englishWord: match.vocabularyWord
      }
    }));

    const ambiguities = result.ambiguities.map(ambiguity => ({
      fillInTheBlankCard: cardMap.get(ambiguity.fillInTheBlankCardId)!,
      possibleMatches: ambiguity.possibleMatches.map(match => ({
        id: match.vocabularyCardId,
        englishWord: match.vocabularyWord
      }))
    }));

    const noMatches = result.noMatch.map(noMatch => 
      cardMap.get(noMatch.fillInTheBlankCardId)!
    );

    return apiResponse(200, { 
      automaticMatches,
      ambiguities,
      noMatches
    }, null);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * PUT /api/fill-in-the-blank-decks/[deckId]/bind
 * Resolves vocabulary binding ambiguities by applying teacher selections.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ deckId: string }> }
) {
  try {
    const teacherId = await requireAuth(request);
    const { deckId } = await params;
    
    const body = await request.json();
    
    // Validate the resolutions payload
    const ResolutionsSchema = z.object({
      resolutions: z.array(z.object({
        fillInTheBlankCardId: z.string().uuid(),
        vocabularyCardId: z.string().uuid().nullable(),
      })),
    });
    
    const { resolutions } = ResolutionsSchema.parse(body);

    await ContentService.resolveVocabularyBindingAmbiguities(
      deckId, 
      teacherId, 
      resolutions
    );

    return apiResponse(200, { 
      success: true, 
      resolvedCount: resolutions.length,
      message: 'Vocabulary binding ambiguities resolved successfully.' 
    }, null);
  } catch (error) {
    return handleApiError(error);
  }
}