import { NextRequest, NextResponse } from 'next/server';
import { apiResponse, handleApiError } from '@/lib/api-utils';
import { z } from 'zod';
import { attachAdminRegCookie } from '@/lib/auth';

const BodySchema = z.object({ key: z.string().min(1) });

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { key } = BodySchema.parse(body);
    if (!process.env.ADMIN_REGISTRATION_KEY || key !== process.env.ADMIN_REGISTRATION_KEY) {
      return apiResponse(401, null, 'Unauthorized');
    }

    const res = apiResponse(200, { authorized: true }, null) as NextResponse;
    attachAdminRegCookie(res);
    return res;
  } catch (error) {
    return handleApiError(error);
  }
}

