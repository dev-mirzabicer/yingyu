import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { ContentService } from '@/lib/actions/content';
import { apiResponse, handleApiError } from '@/lib/api-utils';
import { z } from 'zod';

interface RouteContext {
  params: { deckId: string };
}

/**
 * POST /api/fill-in-the-blank-decks/[deckId]/bind
 * Auto-binds Fill in the Blank cards to vocabulary cards in the bound vocabulary deck.
 * Returns matches, ambiguities, and cards with no matches.
 */
export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const teacherId = await requireAuth(request);
    const { deckId } = params;

    const result = await ContentService.autoBindVocabulary(deckId, teacherId);

    return apiResponse(200, { 
      matches: result.matches,
      ambiguities: result.ambiguities,
      noMatch: result.noMatch,
      summary: {
        automaticMatches: result.matches.length,
        ambiguousCards: result.ambiguities.length,
        unmatchedCards: result.noMatch.length,
      }
    }, null);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * PUT /api/fill-in-the-blank-decks/[deckId]/bind
 * Resolves vocabulary binding ambiguities by applying teacher selections.
 */
export async function PUT(request: NextRequest, { params }: RouteContext) {
  try {
    const teacherId = await requireAuth(request);
    const { deckId } = params;
    
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