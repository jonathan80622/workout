import { NextResponse } from 'next/server';
import { prisma } from '@/src/server/db';
import { createSession, SESSION_COOKIE, sessionCookieOptions } from '@/src/server/auth';
import { InvalidGoogleTokenError, verifyGoogleAccessToken } from '@/src/server/google';

export const runtime = 'nodejs';

// Exchanges a Google access token from the browser popup for an app session.
// Only a Google account already recorded as a user's auth_subject can sign in; nothing is created here.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (typeof body?.accessToken !== 'string' || !body.accessToken) {
    return NextResponse.json({ error: 'Missing Google access token.' }, { status: 400 });
  }

  try {
    const { googleSub, grantedDrive } = await verifyGoogleAccessToken(body.accessToken);
    if (!grantedDrive) {
      return NextResponse.json({ error: 'Google Drive access is required to sign in. Sign in again and allow Drive.' }, { status: 403 });
    }
    const user = await prisma.user.findUnique({ where: { authSubject: googleSub }, select: { id: true } });
    if (!user) return NextResponse.json({ error: 'This Google account does not have access to this app.' }, { status: 403 });

    const response = new NextResponse(null, { status: 204 });
    response.cookies.set(SESSION_COOKIE, await createSession(user.id), sessionCookieOptions());
    return response;
  } catch (error) {
    if (error instanceof InvalidGoogleTokenError) return NextResponse.json({ error: 'Google sign-in was not accepted.' }, { status: 401 });
    console.error('[auth] sign-in failed:', error);
    return NextResponse.json({ error: 'Sign-in failed. Try again.' }, { status: 503 });
  }
}
