import { prisma } from '@/lib/db';
import { AuthenticationError, hashToken } from '@/lib/auth';
import bcrypt from 'bcryptjs';

export type LoginResult = {
  teacher: {
    id: string;
    name: string;
    email: string;
    timezone: string;
  };
  rawToken: string; // caller must set cookie and never return this to client
};

function getSessionExpiry(): Date {
  const ttlDays = parseInt(process.env.SESSION_TTL_DAYS || '14', 10);
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + ttlDays);
  return d;
}

function getIpFromHeaders(headers: Headers): string | undefined {
  const xff = headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  const xrip = headers.get('x-real-ip');
  if (xrip) return xrip;
  return undefined;
}

export const AuthService = {
  async login(username: string, password: string, headers?: Headers): Promise<LoginResult> {
    const teacher = await prisma.teacher.findUnique({
      where: { email: username },
    });
    if (!teacher) {
      throw new AuthenticationError('Invalid username or password');
    }
    const ok = await bcrypt.compare(password, teacher.passwordHash);
    if (!ok) throw new AuthenticationError('Invalid username or password');

    // Check validity period
    if (teacher.validityUntil && new Date() > teacher.validityUntil) {
      throw new AuthenticationError('Account expired');
    }

    // Create a new session
    const rawToken = (await import('crypto')).randomBytes(32).toString('base64url');
    const tokenHash = hashToken(rawToken);
    await prisma.authSession.create({
      data: {
        teacherId: teacher.id,
        tokenHash,
        expiresAt: getSessionExpiry(),
        userAgent: headers?.get('user-agent') || undefined,
        ip: headers ? getIpFromHeaders(headers) : undefined,
      },
    });

    // Update lastLoginAt
    await prisma.teacher.update({
      where: { id: teacher.id },
      data: { lastLoginAt: new Date() },
    });

    return {
      teacher: {
        id: teacher.id,
        name: teacher.name,
        email: teacher.email,
        timezone: teacher.timezone,
      },
      rawToken,
    };
  },

  async logout(rawToken: string): Promise<void> {
    const tokenHash = hashToken(rawToken);
    await prisma.authSession.deleteMany({ where: { tokenHash } });
  },

  async getMe(rawToken: string) {
    const tokenHash = hashToken(rawToken);
    const session = await prisma.authSession.findUnique({
      where: { tokenHash },
      include: { teacher: true },
    });
    if (!session || session.expiresAt <= new Date()) {
      throw new AuthenticationError('Unauthorized');
    }
    // Touch lastUsedAt
    await prisma.authSession.update({ where: { tokenHash }, data: { lastUsedAt: new Date() } });
    const t = session.teacher;
    return { 
      id: t.id, 
      name: t.name, 
      email: t.email, 
      timezone: t.timezone, 
      validityUntil: t.validityUntil 
    };
  },
};
