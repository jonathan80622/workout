import { NextRequest } from 'next/server';
import { fetchDriveMedia, PT_SESSION_COOKIE, readPtSession, requireVideoInPtState } from '../../_lib/ptMedia';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, context: { params: Promise<{ fileId: string }> }) {
  const configuredPassword = process.env.PT_VIEW_PASSWORD || process.env.NEXT_PUBLIC_PT_VIEW_PASSWORD;
  if (!configuredPassword) return new Response('PT_VIEW_PASSWORD is not configured.', { status: 500 });

  const session = readPtSession(request.cookies.get(PT_SESSION_COOKIE)?.value, configuredPassword);
  if (!session) return new Response('Unauthorized.', { status: 401 });

  const { fileId } = await context.params;

  try {
    if (!(await requireVideoInPtState(session.dataFileId, fileId))) {
      return new Response('Video not found.', { status: 404 });
    }

    const driveResponse = await fetchDriveMedia(session.dataFileId, fileId, request.headers.get('range'));
    if (!driveResponse.ok && driveResponse.status !== 206) {
      return new Response('Unable to read video from Drive.', { status: driveResponse.status });
    }

    const headers = new Headers();
    for (const name of ['content-type', 'content-length', 'content-range', 'accept-ranges', 'etag', 'last-modified']) {
      const value = driveResponse.headers.get(name);
      if (value) headers.set(name, value);
    }
    if (!headers.has('Accept-Ranges')) headers.set('Accept-Ranges', 'bytes');
    headers.set('Cache-Control', 'private, no-store');
    headers.set('X-Content-Type-Options', 'nosniff');
    return new Response(driveResponse.body, { status: driveResponse.status, headers });
  } catch (error) {
    return new Response(error instanceof Error ? error.message : 'Unable to stream video.', { status: 500 });
  }
}
