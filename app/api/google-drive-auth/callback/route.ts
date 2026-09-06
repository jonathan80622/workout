import { createCipheriv, createHash, randomBytes } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';

const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const STATE_COOKIE = 'workout_drive_oauth_state';
const CREDENTIAL_FIELD = 'serverDriveCredential';
const TOKEN_STORAGE_KEY = 'workout-recorder-google-token';

function encryptRefreshToken(refreshToken: string, secret: string) {
  const key = createHash('sha256').update(secret).digest();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(refreshToken, 'utf8'), cipher.final()]);
  return `v1.${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${ciphertext.toString('base64url')}`;
}

export async function GET(request: NextRequest) {
  const expectedState = request.cookies.get(STATE_COOKIE)?.value;
  const state = request.nextUrl.searchParams.get('state');
  const code = request.nextUrl.searchParams.get('code');
  if (!expectedState || !state || state !== expectedState || !code) {
    return new Response('Invalid or expired Google authorization response.', { status: 400 });
  }

  const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return new Response('Google server OAuth is not configured.', { status: 500 });

  const redirectUri = `${request.nextUrl.origin}/api/google-drive-auth/callback`;
  const tokenResponse = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
    }),
    cache: 'no-store',
  });
  const tokens = await tokenResponse.json().catch(() => null) as {
    access_token?: string;
    refresh_token?: string;
    error_description?: string;
  } | null;
  if (!tokenResponse.ok || !tokens?.access_token || !tokens?.refresh_token) {
    return new Response(tokens?.error_description || 'Google did not return durable Drive authorization.', { status: 502 });
  }

  const q = encodeURIComponent("name='workout-data.json' and trashed=false");
  const listResponse = await fetch(
    `${DRIVE_API}/files?q=${q}&orderBy=modifiedTime%20desc&fields=files(id,name,modifiedTime)&pageSize=10`,
    {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
      cache: 'no-store',
    }
  );
  const list = await listResponse.json().catch(() => null) as { files?: Array<{ id: string }> } | null;
  const dataFileId = list?.files?.[0]?.id;
  if (!listResponse.ok || !dataFileId) {
    return new Response('Authorized Drive, but could not find workout-data.json created by this app.', { status: 404 });
  }

  const dataResponse = await fetch(`${DRIVE_API}/files/${encodeURIComponent(dataFileId)}?alt=media`, {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
    cache: 'no-store',
  });
  const workoutState = await dataResponse.json().catch(() => null) as Record<string, any> | null;
  if (!dataResponse.ok || !workoutState) return new Response('Could not read workout-data.json.', { status: 502 });

  workoutState.profile = {
    ...(workoutState.profile || {}),
    [CREDENTIAL_FIELD]: encryptRefreshToken(tokens.refresh_token, clientSecret),
  };

  const saveResponse = await fetch(`${DRIVE_UPLOAD_API}/files/${encodeURIComponent(dataFileId)}?uploadType=media`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${tokens.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(workoutState, null, 2),
    cache: 'no-store',
  });
  if (!saveResponse.ok) {
    return new Response('Authorized Drive, but could not persist the server playback credential.', { status: 502 });
  }

  const accessTokenLiteral = JSON.stringify(tokens.access_token);
  const storageKeyLiteral = JSON.stringify(TOKEN_STORAGE_KEY);
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Drive connected</title></head><body><script>sessionStorage.setItem(${storageKeyLiteral}, ${accessTokenLiteral});window.location.replace('/');</script></body></html>`;
  const response = new NextResponse(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
  response.cookies.delete(STATE_COOKIE);
  return response;
}
