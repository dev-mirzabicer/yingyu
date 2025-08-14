import { NextRequest } from 'next/server';
import { apiResponse, handleApiError } from '@/lib/api-utils';
import { requireAdminReg } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { z } from 'zod';

const TopupSchema = z.object({ 
  days: z.number().int().positive() 
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ teacherId: string }> }) {
  try {
    requireAdminReg(req);
    const body = await req.json();
    const { days } = TopupSchema.parse(body);
    const { teacherId } = await params;

    // Get current teacher validity
    const teacher = await prisma.teacher.findUnique({
      where: { id: teacherId },
      select: { validityUntil: true, name: true }
    });

    if (!teacher) {
      return apiResponse(404, null, 'Teacher not found');
    }

    // Calculate new validity: if current is in future, add to that; otherwise add to now
    const now = new Date();
    const anchor = teacher.validityUntil && teacher.validityUntil > now ? teacher.validityUntil : now;
    const newValidity = new Date(anchor.getTime() + (days * 86400000));

    // Update the teacher
    const updatedTeacher = await prisma.teacher.update({
      where: { id: teacherId },
      data: { validityUntil: newValidity },
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