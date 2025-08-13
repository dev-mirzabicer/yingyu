import { NextRequest } from 'next/server';
import { StudentService } from '@/lib/actions/students';
import { apiResponse, handleApiError } from '@/lib/api-utils';
import { CreateScheduleSchema } from '@/lib/schemas';
import { requireAuth } from '@/lib/auth';

/**
 * GET /api/students/[studentId]/schedules
 * Retrieves all class schedules for a given student.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ studentId: string }> }
) {
  try {
    const teacherId = await requireAuth(req);

    const { studentId } = await params;
    const schedules = await StudentService.getSchedulesForStudent(
      studentId,
      teacherId
    );

    return apiResponse(200, schedules, null);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/students/[studentId]/schedules
 * Creates a new class schedule for a student.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ studentId: string }> }
) {
  try {
    const teacherId = await requireAuth(req);

    const { studentId } = await params;
    const body = await req.json();
    const scheduleData = CreateScheduleSchema.parse(body);

    const newSchedule = await StudentService.createSchedule(
      studentId,
      teacherId,
      scheduleData
    );

    return apiResponse(201, newSchedule, null);
  } catch (error) {
    return handleApiError(error);
  }
}

