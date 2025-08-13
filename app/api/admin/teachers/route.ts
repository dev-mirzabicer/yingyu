import { NextRequest } from 'next/server';
import { apiResponse, handleApiError } from '@/lib/api-utils';
import { requireAdminReg } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { z } from 'zod';
import bcrypt from 'bcryptjs';

const CreateTeacherSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  password: z.string().min(6),
  phone: z.string().optional(),
  timezone: z.string().optional(),
  validityUntil: z.coerce.date().optional(),
  validityDays: z.number().int().positive().optional(),
}).refine((v) => v.validityUntil || v.validityDays, { message: 'Provide validityUntil or validityDays' });

export async function GET(req: NextRequest) {
  try {
    requireAdminReg(req);
    
    const teachers = await prisma.teacher.findMany({
      select: { 
        id: true, 
        name: true, 
        email: true, 
        timezone: true, 
        createdAt: true, 
        lastLoginAt: true, 
        validityUntil: true 
      },
      orderBy: { createdAt: 'desc' },
    });

    // Add computed daysRemaining field
    const teachersWithDaysRemaining = teachers.map(teacher => ({
      ...teacher,
      daysRemaining: teacher.validityUntil ? 
        Math.max(0, Math.ceil((teacher.validityUntil.getTime() - Date.now()) / 86400000)) : 
        null
    }));

    return apiResponse(200, teachersWithDaysRemaining, null);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    requireAdminReg(req);
    const body = await req.json();
    const { email, name, password, phone, timezone, validityUntil, validityDays } = CreateTeacherSchema.parse(body);

    const passwordHash = await bcrypt.hash(password, 12);

    // Compute validity
    const now = new Date();
    const computedValidity = validityUntil ?? new Date(now.getTime() + (validityDays! * 86400000));

    try {
      const teacher = await prisma.teacher.create({
        data: {
          email,
          name,
          passwordHash,
          phone,
          timezone: timezone || 'Asia/Shanghai',
          validityUntil: computedValidity,
        },
      });
      // Optionally pre-create default settings lazily via getSettings; not required here.
      return apiResponse(201, { id: teacher.id, email: teacher.email, name: teacher.name, timezone: teacher.timezone }, null);
    } catch (e: any) {
      if (e?.code === 'P2002') {
        return apiResponse(409, null, 'A teacher with this email already exists.');
      }
      throw e;
    }
  } catch (error) {
    return handleApiError(error);
  }
}

