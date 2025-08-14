import { NextRequest } from 'next/server';
import { ContentService } from '@/lib/actions/content';
import { apiResponse, handleApiError } from '@/lib/api-utils';
import { ListeningExerciseConfigSchema, VocabularyExerciseConfigSchema } from '@/lib/schemas';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ unitItemId: string }> }
) {
  try {
    const teacherId = await requireAuth(req);

    const { unitItemId } = await params;
    const body = await req.json();
    // Determine item type to apply correct validation schema
    const unitItem = await prisma.unitItem.findUnique({ where: { id: unitItemId }, select: { type: true } });
    if (!unitItem) throw new Error('Unit item not found.');
    const validated = unitItem.type === 'LISTENING_EXERCISE'
      ? ListeningExerciseConfigSchema.parse(body)
      : VocabularyExerciseConfigSchema.parse(body);

    const updatedItem = await ContentService.updateUnitItemConfig(unitItemId, teacherId, validated ?? {});

    return apiResponse(200, updatedItem, null);
  } catch (error) {
    return handleApiError(error);
  }
}
