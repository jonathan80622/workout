import { NextResponse } from 'next/server';
import { prisma } from '@/src/server/db';
import { encryptSecret, readCookie, SESSION_COOKIE, SESSION_MAX_AGE_SECONDS, signSession } from '@/src/server/auth';
import { appUrl, callbackUrl, exchangeCode, OAUTH_STATE_COOKIE } from '@/src/server/google';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const fail = (reason: string) => {
    const response = NextResponse.redirect(appUrl(request, `/?auth_error=${reason}`));
    response.cookies.delete({ name: OAUTH_STATE_COOKIE, path: '/api/auth/google' });
    return response;
  };

  if (url.searchParams.get('error')) return fail('denied');
  const [expectedState, codeVerifier, consentWasForced] = readCookie(request, OAUTH_STATE_COOKIE)?.split('.') ?? [];
  const code = url.searchParams.get('code');
  if (!code || !expectedState || !codeVerifier || url.searchParams.get('state') !== expectedState) return fail('state');

  try {
    const grant = await exchangeCode({ code, redirectUri: callbackUrl(request), codeVerifier });
    // Keep a refresh token only when it can reach Drive; a missing one is fixed by signing in again with consent.
    const refresh = grant.refreshToken && grant.grantedDrive ? { encryptedRefreshToken: encryptSecret(grant.refreshToken) } : {};
    const account = await prisma.account.upsert({
      where: { googleSub: grant.googleSub },
      create: { googleSub: grant.googleSub, email: grant.email, ...refresh },
      update: { email: grant.email, ...refresh },
    });

    // Google withholds the refresh token when consent was skipped; ask once more with consent.
    if (!account.encryptedRefreshToken && grant.grantedDrive && consentWasForced !== '1') {
      const response = NextResponse.redirect(appUrl(request, '/api/auth/google?consent=1'));
      response.cookies.set(SESSION_COOKIE, signSession(account.id), sessionCookieOptions());
      return response;
    }

    const response = NextResponse.redirect(appUrl(request, '/'));
    response.cookies.delete({ name: OAUTH_STATE_COOKIE, path: '/api/auth/google' });
    response.cookies.set(SESSION_COOKIE, signSession(account.id), sessionCookieOptions());
    return response;
  } catch (error) {
    console.error('[auth] sign-in callback failed:', error);
    return fail('google');
  }
}

function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
  };
}
