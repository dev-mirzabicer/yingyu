import { NextRequest, NextResponse } from 'next/server';
import { apiResponse, handleApiError } from '@/lib/api-utils';
import { clearAdminRegCookie } from '@/lib/auth';

export async function POST(_req: NextRequest) {
  try {
    const res = apiResponse(200, { revoked: true }, null) as NextResponse;
    clearAdminRegCookie(res);
    return res;
  } catch (error) {
    return handleApiError(error);
  }
}

