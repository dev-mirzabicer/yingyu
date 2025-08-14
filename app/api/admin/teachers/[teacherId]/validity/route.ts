import { NextRequest } from 'next/server';
import { apiResponse, handleApiError } from '@/lib/api-utils';
import { requireAdminReg } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { z } from 'zod';

const SetValiditySchema = z.object({ 
  validityUntil: z.coerce.date() 
});

export async function PUT(req: NextRequest, { params }: { params: Promise<{ teacherId: string }> }) {
  try {
    requireAdminReg(req);
    const body = await req.json();
    const { validityUntil } = SetValiditySchema.parse(body);
    const { teacherId } = await params;

    // Check if teacher exists
    const teacher = await prisma.teacher.findUnique({
      where: { id: teacherId },
      select: { id: true }
    });

    if (!teacher) {
      return apiResponse(404, null, 'Teacher not found');
    }

    // Update the teacher
    const updatedTeacher = await prisma.teacher.update({
      where: { id: teacherId },
      data: { validityUntil },
      select: {
        id: true,
        name: true,
        email: true,
        timezone: true,
        createdAt: true,
        lastLoginAt: true,
        validityUntil: true
      }
    });

    // Add computed daysRemaining field
    const teacherWithDaysRemaining = {
      ...updatedTeacher,
      daysRemaining: updatedTeacher.validityUntil ? 
        Math.max(0, Math.ceil((updatedTeacher.validityUntil.getTime() - Date.now()) / 86400000)) : 
        null
    };

    return apiResponse(200, teacherWithDaysRemaining, null);
  } catch (error) {
    return handleApiError(error);
  }
}