import { NextRequest } from 'next/server';
import { apiResponse, handleApiError } from '@/lib/api-utils';
import { AuthService } from '@/lib/actions/auth';
import { getSessionTokenFromRequest } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const token = getSessionTokenFromRequest(req);
    if (!token) {
      return apiResponse(401, null, 'Unauthorized');
    }
    const me = await AuthService.getMe(token);
    return apiResponse(200, me, null);
  } catch (error) {
    return handleApiError(error);
  }
}

