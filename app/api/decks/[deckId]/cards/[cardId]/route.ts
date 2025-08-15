import { NextRequest } from 'next/server';
import { ContentService } from '@/lib/actions/content';
import { apiResponse, handleApiError } from '@/lib/api-utils';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth';

// Zod schema for updating a vocabulary card - all fields optional
const UpdateCardBodySchema = z.object({
  englishWord: z.string().min(1, 'English word cannot be empty.').optional(),
  chineseTranslation: z.string().min(1, 'Chinese translation cannot be empty.').optional(),
  pinyin: z.string().optional(),
  ipaPronunciation: z.string().optional(),
  exampleSentences: z.any().optional(),
  wordType: z.string().optional(),
  difficultyLevel: z.number().int().min(1).max(5).optional(),
  audioUrl: z.string().url({ message: 'Invalid audio URL.' }).optional(),
  imageUrl: z.string().url({ message: 'Invalid image URL.' }).optional(),
  videoUrl: z.string().url({ message: 'Invalid video URL.' }).optional(),
  frequencyRank: z.number().int().optional(),
  tags: z.array(z.string()).optional(),
});

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ deckId: string; cardId: string }> }
) {
  try {
    // 1. Authentication
    const teacherId = await requireAuth(req);

    // 2. Parameter & Body Validation
    const { deckId, cardId } = await params;
    if (!deckId || !cardId) {
      return apiResponse(400, null, 'Bad Request: Missing deckId or cardId parameter.');
    }
    
    const body = await req.json();
    const cardData = UpdateCardBodySchema.parse(body);

    // 3. Delegate to Service Layer
    const updatedCard = await ContentService.updateCard(cardId, deckId, teacherId, cardData);

    // 4. Return Success Response
    return apiResponse(200, updatedCard, null);
  } catch (error) {
    // 5. Centralized Error Handling
    return handleApiError(error);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ deckId: string; cardId: string }> }
) {
  try {
    // 1. Authentication
    const teacherId = await requireAuth(req);

    // 2. Parameter Validation
    const { deckId, cardId } = await params;
    if (!deckId || !cardId) {
      return apiResponse(400, null, 'Bad Request: Missing deckId or cardId parameter.');
    }

    // 3. Delegate to Service Layer
    await ContentService.deleteCard(cardId, deckId, teacherId);

    // 4. Return Success Response
    return apiResponse(200, null, 'Card deleted successfully.');
  } catch (error) {
    // 5. Centralized Error Handling
    return handleApiError(error);
  }
}