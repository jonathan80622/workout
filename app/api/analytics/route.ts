import { NextResponse } from 'next/server';
import { readSessionUserId } from '@/src/server/auth';
import { recordAnalyticsEvent, validateAnalyticsBody, type AnalyticsBody } from '@/src/server/observability/analytics';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const debug = process.env.ANALYTICS_DEBUG === 'true';
  const userId = await readSessionUserId(request).catch(() => null);
  const body = (await request.json().catch(() => null)) as AnalyticsBody | null;
  const validation = validateAnalyticsBody(body, userId);

  if (validation.ok === false) {
    if (debug) console.warn('[analytics] rejected event:', validation.error);
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  try {
    const result = await recordAnalyticsEvent(validation.event);
    if (debug) console.info('[analytics] recorded event:', result.eventId, result.destinations);
  } catch (error) {
    console.error('[analytics] durable ingest failed:', error);
    return NextResponse.json({ error: 'Analytics event could not be recorded.' }, { status: 503 });
  }

  return new NextResponse(null, { status: 204 });
}
