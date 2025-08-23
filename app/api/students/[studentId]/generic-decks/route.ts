import { NextRequest } from 'next/server';
import { StudentService } from '@/lib/actions/students';
import { apiResponse, handleApiError } from '@/lib/api-utils';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth';

const AssignGenericDeckBodySchema = z.object({
  deckId: z.string().uuid(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ studentId: string }> }
) {
  try {
    const teacherId = await requireAuth(req);

    const { studentId } = await params;
    const body = await req.json();
    const { deckId } = AssignGenericDeckBodySchema.parse(body);

    // The service method already returns the job, which is perfect for our test.
    const result = await StudentService.assignGenericDeckToStudent(
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