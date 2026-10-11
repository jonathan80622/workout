import { createCipheriv, createDecipheriv, createHmac, hkdfSync, randomBytes, timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { prisma } from '@/src/server/db';

export const SESSION_COOKIE = 'workout_session';
export const SESSION_MAX_AGE_SECONDS = 90 * 24 * 60 * 60;

export class AuthConfigError extends Error {}

// AUTH_SECRET is the only auth secret; separate keys are derived so the session
// signature and the refresh-token encryption never share key material.
function deriveKey(purpose: string): Buffer {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) throw new AuthConfigError('AUTH_SECRET is not configured.');
  return Buffer.from(hkdfSync('sha256', secret, Buffer.alloc(0), purpose, 32));
}

export function signSession(accountId: string, now = Date.now()): string {
  const payload = `${accountId}.${Math.floor(now / 1000) + SESSION_MAX_AGE_SECONDS}`;
  return `${payload}.${createHmac('sha256', deriveKey('session')).update(payload).digest('base64url')}`;
}

export function readSessionAccountId(request: Request, now = Date.now()): string | null {
  const value = readCookie(request, SESSION_COOKIE);
  const [accountId, expires, signature] = value?.split('.') ?? [];
  if (!accountId || !expires || !signature) return null;

  const expected = createHmac('sha256', deriveKey('session')).update(`${accountId}.${expires}`).digest();
  const given = Buffer.from(signature, 'base64url');
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  if (Number(expires) * 1000 <= now) return null;
  return accountId;
}

export function readCookie(request: Request, name: string): string | null {
  for (const part of request.headers.get('cookie')?.split(';') ?? []) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return decodeURIComponent(rest.join('='));
  }
  return null;
}

export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', deriveKey('refresh-token'), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted].map((part) => part.toString('base64url')).join('.');
}

export function decryptSecret(stored: string): string {
  const [iv, tag, encrypted] = stored.split('.').map((part) => Buffer.from(part, 'base64url'));
  const decipher = createDecipheriv('aes-256-gcm', deriveKey('refresh-token'), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}

/**
 * Resolves the data owner for the signed-in account.
 * 401 when nobody is signed in; 403 when the account is not linked to an owner yet.
 */
export async function requireOwner(request: Request): Promise<{ ownerId: string } | NextResponse> {
  let accountId: string | null;
  try {
    accountId = readSessionAccountId(request);
  } catch (error) {
    console.error('[auth]', error);
    return NextResponse.json({ error: 'Sign-in is not configured.' }, { status: 500 });
  }
  if (!accountId) return NextResponse.json({ error: 'Sign in to continue.' }, { status: 401 });

  const account = await prisma.account.findUnique({ where: { id: accountId }, select: { ownerUserId: true } });
  if (!account) return NextResponse.json({ error: 'Sign in to continue.' }, { status: 401 });
  if (!account.ownerUserId) {
    return NextResponse.json({ error: 'This Google account is not linked to workout data.' }, { status: 403 });
  }
  return { ownerId: account.ownerUserId };
}
