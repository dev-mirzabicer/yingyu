import { NextRequest } from 'next/server';
import { StudentService } from '@/lib/actions/students';
import { apiResponse, handleApiError } from '@/lib/api-utils';
import { z } from 'zod';

const AssignDeckBodySchema = z.object({
  deckId: z.string().uuid(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { studentId: string } }
) {
  try {
    const teacherId = req.headers.get('X-Teacher-ID');
    if (!teacherId) {
      return apiResponse(401, null, 'Unauthorized: Missing X-Teacher-ID header.');
    }

    const { studentId } = params;
    const body = await req.json();
    const { deckId } = AssignDeckBodySchema.parse(body);

    // The service method already returns the job, which is perfect for our test.
    const result = await StudentService.assignDeckToStudent(
      studentId,
      teacherId,
      deckId,
      {} // Default settings
    );

    return apiResponse(201, result, null);
  } catch (error) {
    return handleApiError(error);
  }
}

