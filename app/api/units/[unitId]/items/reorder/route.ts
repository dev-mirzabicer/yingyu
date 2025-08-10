
import { NextRequest } from 'next/server';
import { ContentService } from '@/lib/actions/content';
import { apiResponse, handleApiError } from '@/lib/api-utils';
import { z } from 'zod';
import { getAuth } from '@clerk/nextjs/server';

const ReorderItemsBodySchema = z.object({
  orderedIds: z.array(z.string().uuid()),
});

/**
 * PUT /api/units/{unitId}/items/reorder
 * Reorders the UnitItems within a Unit based on a provided array of IDs.
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: { unitId: string } }
) {
  try {
    const { userId: teacherId } = getAuth(req);
    if (!teacherId) {
      return apiResponse(401, null, 'Unauthorized');
    }

    const body = await req.json();
    const { orderedIds } = ReorderItemsBodySchema.parse(body);

    const updatedUnit = await ContentService.reorderUnitItems(
      params.unitId,
      teacherId,
      orderedIds
    );

    return apiResponse(200, updatedUnit, null);
  } catch (error) {
    return handleApiError(error);
  }
}
