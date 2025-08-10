import { NextRequest } from 'next/server';
import { SessionService } from '@/lib/actions/sessions';
import { apiResponse, handleApiError } from '@/lib/api-utils';
import { z } from 'zod';

const StartSessionBodySchema = z.object({
  studentId: z.string().uuid(),
  unitId: z.string().uuid(),
  configOverrides: z.record(z.any(), z.any()).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const teacherId = req.headers.get('X-Teacher-ID');
    if (!teacherId) {
      return apiResponse(401, null, 'Unauthorized: Missing X-Teacher-ID header.');
    }

    const body = await req.json();
    const { studentId, unitId, configOverrides } = StartSessionBodySchema.parse(body);

    const initialState = await SessionService.startSession(
      teacherId,
      studentId,
      unitId,
      configOverrides
    );

    return apiResponse(201, initialState, null);
  } catch (error) {
    return handleApiError(error);
  }
}

