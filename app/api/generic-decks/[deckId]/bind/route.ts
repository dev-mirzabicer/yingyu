import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { ContentService } from '@/lib/actions/content';
import { apiResponse, handleApiError } from '@/lib/api-utils';
import { z } from 'zod';

/**
 * POST /api/generic-decks/[deckId]/bind
 * Auto-binds Generic cards to vocabulary cards in the bound vocabulary deck.
 * Returns matches, ambiguities, and cards with no matches.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ deckId: string }> }
) {
  try {
    const teacherId = await requireAuth(request);
    const { deckId } = await params;

    const result = await ContentService.autoBindGenericToVocabulary(deckId, teacherId);

    return apiResponse(200, { 
      matches: result.matchCount,
      ambiguities: result.ambiguities,
      noMatch: result.noMatch,
      summary: {
        automaticMatches: result.matchCount,
        ambiguousCards: result.ambiguities.length,
        unmatchedCards: result.noMatch.length,
      }
    }, null);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * PUT /api/generic-decks/[deckId]/bind
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
        genericCardId: z.string().uuid(),
        vocabularyCardId: z.string().uuid().nullable(),
      })),
    });
    
    const { resolutions } = ResolutionsSchema.parse(body);

    // For now, we'll manually apply the resolutions since we haven't implemented the resolution service method
    // This could be added to ContentService as resolveGenericVocabularyBindingAmbiguities if needed
    await Promise.all(
      resolutions.map(resolution =>
        ContentService.updateGenericCard(
          resolution.genericCardId,
          deckId,
          teacherId,
          { 
            boundVocabularyCard: resolution.vocabularyCardId 
              ? { connect: { id: resolution.vocabularyCardId } }
              : { disconnect: true }
          }
        )
      )
    );

    return apiResponse(200, { 
      success: true, 
      resolvedCount: resolutions.length,
      message: 'Generic deck vocabulary binding ambiguities resolved successfully.' 
    }, null);
  } catch (error) {
    return handleApiError(error);
  }
}