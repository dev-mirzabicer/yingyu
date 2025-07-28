import { NextRequest } from 'next/server';
import { ContentService } from '@/lib/actions/content';
import { apiResponse, handleApiError } from '@/lib/api-utils';
import { z } from 'zod';

const AddItemBodySchema = z.object({
  type: z.literal('VOCABULARY_DECK'), // For now, only allow this type
  data: z.object({
    name: z.string().min(1),
    description: z.string().optional(),
    isPublic: z.boolean().optional(),
  }),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { unitId: string } }
) {
  try {
    const teacherId = req.headers.get('X-Teacher-ID');
    if (!teacherId) {
      return apiResponse(401, null, 'Unauthorized: Missing X-Teacher-ID header.');
    }

    const { unitId } = params;
    const body = await req.json();
    const itemData = AddItemBodySchema.parse(body);

    const newUnitItem = await ContentService.addExerciseToUnit(
      unitId,
      teacherId,
      itemData
    );

    return apiResponse(201, newUnitItem, null);
  } catch (error) {
    return handleApiError(error);
  }
}

