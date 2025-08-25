import { NextRequest } from 'next/server';
import { ContentService } from '@/lib/actions/content';
import { apiResponse, handleApiError } from '@/lib/api-utils';
import { 
  VocabularyExerciseConfigSchema, 
  ListeningExerciseConfigSchema,
  FillInTheBlankExerciseConfigSchema
} from '@/lib/schemas';
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
    
    // Get the unit item to determine its type for proper validation
    const unitItem = await prisma.unitItem.findUnique({
      where: { id: unitItemId },
      include: { unit: { select: { creatorId: true } } },
    });

    if (!unitItem || unitItem.unit.creatorId !== teacherId) {
      return apiResponse(401, null, 'Unit item not found or you are not authorized to edit it.');
    }

    // Validate config based on exercise type
    let config;
    switch (unitItem.type) {
      case 'VOCABULARY_DECK':
      case 'GENERIC_DECK':
        config = VocabularyExerciseConfigSchema.parse(body);
        break;
      case 'LISTENING_EXERCISE':
        config = ListeningExerciseConfigSchema.parse(body);
        break;
      case 'FILL_IN_THE_BLANK_EXERCISE':
        config = FillInTheBlankExerciseConfigSchema.parse(body);
        break;
      default:
        return apiResponse(400, null, `Unsupported exercise type: ${unitItem.type}`);
    }

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
