import { createHmac, timingSafeEqual } from 'crypto';

export const PT_SESSION_COOKIE = 'workout_pt_session';

const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const PUBLIC_DRIVE_DOWNLOAD_URL = 'https://drive.google.com/uc?export=download&id=';

let cachedAccessToken: string | null = null;
let cachedAccessTokenExpiresAt = 0;

export function createPtSession(dataFileId: string, password: string) {
  const payload = Buffer.from(dataFileId, 'utf8').toString('base64url');
  const signature = createHmac('sha256', password).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

export function readPtSession(cookieValue: string | undefined, password: string): string | null {
  if (!cookieValue) return null;
  const [payload, suppliedSignature] = cookieValue.split('.');
  if (!payload || !suppliedSignature) return null;

  const expectedSignature = createHmac('sha256', password).update(payload).digest('base64url');
  const supplied = Buffer.from(suppliedSignature);
  const expected = Buffer.from(expectedSignature);
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return null;

  try {
    const dataFileId = Buffer.from(payload, 'base64url').toString('utf8');
    return dataFileId || null;
  } catch {
    return null;
  }
}

export async function requireVideoInPtState(dataFileId: string, fileId: string) {
  const response = await fetch(`${PUBLIC_DRIVE_DOWNLOAD_URL}${encodeURIComponent(dataFileId)}`, {
    cache: 'no-store',
  });

  if (!response.ok) return false;
  const state = await response.json().catch(() => null);
  if (!state || !Array.isArray(state.workouts)) return false;

  for (const workout of state.workouts) {
    if (!Array.isArray(workout?.exercises)) continue;
    for (const exercise of workout.exercises) {
      if (!Array.isArray(exercise?.videos)) continue;
      if (exercise.videos.some((video: { driveFileId?: unknown }) => video?.driveFileId === fileId)) {
        return true;
      }
    }
  }

  if (Array.isArray(state.videos)) {
    return state.videos.some((video: { driveFileId?: unknown }) => video?.driveFileId === fileId);
  }

  return false;
}

export async function getDriveAccessToken() {
  if (cachedAccessToken && Date.now() < cachedAccessTokenExpiresAt - 60_000) {
    return cachedAccessToken;
  }

  const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_DRIVE_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      'Server-side Drive auth is not configured. Set GOOGLE_DRIVE_CLIENT_SECRET and GOOGLE_DRIVE_REFRESH_TOKEN; GOOGLE_DRIVE_CLIENT_ID defaults to NEXT_PUBLIC_GOOGLE_CLIENT_ID.'
    );
  }

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
    cache: 'no-store',
  });

  const token = await response.json().catch(() => null) as {
    access_token?: string;
    expires_in?: number;
    error_description?: string;
  } | null;

  if (!response.ok || !token?.access_token) {
    throw new Error(token?.error_description || 'Unable to refresh the server-side Google Drive access token.');
  }

  cachedAccessToken = token.access_token;
  cachedAccessTokenExpiresAt = Date.now() + (token.expires_in || 3600) * 1000;
  return cachedAccessToken;
}

export async function fetchDriveMedia(fileId: string, range?: string | null) {
  const accessToken = await getDriveAccessToken();
  const headers = new Headers({ Authorization: `Bearer ${accessToken}` });
  if (range) headers.set('Range', range);

  return fetch(`${DRIVE_API}/files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`, {
    headers,
    cache: 'no-store',
  });
}

export async function fetchDriveThumbnail(fileId: string) {
  const accessToken = await getDriveAccessToken();
  const metadataResponse = await fetch(
    `${DRIVE_API}/files/${encodeURIComponent(fileId)}?fields=thumbnailLink&supportsAllDrives=true`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
    }
  );

  if (!metadataResponse.ok) return metadataResponse;
  const metadata = await metadataResponse.json().catch(() => null) as { thumbnailLink?: string } | null;
  if (!metadata?.thumbnailLink) return new Response(null, { status: 404 });

  return fetch(metadata.thumbnailLink, {
    headers: { Authorization: `Bearer ${accessToken}` },
    redirect: 'follow',
    cache: 'no-store',
  });
}
