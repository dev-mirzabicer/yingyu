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
});

export async function POST(req: NextRequest) {
  try {
    requireAdminReg(req);
    const body = await req.json();
    const { email, name, password, phone, timezone } = CreateTeacherSchema.parse(body);

    const passwordHash = await bcrypt.hash(password, 12);

    try {
      const teacher = await prisma.teacher.create({
        data: {
          email,
          name,
          passwordHash,
          phone,
          timezone: timezone || 'Asia/Shanghai',
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

