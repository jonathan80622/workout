import mixpanel from 'mixpanel';
import { NextResponse } from 'next/server';
import { analyticsEventConfig, isAnalyticsEventName } from '@/src/analytics/events';

export const runtime = 'nodejs';

type AnalyticsBody = {
  event?: unknown;
  distinctId?: unknown;
  properties?: unknown;
  route?: unknown;
};

let mixpanelClient: ReturnType<typeof mixpanel.init> | null = null;

export async function POST(request: Request) {
  const token = process.env.MIXPANEL_PROJECT_TOKEN;
  const debug = process.env.ANALYTICS_DEBUG === 'true';

  if (!token) {
    if (debug) console.warn('[analytics] MIXPANEL_PROJECT_TOKEN is not configured.');
    return new NextResponse(null, { status: 204 });
  }

  const body = (await request.json().catch(() => null)) as AnalyticsBody | null;
  const validation = validateAnalyticsBody(body);

  if (validation.ok === false) {
    if (debug) console.warn('[analytics] rejected event:', validation.error);
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const properties = {
    ...validation.properties,
    distinct_id: validation.distinctId,
    app: 'workout',
    env: process.env.VERCEL_ENV || process.env.NODE_ENV || 'development',
    route: validation.route,
    time: Math.floor(Date.now() / 1000),
  };

  try {
    await trackMixpanelEvent(token, validation.event, properties);
    if (debug) console.info('[analytics] tracked event:', validation.event, properties);
  } catch (error) {
    if (debug) console.error('[analytics] Mixpanel track failed:', error);
  }

  return new NextResponse(null, { status: 204 });
}

function validateAnalyticsBody(body: AnalyticsBody | null):
  | {
      ok: true;
      event: keyof typeof analyticsEventConfig;
      distinctId: string;
      properties: Record<string, string | number | boolean>;
      route: string;
    }
  | { ok: false; error: string } {
  if (!body || typeof body !== 'object') {
    return { ok: false, error: 'Body must be a JSON object.' };
  }

  if (!isAnalyticsEventName(body.event)) {
    return { ok: false, error: 'Unknown analytics event.' };
  }

  if (typeof body.distinctId !== 'string' || !body.distinctId.startsWith('workout_')) {
    return { ok: false, error: 'Invalid analytics identity.' };
  }

  if (body.properties === null || typeof body.properties !== 'object' || Array.isArray(body.properties)) {
    return { ok: false, error: 'Properties must be a JSON object.' };
  }

  const schema = analyticsEventConfig[body.event];
  const properties: Record<string, string | number | boolean> = {};

  for (const [key, value] of Object.entries(body.properties as Record<string, unknown>)) {
    const expectedType = schema[key];
    if (!expectedType) {
      return { ok: false, error: `Property is not allowed: ${key}` };
    }
    if (typeof value !== expectedType) {
      return { ok: false, error: `Invalid property type: ${key}` };
    }
    if (typeof value === 'number' && !Number.isFinite(value)) {
      return { ok: false, error: `Invalid numeric property: ${key}` };
    }
    properties[key] = value as string | number | boolean;
  }

  const route = typeof body.route === 'string' && body.route.startsWith('/') ? body.route.slice(0, 120) : 'unknown';

  return {
    ok: true,
    event: body.event,
    distinctId: body.distinctId,
    properties,
    route,
  };
}

function getMixpanelClient(token: string): ReturnType<typeof mixpanel.init> {
  if (!mixpanelClient) {
    mixpanelClient = mixpanel.init(token, {
      debug: process.env.ANALYTICS_DEBUG === 'true',
      geolocate: false,
    });
  }
  return mixpanelClient;
}

function trackMixpanelEvent(
  token: string,
  event: string,
  properties: Record<string, string | number | boolean>
): Promise<void> {
  return new Promise((resolve, reject) => {
    getMixpanelClient(token).track(event, properties, (error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}
