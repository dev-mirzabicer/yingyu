import { NextRequest } from 'next/server';
import { AuthService } from '@/lib/actions/auth';
import { apiResponse, handleApiError } from '@/lib/api-utils';
import { NextResponse } from 'next/server';
import { clearSessionCookie, getSessionTokenFromRequest } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const token = getSessionTokenFromRequest(req);
    const res = apiResponse(200, { loggedOut: true }, null) as NextResponse;
    clearSessionCookie(res);
    if (token) {
      await AuthService.logout(token);
    }
    return res;
  } catch (error) {
    return handleApiError(error);
  }
}

