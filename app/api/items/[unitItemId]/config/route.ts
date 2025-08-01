import { NextRequest } from 'next/server';
import { ContentService } from '@/lib/actions/content';
import { apiResponse, handleApiError } from '@/lib/api-utils';
import { VocabularyExerciseConfigSchema } from '@/lib/schemas';

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ unitItemId: string }> }
) {
  try {
    const teacherId = req.headers.get('X-Teacher-ID');
    if (!teacherId) {
      return apiResponse(401, null, 'Unauthorized: Missing X-Teacher-ID header.');
    }

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
