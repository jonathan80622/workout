import { NextResponse } from 'next/server';
import { normalizeAppState } from '@/src/utils/driveStorage';
import { createPtSession, fetchDriveJson, PT_SESSION_COOKIE, SERVER_DRIVE_CREDENTIAL_FIELD } from '../_lib/ptMedia';

export async function POST(request: Request) {
  const configuredPassword = process.env.PT_VIEW_PASSWORD || process.env.NEXT_PUBLIC_PT_VIEW_PASSWORD;
  if (!configuredPassword) return NextResponse.json({ error: 'PT_VIEW_PASSWORD is not configured.' }, { status: 500 });

  const body = await request.json().catch(() => null);
  const password = body?.password;
  const dataFileId = body?.dataFileId;
  if (password !== configuredPassword) return NextResponse.json({ error: 'Incorrect password.' }, { status: 401 });
  if (!dataFileId || typeof dataFileId !== 'string') return NextResponse.json({ error: 'Missing Drive data file id.' }, { status: 400 });

  let encryptedCredential = typeof body?.serverCredential === 'string' ? body.serverCredential : '';
  if (!encryptedCredential) {
    const referer = request.headers.get('referer');
    if (referer) {
      try {
        encryptedCredential = new URL(referer).searchParams.get('serverCredential') || '';
      } catch {
        encryptedCredential = '';
      }
    }
  }
  if (!encryptedCredential) {
    return NextResponse.json({ error: 'This PT link is missing Drive playback authorization. Recopy the PT Portal URL after connecting Drive.' }, { status: 400 });
  }

  let response: Response;
  try {
    response = await fetchDriveJson(dataFileId, encryptedCredential);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to authorize Google Drive.' }, { status: 502 });
  }
  if (!response.ok) return NextResponse.json({ error: 'Could not read workout-data.json through the authenticated Drive API.' }, { status: response.status });

  const state = await response.json().catch(() => null);
  if (!state) return NextResponse.json({ error: 'Drive data file did not contain valid JSON.' }, { status: 502 });

  const normalized = normalizeAppState(state);
  if (normalized.profile && SERVER_DRIVE_CREDENTIAL_FIELD in normalized.profile) {
    delete (normalized.profile as Record<string, unknown>)[SERVER_DRIVE_CREDENTIAL_FIELD];
  }

  const portalResponse = NextResponse.json(normalized, { headers: { 'Cache-Control': 'no-store' } });
  portalResponse.cookies.set(PT_SESSION_COOKIE, createPtSession(dataFileId, encryptedCredential, configuredPassword), {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/api/pt-video',
    maxAge: 60 * 60 * 12,
  });
  return portalResponse;
}
