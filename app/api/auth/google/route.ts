import { createHash, randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import { prisma } from '@/src/server/db';
import { readSessionAccountId } from '@/src/server/auth';
import { appUrl, buildAuthorizationUrl, callbackUrl, OAUTH_STATE_COOKIE } from '@/src/server/google';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const state = randomBytes(16).toString('base64url');
    const codeVerifier = randomBytes(32).toString('base64url');
    const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url');

    const accountId = readSessionAccountId(request);
    const stored = accountId
      ? await prisma.account.findUnique({ where: { id: accountId }, select: { encryptedRefreshToken: true } })
      : null;
    const forceConsent = new URL(request.url).searchParams.has('consent') || Boolean(accountId && !stored?.encryptedRefreshToken);

    const response = NextResponse.redirect(
      buildAuthorizationUrl({ redirectUri: callbackUrl(request), state, codeChallenge, forceConsent })
    );
    response.cookies.set(OAUTH_STATE_COOKIE, `${state}.${codeVerifier}.${forceConsent ? 1 : 0}`, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/api/auth/google',
      maxAge: 600,
    });
    return response;
  } catch (error) {
    console.error('[auth] sign-in start failed:', error);
    return NextResponse.redirect(appUrl(request, '/?auth_error=config'));
  }
}
