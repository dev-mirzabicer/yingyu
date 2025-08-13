
import { NextRequest } from 'next/server';
import { ContentService } from '@/lib/actions/content';
import { apiResponse, handleApiError } from '@/lib/api-utils';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth';


const ReorderItemsBodySchema = z.object({
  orderedIds: z.array(z.string().uuid()),
});

/**
 * PUT /api/units/{unitId}/items/reorder
 * Reorders the UnitItems within a Unit based on a provided array of IDs.
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ unitId: string }> }
) {
  try {
    const teacherId = await requireAuth(req);

    const { unitId } = await params;
    const body = await req.json();
    const { orderedIds } = ReorderItemsBodySchema.parse(body);

    const updatedUnit = await ContentService.reorderUnitItems(
      unitId,
      teacherId,
      orderedIds
    );

    return apiResponse(200, updatedUnit, null);
  } catch (error) {
    return handleApiError(error);
  }
}
