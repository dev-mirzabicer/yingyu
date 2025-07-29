import { NextRequest } from 'next/server';
import { ContentService } from '@/lib/actions/content';
import { apiResponse, handleApiError } from '@/lib/api-utils';

export async function GET(req: NextRequest) {
  try {
    const teacherId = req.headers.get('X-Teacher-ID');
    if (!teacherId) {
      return apiResponse(401, null, 'Unauthorized: Missing X-Teacher-ID header.');
    }

    const decks = await ContentService.getDecksForTeacher(teacherId);
    return apiResponse(200, decks, null);
  } catch (error) {
    return handleApiError(error);
  }
}