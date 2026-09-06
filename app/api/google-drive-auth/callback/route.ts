import { NextRequest, NextResponse } from 'next/server';
import { hasDriveRefreshToken, saveDriveRefreshToken } from '../../_lib/driveAuthStore';

const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const STATE_COOKIE = 'workout_drive_oauth_state';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const TOKEN_STORAGE_KEY = 'workout-recorder-google-token';
const ROOT_FOLDER_NAME = 'Workout Recorder';
const APP_DATA_FILE_NAME = 'workout-data.json';

function authHeaders(accessToken: string) {
  return { Authorization: `Bearer ${accessToken}` };
}

function escapeDriveQueryValue(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

async function getOrCreateRootFolder(accessToken: string) {
  const q = encodeURIComponent(
    `name='${escapeDriveQueryValue(ROOT_FOLDER_NAME)}' and mimeType='application/vnd.google-apps.folder' and trashed=false`
  );
  const existing = await fetch(`${DRIVE_API}/files?q=${q}&fields=files(id,name)&pageSize=10`, {
    headers: authHeaders(accessToken),
    cache: 'no-store',
  });
  const existingData = await existing.json().catch(() => null) as { files?: Array<{ id: string }> } | null;
  if (!existing.ok) throw new Error('Unable to search the Workout Recorder Drive folder.');
  if (existingData?.files?.[0]?.id) return existingData.files[0].id;

  const created = await fetch(`${DRIVE_API}/files?fields=id`, {
    method: 'POST',
    headers: { ...authHeaders(accessToken), 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: ROOT_FOLDER_NAME, mimeType: 'application/vnd.google-apps.folder' }),
    cache: 'no-store',
  });
  const folder = await created.json().catch(() => null) as { id?: string } | null;
  if (!created.ok || !folder?.id) throw new Error('Unable to create the Workout Recorder Drive folder.');
  return folder.id;
}

async function getOrCreateDataFile(accessToken: string) {
  const folderId = await getOrCreateRootFolder(accessToken);
  const q = encodeURIComponent(
    `name='${escapeDriveQueryValue(APP_DATA_FILE_NAME)}' and '${folderId}' in parents and trashed=false`
  );
  const existing = await fetch(`${DRIVE_API}/files?q=${q}&fields=files(id,name)&pageSize=10`, {
    headers: authHeaders(accessToken),
    cache: 'no-store',
  });
  const existingData = await existing.json().catch(() => null) as { files?: Array<{ id: string }> } | null;
  if (!existing.ok) throw new Error('Unable to search workout-data.json.');
  if (existingData?.files?.[0]?.id) return existingData.files[0].id;

  const metadata = JSON.stringify({ name: APP_DATA_FILE_NAME, parents: [folderId], mimeType: 'application/json' });
  const boundary = `workout-${Date.now()}`;
  const initialState = JSON.stringify({ version: 1, profile: {}, machines: [], workouts: [] });
  const body = [
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n`,
    `--${boundary}\r\nContent-Type: application/json\r\n\r\n${initialState}\r\n`,
    `--${boundary}--`,
  ].join('');
  const created = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', {
    method: 'POST',
    headers: {
      ...authHeaders(accessToken),
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body,
    cache: 'no-store',
  });
  const file = await created.json().catch(() => null) as { id?: string } | null;
  if (!created.ok || !file?.id) throw new Error('Unable to create workout-data.json.');
  return file.id;
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
  if (!tokenResponse.ok || !tokens?.access_token) {
    return new Response(tokens?.error_description || 'Google Drive authorization failed.', { status: 502 });
  }

  try {
    const dataFileId = await getOrCreateDataFile(tokens.access_token);
    if (tokens.refresh_token) {
      await saveDriveRefreshToken(dataFileId, tokens.refresh_token);
    } else if (!(await hasDriveRefreshToken(dataFileId))) {
      return new Response('Google did not return a refresh token. Revoke this app in your Google account and connect again.', { status: 502 });
    }
  } catch (error) {
    return new Response(error instanceof Error ? error.message : 'Unable to persist Drive authorization.', { status: 502 });
  }

  const accessTokenLiteral = JSON.stringify(tokens.access_token);
  const storageKeyLiteral = JSON.stringify(TOKEN_STORAGE_KEY);
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Drive connected</title></head><body><script>sessionStorage.setItem(${storageKeyLiteral}, ${accessTokenLiteral});window.location.replace('/');</script></body></html>`;
  const response = new NextResponse(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  });
  response.cookies.delete(STATE_COOKIE);
  return response;
}
