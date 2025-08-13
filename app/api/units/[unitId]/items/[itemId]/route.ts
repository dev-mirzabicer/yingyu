import { NextRequest } from 'next/server';
import { ContentService } from '@/lib/actions/content';
import { apiResponse, handleApiError } from '@/lib/api-utils';
import { prisma } from '@/lib/db';
import { AuthorizationError, requireAuth } from '@/lib/auth';

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ unitId: string; itemId: string }> }
) {
  try {
    const teacherId = await requireAuth(req);

    const { unitId, itemId } = await params;

    // Meticulous Authorization: Ensure the teacher owns the parent unit before deleting an item from it.
    const item = await prisma.unitItem.findUnique({
      where: { id: itemId },
      include: { unit: { select: { creatorId: true } } },
    });

    if (!item || item.unitId !== unitId) {
      return apiResponse(404, null, 'Item not found in the specified unit.');
    }

    if (item.unit.creatorId !== teacherId) {
      throw new AuthorizationError('You are not authorized to modify this unit.');
    }

    const deletedItem = await ContentService.removeUnitItem(itemId);

    return apiResponse(200, deletedItem, null);
  } catch (error) {
    return handleApiError(error);
  }
}

