import { randomBytes } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';

const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
const STATE_COOKIE = 'workout_drive_oauth_state';

export async function GET(request: NextRequest) {
  const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return new Response('Set GOOGLE_DRIVE_CLIENT_SECRET in Vercel. The client ID reuses NEXT_PUBLIC_GOOGLE_CLIENT_ID.', { status: 500 });
  }

  const state = randomBytes(24).toString('base64url');
  const redirectUri = `${request.nextUrl.origin}/api/google-drive-auth/callback`;
  const authorizationUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authorizationUrl.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: DRIVE_SCOPE,
    access_type: 'offline',
    include_granted_scopes: 'true',
    prompt: 'consent',
    state,
  }).toString();

  const response = NextResponse.redirect(authorizationUrl);
  response.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/api/google-drive-auth/callback',
    maxAge: 10 * 60,
  });
  return response;
}

export { STATE_COOKIE };
