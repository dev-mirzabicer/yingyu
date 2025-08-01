import { NextRequest } from 'next/server';
import { SessionService } from '@/lib/actions/sessions';
import { apiResponse, handleApiError } from '@/lib/api-utils';

export async function GET(
  req: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    const teacherId = req.headers.get('X-Teacher-ID');
    if (!teacherId) {
      return apiResponse(401, null, 'Unauthorized: Missing X-Teacher-ID header.');
    }

    const { sessionId } = params;

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
  { params }: { params: { sessionId: string } }
) {
  try {
    const teacherId = req.headers.get('X-Teacher-ID');
    if (!teacherId) {
      return apiResponse(401, null, 'Unauthorized: Missing X-Teacher-ID header.');
    }

    const { sessionId } = params;

    // The service method handles its own authorization check.
    const finalState = await SessionService.endSession(sessionId, teacherId);

    return apiResponse(200, finalState, null);
  } catch (error) {
    return handleApiError(error);
  }
}

