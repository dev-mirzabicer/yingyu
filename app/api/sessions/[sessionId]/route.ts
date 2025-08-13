import { NextRequest } from 'next/server';
import { SessionService } from '@/lib/actions/sessions';
import { apiResponse, handleApiError } from '@/lib/api-utils';
import { requireAuth } from '@/lib/auth';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const teacherId = await requireAuth(req);

    const { sessionId } = await params;

    // The service method handles its own authorization check.
    const sessionState = await SessionService.getFullState(sessionId, teacherId);

    if (!sessionState) {
      return apiResponse(404, null, 'Session not found or you are not authorized to view it.');
    }

    return apiResponse(200, sessionState, null);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const teacherId = await requireAuth(req);

    const { sessionId } = await params;

    // The service method handles its own authorization check.
    const finalState = await SessionService.endSession(sessionId, teacherId);

    return apiResponse(200, finalState, null);
  } catch (error) {
    return handleApiError(error);
  }
}

