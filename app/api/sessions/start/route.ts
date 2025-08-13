import { NextRequest } from 'next/server';
import { SessionService } from '@/lib/actions/sessions';
import { apiResponse, handleApiError } from '@/lib/api-utils';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth';

const StartSessionBodySchema = z.object({
  studentId: z.string().uuid(),
  unitId: z.string().uuid(),
  configOverrides: z.record(z.any(), z.any()).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const teacherId = await requireAuth(req);

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

