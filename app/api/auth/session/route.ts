import { NextResponse } from 'next/server';
import { prisma } from '@/src/server/db';
import { createSession, SESSION_COOKIE, sessionCookieOptions } from '@/src/server/auth';
import { InvalidGoogleTokenError, verifyGoogleAccessToken } from '@/src/server/google';

export const runtime = 'nodejs';

// Exchanges a Google access token from the browser popup for an app session.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (typeof body?.accessToken !== 'string' || !body.accessToken) {
    return NextResponse.json({ error: 'Missing Google access token.' }, { status: 400 });
  }

  try {
    const { googleSub, email } = await verifyGoogleAccessToken(body.accessToken);
    const account = await prisma.account.upsert({
      where: { googleSub },
      create: { googleSub, email },
      update: { email },
    });
    const response = NextResponse.json({ linked: Boolean(account.ownerUserId) });
    response.cookies.set(SESSION_COOKIE, await createSession(account.id), sessionCookieOptions());
    return response;
  } catch (error) {
    if (error instanceof InvalidGoogleTokenError) return NextResponse.json({ error: 'Google sign-in was not accepted.' }, { status: 401 });
    console.error('[auth] sign-in failed:', error);
    return NextResponse.json({ error: 'Sign-in failed. Try again.' }, { status: 503 });
  }
}
