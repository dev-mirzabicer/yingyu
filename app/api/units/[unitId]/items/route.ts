import { NextRequest } from 'next/server';
import { ContentService } from '@/lib/actions/content';
import { apiResponse, handleApiError } from '@/lib/api-utils';
import { z } from 'zod';
import { NewUnitItemData } from '@/lib/types';

// This schema can be expanded as you implement more exercise types.
const AddItemBodySchema = z.union([
  z.object({
    type: z.literal('VOCABULARY_DECK'),
    mode: z.literal('new'),
    data: z.object({
      name: z.string().min(1),
      description: z.string().optional(),
      isPublic: z.boolean().optional(),
    }),
  }),
  z.object({
    type: z.literal('VOCABULARY_DECK'),
    mode: z.literal('existing'),
    existingDeckId: z.string().uuid(),
  }),
  z.object({
    type: z.literal('GRAMMAR_EXERCISE'),
    data: z.object({
      title: z.string().min(1),
      grammarTopic: z.string().optional(),
      exerciseData: z.any().optional(),
      isPublic: z.boolean().optional(),
    }),
  }),
]);

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ unitId: string }> } // Correctly destructure params here
) {
  try {
    const teacherId = req.headers.get('X-Teacher-ID');
    if (!teacherId) {
      return apiResponse(401, null, 'Unauthorized: Missing X-Teacher-ID header.');
    }

    // The `unitId` is now correctly and safely accessed from `params`.
    const { unitId } = await params;
    const body = await req.json();

    // The schema is now more flexible to accommodate different exercise types.
    const itemData = AddItemBodySchema.parse(body);

    const newUnitItem = await ContentService.addExerciseToUnit(
      unitId,
      teacherId,
      itemData as NewUnitItemData // Cast to the more specific service-layer type
    );

    return apiResponse(201, newUnitItem, null);
  } catch (error) {
    return handleApiError(error);
  }
}

