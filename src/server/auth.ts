import { createHash, randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import { prisma } from '@/src/server/db';

export const SESSION_COOKIE = 'workout_session';
export const SESSION_MAX_AGE_SECONDS = 90 * 24 * 60 * 60;

// Sessions are random tokens looked up in Postgres, so no signing key is needed.
// Only the hash is stored: a database read alone cannot be replayed as a cookie.
function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('base64url');
}

export async function createSession(accountId: string, now = Date.now()): Promise<string> {
  const token = randomBytes(32).toString('base64url');
  await prisma.session.create({
    data: { tokenHash: hashToken(token), accountId, expiresAt: new Date(now + SESSION_MAX_AGE_SECONDS * 1000) },
  });
  return token;
}

export async function readSessionAccountId(request: Request, now = Date.now()): Promise<string | null> {
  const token = readCookie(request, SESSION_COOKIE);
  if (!token) return null;
  const session = await prisma.session.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!session || session.expiresAt.getTime() <= now) return null;
  return session.accountId;
}

export async function deleteSession(request: Request): Promise<void> {
  const token = readCookie(request, SESSION_COOKIE);
  if (token) await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
  };
}

function readCookie(request: Request, name: string): string | null {
  for (const part of request.headers.get('cookie')?.split(';') ?? []) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return decodeURIComponent(rest.join('='));
  }
  return null;
}

/**
 * Resolves the data owner for the signed-in account.
 * 401 when nobody is signed in; 403 when the account is not linked to an owner yet.
 */
export async function requireOwner(request: Request): Promise<{ ownerId: string } | NextResponse> {
  const accountId = await readSessionAccountId(request);
  if (!accountId) return NextResponse.json({ error: 'Sign in to continue.' }, { status: 401 });

  const account = await prisma.account.findUnique({ where: { id: accountId }, select: { ownerUserId: true } });
  if (!account) return NextResponse.json({ error: 'Sign in to continue.' }, { status: 401 });
  if (!account.ownerUserId) {
    return NextResponse.json({ error: 'This Google account is not linked to workout data.' }, { status: 403 });
  }
  return { ownerId: account.ownerUserId };
}
