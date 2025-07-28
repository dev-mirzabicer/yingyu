import { NextRequest } from 'next/server';
import { OnboardingWorkflow } from '@/lib/workflows/onboarding';
import { apiResponse, handleApiError } from '@/lib/api-utils';
import { CreateStudentSchema } from '@/lib/schemas';
import { z } from 'zod';

const OnboardStudentBodySchema = z.object({
  studentData: CreateStudentSchema,
  initialDeckId: z.string().uuid(),
});

export async function POST(req: NextRequest) {
  try {
    // 1. Authentication (Development Placeholder)
    const teacherId = req.headers.get('X-Teacher-ID');
    if (!teacherId) {
      return apiResponse(401, null, 'Unauthorized: Missing X-Teacher-ID header.');
    }

    // 2. Parse and Validate Request Body
    const body = await req.json();
    const { studentData, initialDeckId } = OnboardStudentBodySchema.parse(body);

    // 3. Call the Workflow Layer
    const result = await OnboardingWorkflow.onboardStudentWithInitialDeck({
      teacherId,
      studentData,
      initialDeckId,
    });

    // 4. Return Success Response
    return apiResponse(201, result, null);
  } catch (error) {
    // 5. Centralized Error Handling
    return handleApiError(error);
  }
}
