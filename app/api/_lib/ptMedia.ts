import { createHmac, timingSafeEqual } from 'crypto';
import { getDriveRefreshToken } from './driveAuthStore';

export const PT_SESSION_COOKIE = 'workout_pt_session';

const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

const accessTokenCache = new Map<string, { token: string; expiresAt: number }>();

export type PtSession = {
  dataFileId: string;
};

export function createPtSession(dataFileId: string, password: string) {
  const payloadJson = JSON.stringify({ dataFileId } satisfies PtSession);
  const payload = Buffer.from(payloadJson, 'utf8').toString('base64url');
  const signature = createHmac('sha256', password).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

export function readPtSession(cookieValue: string | undefined, password: string): PtSession | null {
  if (!cookieValue) return null;
  const [payload, suppliedSignature] = cookieValue.split('.');
  if (!payload || !suppliedSignature) return null;

  const expectedSignature = createHmac('sha256', password).update(payload).digest('base64url');
  const supplied = Buffer.from(suppliedSignature);
  const expected = Buffer.from(expectedSignature);
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return null;

  try {
    const value = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as Partial<PtSession>;
    if (typeof value.dataFileId !== 'string' || !value.dataFileId) return null;
    return { dataFileId: value.dataFileId };
  } catch {
    return null;
  }
}

async function getDriveAccessToken(dataFileId: string) {
  const cached = accessTokenCache.get(dataFileId);
  if (cached && Date.now() < cached.expiresAt - 60_000) return cached.token;

  const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error('Server-side Drive OAuth client is not configured.');

  const refreshToken = await getDriveRefreshToken(dataFileId);
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
    throw new Error(token?.error_description || 'Unable to refresh Google Drive access.');
  }

  accessTokenCache.set(dataFileId, {
    token: token.access_token,
    expiresAt: Date.now() + (token.expires_in || 3600) * 1000,
  });
  return token.access_token;
}

export async function fetchDriveJson(fileId: string) {
  const accessToken = await getDriveAccessToken(fileId);
  return fetch(`${DRIVE_API}/files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  });
}

export async function requireVideoInPtState(dataFileId: string, fileId: string) {
  const response = await fetchDriveJson(dataFileId);
  if (!response.ok) return false;
  const state = await response.json().catch(() => null);
  if (!state || !Array.isArray(state.workouts)) return false;

  for (const workout of state.workouts) {
    if (!Array.isArray(workout?.exercises)) continue;
    for (const exercise of workout.exercises) {
      if (!Array.isArray(exercise?.videos)) continue;
      if (exercise.videos.some((video: { driveFileId?: unknown }) => video?.driveFileId === fileId)) return true;
    }
  }
  return Array.isArray(state.videos) && state.videos.some((video: { driveFileId?: unknown }) => video?.driveFileId === fileId);
}

export async function fetchDriveMedia(dataFileId: string, fileId: string, range?: string | null) {
  const accessToken = await getDriveAccessToken(dataFileId);
  const headers = new Headers({ Authorization: `Bearer ${accessToken}` });
  if (range) headers.set('Range', range);
  return fetch(`${DRIVE_API}/files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`, {
    headers,
    cache: 'no-store',
  });
}
