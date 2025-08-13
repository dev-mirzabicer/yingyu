import { prisma } from '@/lib/db';
import { StudentStatus } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

const AUTH_COOKIE_NAME = process.env.AUTH_COOKIE_NAME || 'yingyu_session';
const SESSION_TTL_DAYS = parseInt(process.env.SESSION_TTL_DAYS || '14', 10);
const ADMIN_REG_COOKIE_NAME = process.env.ADMIN_REG_COOKIE_NAME || 'yingyu_admin_reg';
const ADMIN_REG_TTL_MIN = parseInt(process.env.ADMIN_REG_TTL_MIN || '15', 10);
const ADMIN_REG_SECRET = process.env.ADMIN_REGISTRATION_KEY || '';

export class AuthenticationError extends Error {
  constructor(message = 'Invalid credentials.') {
    super(message);
    this.name = 'AuthenticationError';
  }
}

/**
 * A custom error class for authorization failures.
 */
export class AuthorizationError extends Error {
  constructor(message = 'You are not authorized to perform this action.') {
    super(message);
    this.name = 'AuthorizationError';
  }
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function parseCookieHeader(cookieHeader: string | null): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!cookieHeader) return cookies;
  for (const part of cookieHeader.split(';')) {
    const [rawName, ...rest] = part.trim().split('=');
    const name = rawName?.trim();
    const value = rest.join('=').trim();
    if (name) cookies[name] = decodeURIComponent(value);
  }
  return cookies;
}

export function getSessionTokenFromRequest(req: Request | NextRequest): string | null {
  // Prefer NextRequest.cookies() if available
  const anyReq = req as any;
  try {
    if (anyReq?.cookies && typeof anyReq.cookies.get === 'function') {
      const c = anyReq.cookies.get(AUTH_COOKIE_NAME);
      return c?.value || null;
    }
  } catch {}
  const cookieHeader = req.headers.get('cookie');
  const cookies = parseCookieHeader(cookieHeader);
  return cookies[AUTH_COOKIE_NAME] || null;
}

export function attachSessionCookie(res: NextResponse, rawToken: string) {
  const maxAge = SESSION_TTL_DAYS * 24 * 60 * 60; // seconds
  const secure = process.env.NODE_ENV === 'production';
  res.cookies.set({
    name: AUTH_COOKIE_NAME,
    value: rawToken,
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path: '/',
    maxAge,
  });
}

export function clearSessionCookie(res: NextResponse) {
  res.cookies.set({
    name: AUTH_COOKIE_NAME,
    value: '',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  });
}

/**
 * Reads the session cookie, validates it against the DB, and returns teacherId.
 * If invalid/expired and in dev with ALLOW_HEADER_AUTH=1, falls back to X-Teacher-ID.
 */
export async function requireAuth(req: NextRequest): Promise<string> {
  const token = getSessionTokenFromRequest(req);
  if (token) {
    const tokenHash = hashToken(token);
    const session = await prisma.authSession.findUnique({
      where: { tokenHash },
      select: { teacherId: true, expiresAt: true },
    });
    if (session && session.expiresAt > new Date()) {
      return session.teacherId;
    }
  }

  // Temporary dev-only compatibility to ease rollout
  if (process.env.ALLOW_HEADER_AUTH === '1') {
    const teacherId = req.headers.get('X-Teacher-ID');
    if (teacherId) return teacherId;
  }

  throw new AuthenticationError('Unauthorized');
}

/**
 * Verifies that a teacher has the authority to perform an action on a student resource.
 * This is a critical security and business logic function.
 *
 * @param teacherId The ID of the teacher performing the action.
 * @param studentId The ID of the student being accessed.
 * @param options.checkIsActive If true, the function will also throw an error if the student is not in 'ACTIVE' status.
 * @throws {AuthorizationError} if the student does not exist, does not belong to the teacher, or fails the active status check.
 * @returns A promise that resolves to void if the teacher is authorized.
 */
export async function authorizeTeacherForStudent(
  teacherId: string,
  studentId: string,
  options: { checkIsActive: boolean } = { checkIsActive: false }
): Promise<void> {
  if (!teacherId || !studentId) {
    throw new AuthorizationError('Invalid teacher or student ID provided.');
  }

  // The global Prisma extension already filters for `isArchived: false`.
  const student = await prisma.student.findFirst({
    where: {
      id: studentId,
      teacherId: teacherId,
    },
    select: {
      id: true,
      status: true,
    },
  });

  if (!student) {
    throw new AuthorizationError(
      'Access denied: The specified student does not exist or you do not have permission to access them.'
    );
  }

  // If the 'checkIsActive' option is enabled, perform the status check.
  if (options.checkIsActive && student.status !== StudentStatus.ACTIVE) {
    throw new AuthorizationError(
      `Operation failed: Student is not active (status: ${student.status}).`
    );
  }
}

// -------------------- Admin Registration Session (HMAC-signed cookie) --------------------

type AdminRegPayload = { iat: number; exp: number };

function base64url(input: Buffer) {
  return input.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function signAdminPayload(payload: AdminRegPayload): string {
  if (!ADMIN_REG_SECRET) {
    throw new Error('ADMIN_REGISTRATION_KEY is not set');
  }
  const header = base64url(Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'ARJ' })));
  const body = base64url(Buffer.from(JSON.stringify(payload)));
  const data = `${header}.${body}`;
  const sig = crypto.createHmac('sha256', ADMIN_REG_SECRET).update(data).digest();
  return `${data}.${base64url(sig)}`;
}

function verifyAdminToken(token: string): boolean {
  try {
    if (!ADMIN_REG_SECRET) return false;
    const [headerB64, bodyB64, sigB64] = token.split('.');
    if (!headerB64 || !bodyB64 || !sigB64) return false;
    const data = `${headerB64}.${bodyB64}`;
    const expected = base64url(crypto.createHmac('sha256', ADMIN_REG_SECRET).update(data).digest());
    if (expected !== sigB64) return false;
    const bodyJson = Buffer.from(bodyB64.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString();
    const payload = JSON.parse(bodyJson) as AdminRegPayload;
    if (typeof payload.exp !== 'number') return false;
    return Date.now() < payload.exp;
  } catch {
    return false;
  }
}

export function attachAdminRegCookie(res: NextResponse) {
  const iat = Date.now();
  const exp = iat + ADMIN_REG_TTL_MIN * 60 * 1000;
  const token = signAdminPayload({ iat, exp });
  res.cookies.set({
    name: ADMIN_REG_COOKIE_NAME,
    value: token,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: ADMIN_REG_TTL_MIN * 60,
  });
}

export function clearAdminRegCookie(res: NextResponse) {
  res.cookies.set({
    name: ADMIN_REG_COOKIE_NAME,
    value: '',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  });
}

export function getAdminRegTokenFromRequest(req: Request | NextRequest): string | null {
  const anyReq = req as any;
  try {
    if (anyReq?.cookies && typeof anyReq.cookies.get === 'function') {
      const c = anyReq.cookies.get(ADMIN_REG_COOKIE_NAME);
      return c?.value || null;
    }
  } catch {}
  const cookieHeader = req.headers.get('cookie');
  const cookies = parseCookieHeader(cookieHeader);
  return cookies[ADMIN_REG_COOKIE_NAME] || null;
}

export function isAdminRegAuthorized(req: NextRequest): boolean {
  const token = getAdminRegTokenFromRequest(req);
  if (!token) return false;
  return verifyAdminToken(token);
}

export function requireAdminReg(req: NextRequest): void {
  if (!isAdminRegAuthorized(req)) {
    throw new AuthenticationError('Unauthorized');
  }
}
