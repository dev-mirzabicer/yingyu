import { NextRequest } from 'next/server';
import { AuthService } from '@/lib/actions/auth';
import { apiResponse, handleApiError } from '@/lib/api-utils';
import { LoginSchema } from '@/lib/schemas';
import { NextResponse } from 'next/server';
import { attachSessionCookie } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { username, password } = LoginSchema.parse(body);
    const { teacher, rawToken } = await AuthService.login(username, password, req.headers);
    const res = apiResponse(200, teacher, null) as NextResponse;
    attachSessionCookie(res, rawToken);
    return res;
  } catch (error) {
    return handleApiError(error);
  }
}

