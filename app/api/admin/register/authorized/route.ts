import { NextRequest } from 'next/server';
import { apiResponse } from '@/lib/api-utils';
import { isAdminRegAuthorized } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const authorized = isAdminRegAuthorized(req);
  return apiResponse(200, { authorized }, null);
}

