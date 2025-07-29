import { NextRequest } from 'next/server';
import { StudentService } from '@/lib/actions/students';
import { apiResponse, handleApiError } from '@/lib/api-utils';
import { UpdateScheduleSchema } from '@/lib/schemas';

/**
 * PUT /api/schedules/[scheduleId]
 * Updates an existing class schedule (e.g., reschedules or changes status).
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: { scheduleId: string } }
) {
  try {
    const teacherId = req.headers.get('X-Teacher-ID');
    if (!teacherId) {
      return apiResponse(401, null, 'Unauthorized: Missing X-Teacher-ID header.');
    }

    const { scheduleId } = params;
    const body = await req.json();
    const updateData = UpdateScheduleSchema.parse(body);

    const updatedSchedule = await StudentService.updateSchedule(
      scheduleId,
      teacherId,
      updateData
    );

    return apiResponse(200, updatedSchedule, null);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * DELETE /api/schedules/[scheduleId]
 * Deletes a class schedule.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { scheduleId: string } }
) {
  try {
    const teacherId = req.headers.get('X-Teacher-ID');
    if (!teacherId) {
      return apiResponse(401, null, 'Unauthorized: Missing X-Teacher-ID header.');
    }

    const { scheduleId } = params;

    const deletedSchedule = await StudentService.deleteSchedule(
      scheduleId,
      teacherId
    );

    return apiResponse(200, deletedSchedule, null);
  } catch (error) {
    return handleApiError(error);
  }
}

