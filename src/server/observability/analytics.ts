import { randomUUID } from 'node:crypto';
import mixpanel from 'mixpanel';
import { Prisma } from '@prisma/client';
import { analyticsEventConfig, isAnalyticsEventName } from '@/src/analytics/events';
import { prisma } from '@/src/server/db';

export type AnalyticsDestinationName = 'mixpanel' | 'ga4';
export type AnalyticsDeliveryStatusName = 'pending' | 'processing' | 'delivered' | 'retrying' | 'failed' | 'disabled';

export type AnalyticsBody = {
  event?: unknown;
  eventId?: unknown;
  occurredAt?: unknown;
  distinctId?: unknown;
  properties?: unknown;
  route?: unknown;
  correlationId?: unknown;
  gaClientId?: unknown;
};

export type ValidatedAnalyticsEvent = {
  eventId: string;
  occurredAt: Date;
  environment: string;
  schemaVersion: 1;
  userId: string | null;
  anonymousId: string;
  correlationId: string | null;
  gaClientId: string | null;
  name: keyof typeof analyticsEventConfig;
  route: string;
  properties: Record<string, string | number | boolean>;
};

export type AnalyticsValidation =
  | { ok: true; event: ValidatedAnalyticsEvent }
  | { ok: false; error: string };

export type RecordAnalyticsResult = {
  eventId: string;
  created: boolean;
  destinations: AnalyticsDestinationName[];
};

export type DeliverySender = (delivery: AnalyticsDeliveryWorkItem, signal: AbortSignal) => Promise<{ ackId?: string | null }>;

export type AnalyticsDeliveryWorkItem = {
  id: string;
  eventId: string;
  destination: AnalyticsDestinationName;
  attempts: number;
  event: {
    name: string;
    anonymousId: string;
    occurredAt: Date;
    environment: string;
    route: string;
    properties: Record<string, string | number | boolean>;
    eventId: string;
    correlationId: string | null;
  };
};

const SCHEMA_VERSION = 1;
const MAX_ATTEMPTS = 8;
const LEASE_MS = 60_000;
const mixpanelClients = new Map<string, ReturnType<typeof mixpanel.init>>();

export function observabilityEnvironment(): string {
  return process.env.VERCEL_ENV || process.env.NODE_ENV || 'development';
}

export function enabledAnalyticsDestinations(): AnalyticsDestinationName[] {
  const destinations: AnalyticsDestinationName[] = [];
  if (process.env.MIXPANEL_PROJECT_TOKEN) destinations.push('mixpanel');
  if (process.env.GA4_MEASUREMENT_ID && process.env.GA4_API_SECRET) destinations.push('ga4');
  return destinations;
}

export function validateAnalyticsBody(body: AnalyticsBody | null, userId: string | null = null, now = new Date()): AnalyticsValidation {
  if (!body || typeof body !== 'object') {
    return { ok: false, error: 'Body must be a JSON object.' };
  }

  if (!isAnalyticsEventName(body.event)) {
    return { ok: false, error: 'Unknown analytics event.' };
  }

  if (!isValidEventId(body.eventId)) {
    return { ok: false, error: 'Invalid analytics event id.' };
  }

  const occurredAt = parseOccurredAt(body.occurredAt, now);
  if (!occurredAt) {
    return { ok: false, error: 'Invalid analytics occurrence time.' };
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
    if (!expectedType) return { ok: false, error: `Property is not allowed: ${key}` };
    if (typeof value !== expectedType) return { ok: false, error: `Invalid property type: ${key}` };
    if (typeof value === 'number' && !Number.isFinite(value)) return { ok: false, error: `Invalid numeric property: ${key}` };
    properties[key] = value as string | number | boolean;
  }

  const route = typeof body.route === 'string' && body.route.startsWith('/') ? body.route.slice(0, 120) : 'unknown';
  const correlationId = typeof body.correlationId === 'string' && body.correlationId.trim()
    ? body.correlationId.trim().slice(0, 120)
    : null;
  const gaClientId = isValidGaClientId(body.gaClientId) ? body.gaClientId : null;

  return {
    ok: true,
    event: {
      eventId: typeof body.eventId === 'string' ? body.eventId : randomUUID(),
      occurredAt,
      environment: observabilityEnvironment(),
      schemaVersion: SCHEMA_VERSION,
      userId,
      anonymousId: body.distinctId,
      correlationId,
      gaClientId,
      name: body.event,
      route,
      properties,
    },
  };
}

export async function recordAnalyticsEvent(
  event: ValidatedAnalyticsEvent,
  destinations = enabledAnalyticsDestinations()
): Promise<RecordAnalyticsResult> {
  return prisma.$transaction(async (db) => {
    const existing = await db.analyticsEvent.findUnique({ where: { eventId: event.eventId }, select: { eventId: true } });
    let created = false;
    if (!existing) {
      created = true;
      await db.analyticsEvent.create({
        data: {
          eventId: event.eventId,
          occurredAt: event.occurredAt,
          environment: event.environment,
          schemaVersion: event.schemaVersion,
          userId: event.userId,
          anonymousId: event.anonymousId,
          correlationId: event.correlationId,
          name: event.name,
          route: event.route,
          properties: {
            ...event.properties,
            ...(event.gaClientId ? { _ga_client_id: event.gaClientId } : {}),
          } as Prisma.InputJsonValue,
        },
      });
    }

    for (const destination of destinations) {
      await db.analyticsDelivery.upsert({
        where: { eventId_destination: { eventId: event.eventId, destination } },
        create: { eventId: event.eventId, destination, status: 'pending' },
        update: {},
      });
    }

    return { eventId: event.eventId, created, destinations };
  });
}

export async function processAnalyticsDeliveries(options: {
  eventId?: string;
  limit?: number;
  now?: Date;
  clock?: () => Date;
  sendTimeoutMs?: number;
  workerId?: string;
  senders?: Partial<Record<AnalyticsDestinationName, DeliverySender>>;
} = {}) {
  const clock = options.clock ?? (options.now ? () => options.now! : () => new Date());
  const now = clock();
  const environment = observabilityEnvironment();
  const timeoutMs = Math.min(Math.max(options.sendTimeoutMs ?? 10_000, 1), 10_000);
  const deadline = now.getTime() + 45_000;
  const limit = options.limit ?? 25;
  const workerId = options.workerId ?? `analytics-${randomUUID()}`;
  const eventFilter = options.eventId ? { eventId: options.eventId } : {};
  const candidates = await prisma.analyticsDelivery.findMany({
    where: {
      ...eventFilter,
      event: { environment },
      OR: [
        { status: { in: ['pending', 'retrying'] }, nextAttemptAt: { lte: now } },
        { status: 'processing', leaseExpiresAt: { lt: now } },
      ],
    },
    orderBy: [{ nextAttemptAt: 'asc' }, { id: 'asc' }],
    take: limit,
    include: { event: true },
  });

  const results = { claimed: 0, delivered: 0, retrying: 0, failed: 0, disabled: 0 };
  for (const candidate of candidates) {
    const claimedAt = clock();
    if (claimedAt.getTime() + timeoutMs > deadline) break;
    const claimOwner = `${workerId}:${randomUUID()}`;
    const claimed = await prisma.analyticsDelivery.updateMany({
      where: {
        id: candidate.id,
        event: { environment },
        attempts: candidate.attempts,
        OR: [
          { status: { in: ['pending', 'retrying'] }, nextAttemptAt: { lte: claimedAt } },
          { status: 'processing', leaseExpiresAt: { lt: claimedAt } },
        ],
      },
      data: {
        status: 'processing',
        leaseOwner: claimOwner,
        leaseExpiresAt: new Date(claimedAt.getTime() + LEASE_MS),
        attempts: { increment: 1 },
        lastAttemptAt: claimedAt,
        errorMessage: null,
      },
    });
    if (!claimed.count) continue;
    results.claimed += 1;

    const attempts = candidate.attempts + 1;
    const workItem = toWorkItem(candidate, attempts);
    const sender = options.senders?.[workItem.destination] ?? defaultSenderFor(workItem.destination);
    if (!sender) {
      const updated = await markDelivery(candidate.id, claimOwner, {
        status: 'disabled',
        errorMessage: `${workItem.destination} is not configured.`,
        leaseOwner: null,
        leaseExpiresAt: null,
      });
      if (updated) results.disabled += 1;
      continue;
    }

    try {
      const sent = await sendWithTimeout(sender, workItem, timeoutMs);
      const updated = await markDelivery(candidate.id, claimOwner, {
        status: 'delivered',
        deliveredAt: clock(),
        providerAckId: sent.ackId || null,
        errorMessage: null,
        leaseOwner: null,
        leaseExpiresAt: null,
      });
      if (updated) results.delivered += 1;
    } catch (error) {
      const retry = attempts < MAX_ATTEMPTS;
      const finishedAt = clock();
      const updated = await markDelivery(candidate.id, claimOwner, {
        status: retry ? 'retrying' : 'failed',
        nextAttemptAt: retry ? new Date(finishedAt.getTime() + retryDelayMs(attempts)) : finishedAt,
        errorMessage: error instanceof Error ? error.message.slice(0, 1000) : 'Analytics delivery failed.',
        leaseOwner: null,
        leaseExpiresAt: null,
      });
      if (updated && retry) results.retrying += 1;
      else if (updated) results.failed += 1;
    }
  }

  return results;
}

export async function materializeAnalyticsReport(now = new Date()) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const environment = observabilityEnvironment();
  const events = await prisma.analyticsEvent.findMany({
    where: { environment, occurredAt: { gte: start, lt: end } },
    select: { name: true, anonymousId: true, deliveries: { select: { destination: true, status: true } } },
  });

  const byEvent: Record<string, number> = {};
  const uniqueUsers = new Set<string>();
  const deliveries: Record<string, Record<string, number>> = {};
  for (const event of events) {
    byEvent[event.name] = (byEvent[event.name] || 0) + 1;
    uniqueUsers.add(event.anonymousId);
    for (const delivery of event.deliveries) {
      deliveries[delivery.destination] ||= {};
      deliveries[delivery.destination][delivery.status] = (deliveries[delivery.destination][delivery.status] || 0) + 1;
    }
  }

  const metrics = { eventCount: events.length, uniqueAnonymousIds: uniqueUsers.size, byEvent, deliveries };
  const existing = await prisma.analyticsReport.findFirst({ where: { reportDate: start, environment, destination: 'canonical' } });
  if (existing) {
    return prisma.analyticsReport.update({ where: { id: existing.id }, data: { metrics } });
  }
  return prisma.analyticsReport.create({ data: { reportDate: start, environment, destination: 'canonical', metrics } });
}

export async function getAnalyticsDashboardSummary(now = new Date()) {
  const since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const environment = observabilityEnvironment();
  const [eventCount, uniqueRows, deliveryCounts, recentEvents, failedDeliveries, reports] = await Promise.all([
    prisma.analyticsEvent.count({ where: { environment, occurredAt: { gte: since } } }),
    prisma.analyticsEvent.findMany({
      where: { environment, occurredAt: { gte: since } },
      distinct: ['anonymousId'],
      select: { anonymousId: true },
    }),
    prisma.analyticsDelivery.groupBy({
      where: { event: { environment } },
      by: ['destination', 'status'],
      _count: { _all: true },
    }),
    prisma.analyticsEvent.findMany({
      where: { environment },
      orderBy: { recordedAt: 'desc' },
      take: 12,
      select: { eventId: true, name: true, anonymousId: true, route: true, occurredAt: true, recordedAt: true },
    }),
    prisma.analyticsDelivery.findMany({
      where: { event: { environment }, status: { in: ['retrying', 'failed'] } },
      orderBy: [{ lastAttemptAt: 'desc' }, { nextAttemptAt: 'asc' }],
      take: 10,
      select: { id: true, destination: true, status: true, attempts: true, nextAttemptAt: true, errorMessage: true, event: { select: { name: true, eventId: true } } },
    }),
    prisma.analyticsReport.findMany({
      where: { environment },
      orderBy: { reportDate: 'desc' },
      take: 7,
    }),
  ]);

  return {
    environment,
    configuredDestinations: enabledAnalyticsDestinations(),
    windowDays: 7,
    eventCount,
    uniqueAnonymousIds: uniqueRows.length,
    deliveryCounts: deliveryCounts.map((row) => ({
      destination: row.destination,
      status: row.status,
      count: row._count._all,
    })),
    recentEvents: recentEvents.map((event) => ({
      ...event,
      occurredAt: event.occurredAt.toISOString(),
      recordedAt: event.recordedAt.toISOString(),
    })),
    failedDeliveries: failedDeliveries.map((delivery) => ({
      ...delivery,
      nextAttemptAt: delivery.nextAttemptAt.toISOString(),
    })),
    reports: reports.map((report) => ({
      id: report.id,
      reportDate: report.reportDate.toISOString().slice(0, 10),
      destination: report.destination,
      metrics: report.metrics,
    })),
  };
}

function isValidEventId(value: unknown): boolean {
  return value == null || (typeof value === 'string' && value.length >= 8 && value.length <= 120 && /^[A-Za-z0-9._:-]+$/.test(value));
}

function isValidGaClientId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 120 && /^[A-Za-z0-9._-]+$/.test(value);
}

function parseOccurredAt(value: unknown, fallback: Date): Date | null {
  if (value == null) return fallback;
  if (typeof value !== 'string') return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function toWorkItem(delivery: any, attempts: number): AnalyticsDeliveryWorkItem {
  return {
    id: delivery.id,
    eventId: delivery.eventId,
    destination: delivery.destination,
    attempts,
    event: {
      name: delivery.event.name,
      anonymousId: delivery.event.anonymousId,
      occurredAt: delivery.event.occurredAt,
      environment: delivery.event.environment,
      route: delivery.event.route,
      properties: delivery.event.properties,
      eventId: delivery.event.eventId,
      correlationId: delivery.event.correlationId,
    },
  };
}

async function markDelivery(id: string, leaseOwner: string, data: Record<string, unknown>) {
  const result = await prisma.analyticsDelivery.updateMany({ where: { id, leaseOwner, status: 'processing' }, data });
  return result.count === 1;
}

async function sendWithTimeout(sender: DeliverySender, delivery: AnalyticsDeliveryWorkItem, timeoutMs: number) {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error('Analytics delivery timed out.'));
      controller.abort();
    }, timeoutMs);
  });
  try {
    return await Promise.race([Promise.resolve().then(() => sender(delivery, controller.signal)), timeout]);
  } finally {
    clearTimeout(timer!);
  }
}

function retryDelayMs(attempts: number): number {
  return Math.min(60 * 60 * 1000, 2 ** Math.max(0, attempts - 1) * 30_000);
}

function defaultSenderFor(destination: AnalyticsDestinationName): DeliverySender | null {
  if (destination === 'mixpanel') return process.env.MIXPANEL_PROJECT_TOKEN ? sendMixpanelDelivery : null;
  if (destination === 'ga4') return process.env.GA4_MEASUREMENT_ID && process.env.GA4_API_SECRET ? sendGa4Delivery : null;
  return null;
}

async function sendMixpanelDelivery(delivery: AnalyticsDeliveryWorkItem): Promise<{ ackId: string }> {
  const token = process.env.MIXPANEL_PROJECT_TOKEN;
  if (!token) throw new Error('MIXPANEL_PROJECT_TOKEN is not configured.');
  let client = mixpanelClients.get(token);
  if (!client) {
    client = mixpanel.init(token, {
      debug: process.env.ANALYTICS_DEBUG === 'true',
      verbose: true,
      geolocate: false,
    });
    mixpanelClients.set(token, client);
  }
  await new Promise<void>((resolve, reject) => {
    client.track(delivery.event.name, { ...providerProperties(delivery), $insert_id: delivery.eventId }, (error) => {
      if (error) reject(error);
      else resolve();
    });
  });
  return { ackId: delivery.eventId };
}

async function sendGa4Delivery(delivery: AnalyticsDeliveryWorkItem, signal: AbortSignal): Promise<{ ackId: string }> {
  const measurementId = process.env.GA4_MEASUREMENT_ID;
  const apiSecret = process.env.GA4_API_SECRET;
  if (!measurementId || !apiSecret) throw new Error('GA4 is not configured.');
  const response = await fetch(`https://www.google-analytics.com/mp/collect?measurement_id=${encodeURIComponent(measurementId)}&api_secret=${encodeURIComponent(apiSecret)}`, {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: gaClientIdFor(delivery) || delivery.event.anonymousId.replace(/^workout_/, ''),
      timestamp_micros: String(delivery.event.occurredAt.getTime() * 1000),
      events: [{
        name: delivery.event.name,
        params: {
          ...providerProperties(delivery),
          engagement_time_msec: 1,
          ...(process.env.ANALYTICS_DEBUG === 'true' ? { debug_mode: true } : {}),
        },
      }],
    }),
  });
  if (!response.ok) throw new Error(`GA4 delivery failed with HTTP ${response.status}.`);
  return { ackId: delivery.eventId };
}

function providerProperties(delivery: AnalyticsDeliveryWorkItem) {
  const { _ga_client_id: _gaClientId, ...properties } = delivery.event.properties;
  return {
    ...properties,
    distinct_id: delivery.event.anonymousId,
    app: 'workout',
    env: delivery.event.environment,
    route: delivery.event.route,
    time: Math.floor(delivery.event.occurredAt.getTime() / 1000),
    event_id: delivery.event.eventId,
    correlation_id: delivery.event.correlationId || undefined,
  };
}

function gaClientIdFor(delivery: AnalyticsDeliveryWorkItem): string | null {
  const value = delivery.event.properties._ga_client_id;
  return typeof value === 'string' ? value : null;
}
