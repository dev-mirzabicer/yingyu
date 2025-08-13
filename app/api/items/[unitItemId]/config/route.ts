import { NextRequest } from 'next/server';
import { ContentService } from '@/lib/actions/content';
import { apiResponse, handleApiError } from '@/lib/api-utils';
import { VocabularyExerciseConfigSchema } from '@/lib/schemas';
import { requireAuth } from '@/lib/auth';

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ unitItemId: string }> }
) {
  try {
    const teacherId = await requireAuth(req);

    const { unitItemId } = await params;
    const body = await req.json();
    const config = VocabularyExerciseConfigSchema.parse(body);

    const updatedItem = await ContentService.updateUnitItemConfig(
      unitItemId,
      teacherId,
      config ?? {}
    );

    return apiResponse(200, updatedItem, null);
  } catch (error) {
    return handleApiError(error);
  }
}
