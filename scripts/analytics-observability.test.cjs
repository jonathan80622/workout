const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const { createHash } = require('node:crypto');

const root = path.resolve(__dirname, '..');
let cache;
let db;

function load(file) {
  file = path.resolve(root, file);
  if (!path.extname(file)) file += '.ts';
  if (cache.has(file)) return cache.get(file).exports;
  const module = { exports: {} };
  cache.set(file, module);
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const localRequire = (name) => {
    if (name === '@/src/server/db') return { prisma: new Proxy({}, { get: (_, key) => key === '$transaction' ? async (fn) => fn(db) : db[key] }) };
    if (name === 'mixpanel') return { init: () => ({ track: (_event, _properties, cb) => cb(new Error('network unavailable')) }) };
    if (name.startsWith('@/')) return load(name.slice(2));
    if (name.startsWith('.')) return load(path.resolve(path.dirname(file), name));
    return Module.createRequire(file)(name);
  };
  new Function('require', 'module', 'exports', code)(localRequire, module, module.exports);
  return module.exports;
}

const sessionFor = (userId, token = `token-${userId}`, expiresAt = new Date(Date.now() + 60_000)) =>
  ({ token, tokenHash: createHash('sha256').update(token).digest('base64url'), userId, expiresAt });
const withSession = (session) => ({ cookie: `workout_session=${session.token}` });

function fakeObservabilityDatabase() {
  const state = {
    events: [],
    deliveries: [],
    reports: [],
    users: [],
    sessions: [],
  };
  const api = {
    state,
    session: {
      findUnique: async ({ where }) => state.sessions.find((row) => row.tokenHash === where.tokenHash) || null,
    },
    user: {
      findUnique: async ({ where }) => {
        const row = state.users.find((user) => user.id === where.id);
        if (!row) return null;
        return where.select ? Object.fromEntries(Object.keys(where.select).map((key) => [key, row[key]])) : row;
      },
    },
    analyticsEvent: {
      findUnique: async ({ where }) => state.events.find((event) => event.eventId === where.eventId) || null,
      create: async ({ data }) => {
        const row = { recordedAt: new Date('2026-10-12T10:00:00Z'), ...data, deliveries: [] };
        state.events.push(row);
        return row;
      },
      count: async () => state.events.length,
      findMany: async (args = {}) => {
        if (args.distinct?.includes('anonymousId')) {
          const seen = new Set();
          return state.events.filter((event) => !seen.has(event.anonymousId) && seen.add(event.anonymousId))
            .map((event) => ({ anonymousId: event.anonymousId }));
        }
        const rows = [...state.events].sort((a, b) => b.recordedAt - a.recordedAt);
        return rows.slice(0, args.take || rows.length).map((event) => {
          const hydrated = args.select?.deliveries ? { ...event, deliveries: state.deliveries.filter((delivery) => delivery.eventId === event.eventId) } : event;
          if (args.select) return pick(hydrated, args.select);
          return hydrated;
        });
      },
    },
    analyticsDelivery: {
      upsert: async ({ where, create }) => {
        const existing = state.deliveries.find((delivery) => delivery.eventId === where.eventId_destination.eventId && delivery.destination === where.eventId_destination.destination);
        if (existing) return existing;
        const row = {
          id: `delivery-${state.deliveries.length + 1}`,
          status: 'pending',
          attempts: 0,
          nextAttemptAt: new Date('2026-10-12T10:00:00Z'),
          lastAttemptAt: null,
          deliveredAt: null,
          leaseOwner: null,
          leaseExpiresAt: null,
          providerAckId: null,
          errorMessage: null,
          ...create,
        };
        state.deliveries.push(row);
        return row;
      },
      findMany: async (args = {}) => {
        const rows = state.deliveries.filter((delivery) => {
          if (!args.where) return true;
          if (args.where.status?.in) return args.where.status.in.includes(delivery.status);
          if (args.where.OR) {
            return args.where.OR.some((branch) => {
              if (branch.status?.in) return branch.status.in.includes(delivery.status) && delivery.nextAttemptAt <= branch.nextAttemptAt.lte;
              return branch.status === delivery.status && delivery.leaseExpiresAt && delivery.leaseExpiresAt < branch.leaseExpiresAt.lt;
            });
          }
          return true;
        });
        return rows.slice(0, args.take || rows.length).map((delivery) => {
          const event = state.events.find((row) => row.eventId === delivery.eventId);
          const hydrated = args.include?.event ? { ...delivery, event } : delivery;
          return args.select ? pick(hydrated, args.select) : hydrated;
        });
      },
      updateMany: async ({ where, data }) => {
        const row = state.deliveries.find((delivery) => delivery.id === where.id);
        if (!row) return { count: 0 };
        Object.assign(row, applyData(row, data));
        return { count: 1 };
      },
      update: async ({ where, data }) => {
        const row = state.deliveries.find((delivery) => delivery.id === where.id);
        Object.assign(row, applyData(row, data));
        return row;
      },
      groupBy: async () => {
        const counts = new Map();
        for (const delivery of state.deliveries) {
          const key = `${delivery.destination}:${delivery.status}`;
          counts.set(key, (counts.get(key) || 0) + 1);
        }
        return [...counts].map(([key, count]) => {
          const [destination, status] = key.split(':');
          return { destination, status, _count: { _all: count } };
        });
      },
    },
    analyticsReport: {
      findFirst: async ({ where }) => state.reports.find((report) => report.reportDate.getTime() === where.reportDate.getTime() && report.environment === where.environment) || null,
      create: async ({ data }) => {
        const row = { id: `report-${state.reports.length + 1}`, destination: null, ...data };
        state.reports.push(row);
        return row;
      },
      update: async ({ where, data }) => {
        const row = state.reports.find((report) => report.id === where.id);
        Object.assign(row, data);
        return row;
      },
      findMany: async () => state.reports,
    },
  };
  return api;
}

function applyData(row, data) {
  const next = { ...data };
  for (const [key, value] of Object.entries(next)) {
    if (value && typeof value === 'object' && 'increment' in value) next[key] = row[key] + value.increment;
  }
  return next;
}

function pick(row, select) {
  const out = {};
  for (const [key, value] of Object.entries(select)) {
    if (value === true) out[key] = row[key];
    else if (key === 'event') out[key] = pick(row[key], value.select);
    else if (Array.isArray(row[key]) && value.select) out[key] = row[key].map((item) => pick(item, value.select));
  }
  return out;
}

const validBody = () => ({
  event: 'workout_started',
  eventId: 'evt-test-1',
  occurredAt: '2026-10-12T10:00:00.000Z',
  distinctId: 'workout_anon-1',
  properties: { source: 'scratch', has_scheduled_session: false, exercise_count: 0 },
  route: '/workout',
});

beforeEach(() => {
  cache = new Map();
  db = fakeObservabilityDatabase();
  process.env.MIXPANEL_PROJECT_TOKEN = 'mixpanel-token';
  process.env.GA4_MEASUREMENT_ID = '';
  process.env.GA4_API_SECRET = '';
  process.env.OBSERVABILITY_ADMIN_GOOGLE_SUBS = 'google-admin';
});

afterEach(() => {
  delete process.env.MIXPANEL_PROJECT_TOKEN;
  delete process.env.GA4_MEASUREMENT_ID;
  delete process.env.GA4_API_SECRET;
  delete process.env.OBSERVABILITY_ADMIN_GOOGLE_SUBS;
  delete process.env.OBSERVABILITY_CRON_SECRET;
  delete process.env.CRON_SECRET;
});

test('analytics validation rejects unknown events, bad ids, routes, and properties', () => {
  const { validateAnalyticsBody } = load('src/server/observability/analytics.ts');
  assert.equal(validateAnalyticsBody({ ...validBody(), event: 'nope' }).ok, false);
  assert.equal(validateAnalyticsBody({ ...validBody(), distinctId: 'user-1' }).ok, false);
  assert.equal(validateAnalyticsBody({ ...validBody(), eventId: '../bad' }).ok, false);
  assert.equal(validateAnalyticsBody({ ...validBody(), properties: { source: 'scratch', extra: true } }).ok, false);
  assert.equal(validateAnalyticsBody({ ...validBody(), properties: { source: 'scratch', exercise_count: '0' } }).ok, false);
  const validation = validateAnalyticsBody({ ...validBody(), route: 'not-a-route' });
  assert.equal(validation.ok, true);
  assert.equal(validation.event.route, 'unknown');
});

test('ingestion creates one canonical event and one delivery per enabled destination idempotently', async () => {
  process.env.GA4_MEASUREMENT_ID = 'G-TEST';
  process.env.GA4_API_SECRET = 'secret';
  const { validateAnalyticsBody, recordAnalyticsEvent } = load('src/server/observability/analytics.ts');
  const validation = validateAnalyticsBody(validBody(), 'owner-1');
  assert.equal(validation.ok, true);
  const first = await recordAnalyticsEvent(validation.event);
  const second = await recordAnalyticsEvent(validation.event);
  assert.equal(first.created, true);
  assert.equal(second.created, false);
  assert.equal(db.state.events.length, 1);
  assert.deepEqual(db.state.deliveries.map((row) => row.destination).sort(), ['ga4', 'mixpanel']);
});

test('delivery worker marks success, retry, and final failure without double-claiming rows', async () => {
  const { validateAnalyticsBody, recordAnalyticsEvent, processAnalyticsDeliveries } = load('src/server/observability/analytics.ts');
  const validation = validateAnalyticsBody(validBody(), 'owner-1');
  await recordAnalyticsEvent(validation.event, ['mixpanel']);
  const success = await processAnalyticsDeliveries({
    now: new Date('2026-10-12T10:01:00Z'),
    senders: { mixpanel: async () => ({ ackId: 'ok-1' }) },
  });
  assert.equal(success.delivered, 1);
  assert.equal(db.state.deliveries[0].status, 'delivered');

  await recordAnalyticsEvent({ ...validation.event, eventId: 'evt-test-2' }, ['mixpanel']);
  const retry = await processAnalyticsDeliveries({
    now: new Date('2026-10-12T10:02:00Z'),
    senders: { mixpanel: async () => { throw new Error('temporary'); } },
  });
  assert.equal(retry.retrying, 1);
  assert.equal(db.state.deliveries[1].status, 'retrying');

  db.state.deliveries[1].attempts = 7;
  db.state.deliveries[1].nextAttemptAt = new Date('2026-10-12T10:03:00Z');
  const failed = await processAnalyticsDeliveries({
    now: new Date('2026-10-12T10:03:00Z'),
    senders: { mixpanel: async () => { throw new Error('still down'); } },
  });
  assert.equal(failed.failed, 1);
  assert.equal(db.state.deliveries[1].status, 'failed');
});

test('/api/analytics returns 204 after durable storage even when providers are unavailable', async () => {
  const route = load('app/api/analytics/route.ts');
  const response = await route.POST(new Request('http://localhost/api/analytics', {
    method: 'POST',
    body: JSON.stringify(validBody()),
  }));
  assert.equal(response.status, 204);
  assert.equal(db.state.events.length, 1);
  assert.equal(db.state.deliveries.length, 1);
});

test('observability summary requires sign-in and configured admin subject', async () => {
  const session = sessionFor('owner-1');
  db.state.sessions.push(session);
  db.state.users.push({ id: 'owner-1', authSubject: 'not-admin' });
  const route = load('app/api/observability/summary/route.ts');
  assert.equal((await route.GET(new Request('http://localhost/api/observability/summary'))).status, 401);
  assert.equal((await route.GET(new Request('http://localhost/api/observability/summary', { headers: withSession(session) }))).status, 403);

  db.state.users[0].authSubject = 'google-admin';
  const response = await route.GET(new Request('http://localhost/api/observability/summary', { headers: withSession(session) }));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).analytics.environment.length > 0, true);
});

test('analytics cron rejects bad secrets and processes deliveries with the observability secret', async () => {
  process.env.OBSERVABILITY_CRON_SECRET = 'observability-secret';
  const { validateAnalyticsBody, recordAnalyticsEvent } = load('src/server/observability/analytics.ts');
  const validation = validateAnalyticsBody(validBody(), 'owner-1');
  await recordAnalyticsEvent(validation.event, ['mixpanel']);
  const route = load('app/api/cron/analytics-delivery/route.ts');
  assert.equal((await route.GET(new Request('http://localhost/api/cron/analytics-delivery'))).status, 401);
  const response = await route.GET(new Request('http://localhost/api/cron/analytics-delivery', {
    headers: { authorization: 'Bearer observability-secret' },
  }));
  assert.equal(response.status, 200);
  assert.equal(db.state.deliveries[0].status, 'retrying');
  assert.equal(db.state.reports.length, 1);
});
