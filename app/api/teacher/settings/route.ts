import { NextRequest } from 'next/server';
import { TeacherService } from '@/lib/actions/teacher';
import { apiResponse, handleApiError } from '@/lib/api-utils';
import { UpdateTeacherSettingsSchema } from '@/lib/schemas';
import { requireAuth } from '@/lib/auth';

/**
 * GET /api/teacher/settings
 * Retrieves the settings for the authenticated teacher.
 */
export async function GET(req: NextRequest) {
  try {
    const teacherId = await requireAuth(req);

    const settings = await TeacherService.getSettings(teacherId);
    return apiResponse(200, settings, null);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * PUT /api/teacher/settings
 * Updates the settings for the authenticated teacher.
 */
export async function PUT(req: NextRequest) {
  try {
    const teacherId = await requireAuth(req);

    const body = await req.json();
    const settingsData = UpdateTeacherSettingsSchema.parse(body);

    const updatedSettings = await TeacherService.updateSettings(
      teacherId,
      settingsData
    );

    return apiResponse(200, updatedSettings, null);
  } catch (error) {
    return handleApiError(error);
  }
}

