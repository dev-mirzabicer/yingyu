import { NextRequest } from 'next/server';
import { ContentService } from '@/lib/actions/content';
import { apiResponse, handleApiError } from '@/lib/api-utils';
import { z } from 'zod';
import { Prisma } from '@prisma/client';

// A robust Zod schema to validate the incoming data for a new vocabulary card.
const AddCardBodySchema = z.object({
  englishWord: z.string().min(1, 'English word cannot be empty.'),
  chineseTranslation: z.string().min(1, 'Chinese translation cannot be empty.'),
  pinyin: z.string().optional(),
  ipaPronunciation: z.string().optional(),
  exampleSentences: z.any().optional(), // Can be refined to a specific JSON schema if needed
  wordType: z.string().optional(),
  difficultyLevel: z.number().int().min(1).max(5).optional(),
  audioUrl: z.string().url({ message: 'Invalid audio URL.' }).optional(),
  imageUrl: z.string().url({ message: 'Invalid image URL.' }).optional(),
  videoUrl: z.string().url({ message: 'Invalid video URL.' }).optional(),
  frequencyRank: z.number().int().optional(),
  tags: z.array(z.string()).optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ deckId: string }> }
) {
  try {
    // 1. Authentication (Development Placeholder)
    const teacherId = req.headers.get('X-Teacher-ID');
    if (!teacherId) {
      return apiResponse(401, null, 'Unauthorized: Missing X-Teacher-ID header.');
    }

    // 2. Parameter & Body Validation
    const { deckId } = await params;
    if (!deckId) {
      return apiResponse(400, null, 'Bad Request: Missing deckId parameter.');
    }
    const body = await req.json();
    const cardData = AddCardBodySchema.parse(body);

    // 3. Delegate to Service Layer
    const newCard = await ContentService.addCardToDeck(
      deckId,
      teacherId,
      cardData as Prisma.VocabularyCardCreateInput
    );

    // 4. Return Success Response
    return apiResponse(201, newCard, null);
  } catch (error) {
    // 5. Centralized Error Handling
    return handleApiError(error);
  }
}

