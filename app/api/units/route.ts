import { NextRequest } from 'next/server';
import { ContentService } from '@/lib/actions/content';
import { apiResponse, handleApiError } from '@/lib/api-utils';
import { CreateUnitSchema } from '@/lib/schemas';

export async function GET(req: NextRequest) {
  try {
    const teacherId = req.headers.get('X-Teacher-ID');
    if (!teacherId) {
      return apiResponse(401, null, 'Unauthorized: Missing X-Teacher-ID header.');
    }

    const units = await ContentService.getUnitsForTeacher(teacherId);
    return apiResponse(200, units, null);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const teacherId = req.headers.get('X-Teacher-ID');
    if (!teacherId) {
      return apiResponse(401, null, 'Unauthorized: Missing X-Teacher-ID header.');
    }

    const body = await req.json();
    const unitData = CreateUnitSchema.parse(body);

    const newUnit = await ContentService.createUnit({
      ...unitData,
      creatorId: teacherId,
    });

    return apiResponse(201, newUnit, null);
  } catch (error) {
    return handleApiError(error);
  }
}
