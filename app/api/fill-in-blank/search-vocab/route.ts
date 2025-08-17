import { NextRequest } from 'next/server'
import { z } from 'zod'
import { ContentService } from '@/lib/actions/content'
import { requireAuth } from '@/lib/auth'
import { apiResponse, handleApiError } from '@/lib/api-utils'

const VocabSearchSchema = z.object({
  deckId: z.string().uuid('Invalid deck ID'),
  query: z.string().min(1, 'Search query is required'),
  limit: z.string().regex(/^\d+$/).transform(Number).optional().default(10),
})

// GET /api/fill-in-blank/search-vocab - Search vocabulary cards for binding
export async function GET(request: NextRequest) {
  try {
    const teacherId = await requireAuth(request)
    
    const url = new URL(request.url)
    const queryParams = Object.fromEntries(url.searchParams.entries())
    const { deckId, query, limit } = VocabSearchSchema.parse(queryParams)

    // Search for vocabulary cards in the specified deck that match the query
    const results = await ContentService.searchVocabularyCardsForBinding({
      deckId,
      query,
      limit,
      creatorId: teacherId, // Ensure user has access to the deck
    })

    return apiResponse(200, results, null)
  } catch (error) {
    console.error('Error searching vocabulary cards:', error)
    return handleApiError(error)
  }
}