import { NextRequest } from 'next/server';
import { fetchDriveThumbnail, PT_SESSION_COOKIE, readPtSession, requireVideoInPtState } from '../../../_lib/ptMedia';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, context: { params: Promise<{ fileId: string }> }) {
  const configuredPassword = process.env.PT_VIEW_PASSWORD || process.env.NEXT_PUBLIC_PT_VIEW_PASSWORD;
  if (!configuredPassword) return new Response('PT_VIEW_PASSWORD is not configured.', { status: 500 });

  const dataFileId = readPtSession(request.cookies.get(PT_SESSION_COOKIE)?.value, configuredPassword);
  if (!dataFileId) return new Response('Unauthorized.', { status: 401 });

  const { fileId } = await context.params;
  if (!(await requireVideoInPtState(dataFileId, fileId))) return new Response('Video not found.', { status: 404 });

  try {
    const thumbnailResponse = await fetchDriveThumbnail(fileId);
    if (!thumbnailResponse.ok) return new Response(null, { status: thumbnailResponse.status });

    const headers = new Headers();
    const contentType = thumbnailResponse.headers.get('content-type');
    const contentLength = thumbnailResponse.headers.get('content-length');
    if (contentType) headers.set('Content-Type', contentType);
    if (contentLength) headers.set('Content-Length', contentLength);
    headers.set('Cache-Control', 'private, max-age=300');
    headers.set('X-Content-Type-Options', 'nosniff');

    return new Response(thumbnailResponse.body, { status: 200, headers });
  } catch (error) {
    return new Response(error instanceof Error ? error.message : 'Unable to load thumbnail.', { status: 500 });
  }
}
