import { NextRequest } from 'next/server';
import { StudentService } from '@/lib/actions/students';
import { apiResponse, handleApiError } from '@/lib/api-utils';
import { RecordPaymentSchema } from '@/lib/schemas';
import { authorizeTeacherForStudent, requireAuth } from '@/lib/auth';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ studentId: string }> }
) {
  try {
    const teacherId = await requireAuth(req);
    const { studentId } = await params;
    await authorizeTeacherForStudent(teacherId, studentId);

    const payments = await StudentService.getPaymentsForStudent(studentId);

    return apiResponse(200, payments, null);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ studentId: string }> }
) {
  try {
    // 1. Authentication & Authorization
    const teacherId = await requireAuth(req);
    // The service method below will perform the necessary authorization check.

    // 2. Parameter & Body Validation
    const { studentId } = await params;
    const body = await req.json();
    const paymentData = RecordPaymentSchema.parse(body);

    // 3. Delegate to Service Layer
    const newPayment = await StudentService.recordPayment(
      studentId,
      teacherId,
      paymentData
    );

    // 4. Return Success Response
    return apiResponse(201, newPayment, null);
  } catch (error) {
    // 5. Centralized Error Handling
    return handleApiError(error);
  }
}

