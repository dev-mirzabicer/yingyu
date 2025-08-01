import { NextRequest } from 'next/server';
import { ContentService } from '@/lib/actions/content';
import { apiResponse, handleApiError } from '@/lib/api-utils';
import { UpdateUnitSchema } from '@/lib/schemas';
import { prisma } from '@/lib/db';
import { AuthorizationError } from '@/lib/auth';

export async function GET(
  req: NextRequest,
  { params }: { params: { unitId: string } }
) {
  try {
    const teacherId = req.headers.get('X-Teacher-ID');
    if (!teacherId) {
      return apiResponse(401, null, 'Unauthorized: Missing X-Teacher-ID header.');
    }

    const { unitId } = params;

    // Meticulous Authorization: Fetch the unit first to check ownership.
    const unit = await prisma.unit.findUnique({ where: { id: unitId } });
    if (!unit) {
      return apiResponse(404, null, 'Unit not found.');
    }
    if (unit.creatorId !== teacherId && !unit.isPublic) {
      throw new AuthorizationError('You are not authorized to view this unit.');
    }

    const unitDetails = await ContentService.getUnitWithDetails(unitId);
    return apiResponse(200, unitDetails, null);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(
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
    const updateData = UpdateUnitSchema.parse(body);

    // The service method handles its own authorization check.
    const updatedUnit = await ContentService.updateUnit(
      unitId,
      teacherId,
      updateData
    );

    return apiResponse(200, updatedUnit, null);
  } catch (error) {
    return handleApiError(error);
  }
}

