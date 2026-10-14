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
let mixpanelTrack;
let mixpanelInitOptions;
const originalEnv = { ...process.env };

function load(file) {
  file = path.resolve(root, file);
  if (!path.extname(file)) file += '.ts';
  if (cache.has(file)) return cache.get(file).exports;
  const module = { exports: {} };
  cache.set(file, module);
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const localRequire = (name) => {
    if (name === '@/src/server/db') return { prisma: new Proxy({}, { get: (_, key) => key === '$transaction' ? async (fn) => fn(db) : db[key] }) };
    if (name === 'mixpanel') return { default: { init: (_token, options) => {
      mixpanelInitOptions = options;
      return { track: (...args) => mixpanelTrack(...args) };
    } } };
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

function matches(row, where = {}) {
  return Object.entries(where).every(([key, value]) => {
    if (key === 'OR') return value.some((branch) => matches(row, branch));
    if (value && typeof value === 'object' && !(value instanceof Date)) {
      if ('in' in value) return value.in.includes(row[key]);
      if ('lte' in value) return row[key] != null && row[key] <= value.lte;
      if ('gte' in value) return row[key] >= value.gte && (!value.lt || row[key] < value.lt);
      if ('lt' in value) return row[key] != null && row[key] < value.lt;
      return matches(row[key] || {}, value);
    }
    return row[key] === value;
  });
}

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
      count: async (args = {}) => state.events.filter((row) => matches(row, args.where)).length,
      findMany: async (args = {}) => {
        const filtered = state.events.filter((row) => matches(row, args.where));
        if (args.distinct?.includes('anonymousId')) {
          const seen = new Set();
          return filtered.filter((event) => !seen.has(event.anonymousId) && seen.add(event.anonymousId))
            .map((event) => ({ anonymousId: event.anonymousId }));
        }
        const rows = [...filtered].sort((a, b) => b.recordedAt - a.recordedAt);
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
          return matches({ ...delivery, event: state.events.find((row) => row.eventId === delivery.eventId) }, args.where);
        });
        return rows.slice(0, args.take || rows.length).map((delivery) => {
          const event = state.events.find((row) => row.eventId === delivery.eventId);
          const hydrated = { ...delivery, event };
          return args.select ? pick(hydrated, args.select) : hydrated;
        });
      },
      updateMany: async ({ where, data }) => {
        const row = state.deliveries.find((delivery) => matches({ ...delivery, event: state.events.find((event) => event.eventId === delivery.eventId) }, where));
        if (!row) return { count: 0 };
        Object.assign(row, applyData(row, data));
        return { count: 1 };
      },
      update: async ({ where, data }) => {
        const row = state.deliveries.find((delivery) => delivery.id === where.id);
        Object.assign(row, applyData(row, data));
        return row;
      },
      groupBy: async (args = {}) => {
        const counts = new Map();
        for (const delivery of state.deliveries) {
          if (!matches({ ...delivery, event: state.events.find((row) => row.eventId === delivery.eventId) }, args.where)) continue;
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
      findMany: async (args = {}) => state.reports.filter((row) => matches(row, args.where)),
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
  mixpanelTrack = (_event, _properties, cb) => cb(new Error('network unavailable'));
  mixpanelInitOptions = undefined;
  process.env.VERCEL_ENV = 'production';
  delete process.env.CRON_SECRET;
  delete process.env.OBSERVABILITY_CRON_SECRET;
  process.env.MIXPANEL_PROJECT_TOKEN = 'mixpanel-token';
  process.env.GA4_MEASUREMENT_ID = '';
  process.env.GA4_API_SECRET = '';
});

afterEach(() => {
  for (const key of ['MIXPANEL_PROJECT_TOKEN', 'GA4_MEASUREMENT_ID', 'GA4_API_SECRET', 'OBSERVABILITY_CRON_SECRET', 'CRON_SECRET', 'VERCEL_ENV']) {
    if (originalEnv[key] === undefined) delete process.env[key];
    else process.env[key] = originalEnv[key];
  }
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

test('analytics validation accepts PT events and rejects mistyped PT properties', () => {
  const { validateAnalyticsBody } = load('src/server/observability/analytics.ts');
  const validPtComment = validateAnalyticsBody({
    event: 'pt_comment_saved',
    eventId: 'evt-pt-comment-1',
    occurredAt: '2026-10-12T10:00:00.000Z',
    distinctId: 'workout_anon-pt',
    properties: {
      client_id: 'client-1',
      workout_id: 'workout-1',
      exercise_id: 'exercise-1',
      comment_scope: 'exercise',
      comment_length: 42,
    },
    route: '/pt',
  });
  assert.equal(validPtComment.ok, true);

  const validExposure = validateAnalyticsBody({
    event: 'pt_exercise_exposed',
    eventId: 'evt-pt-exposure-1',
    occurredAt: '2026-10-12T10:00:00.000Z',
    distinctId: 'workout_anon-pt',
    properties: {
      client_id: 'client-1',
      workout_id: 'workout-1',
      exercise_id: 'exercise-1',
      category: 'Quads',
      completed_set_count: 3,
      video_count: 1,
    },
    route: '/pt',
  });
  assert.equal(validExposure.ok, true);

  assert.equal(validateAnalyticsBody({
    event: 'pt_comment_saved',
    eventId: 'evt-pt-comment-2',
    occurredAt: '2026-10-12T10:00:00.000Z',
    distinctId: 'workout_anon-pt',
    properties: {
      client_id: 'client-1',
      workout_id: 'workout-1',
      comment_scope: 'workout',
      comment_length: '42',
    },
    route: '/pt',
  }).ok, false);
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

test('/api/analytics immediately delivers the event it just stored', async () => {
  const calls = [];
  mixpanelTrack = (name, properties, callback) => {
    calls.push({ name, properties });
    callback(null);
  };
  const route = load('app/api/analytics/route.ts');
  const response = await route.POST(new Request('http://localhost/api/analytics', {
    method: 'POST',
    body: JSON.stringify(validBody()),
  }));
  assert.equal(response.status, 204);
  assert.equal(db.state.deliveries[0].status, 'delivered');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].properties.$insert_id, 'evt-test-1');
  assert.equal(mixpanelInitOptions.verbose, true);
});

test('analytics persists a valid GA client ID without forwarding it as an event property', async () => {
  const { validateAnalyticsBody, recordAnalyticsEvent, processAnalyticsDeliveries } = load('src/server/observability/analytics.ts');
  const validation = validateAnalyticsBody({ ...validBody(), gaClientId: '123456789.123456789' });
  assert.equal(validation.ok, true);
  assert.equal(validation.event.gaClientId, '123456789.123456789');
  await recordAnalyticsEvent(validation.event, ['mixpanel']);
  const calls = [];
  mixpanelTrack = (name, properties, callback) => {
    calls.push({ name, properties });
    callback(null);
  };
  await processAnalyticsDeliveries();
  assert.equal(db.state.events[0].properties._ga_client_id, '123456789.123456789');
  assert.equal(calls[0].properties._ga_client_id, undefined);
  assert.equal(validateAnalyticsBody({ ...validBody(), gaClientId: 'bad id' }).event?.gaClientId, null);
});

test('observability summary only requires a signed-in app session', async () => {
  const session = sessionFor('owner-1');
  db.state.sessions.push(session);
  const route = load('app/api/observability/summary/route.ts');
  assert.equal((await route.GET(new Request('http://localhost/api/observability/summary'))).status, 401);

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

async function seedDelivery(eventId = 'evt-race-1', environment = 'production') {
  const api = load('src/server/observability/analytics.ts');
  const validated = api.validateAnalyticsBody({ ...validBody(), eventId });
  await api.recordAnalyticsEvent({ ...validated.event, environment }, ['mixpanel']);
  return api;
}

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

for (const outcome of ['success', 'failure']) {
  test(`expired worker late ${outcome} cannot overwrite a newer delivery`, async () => {
    const api = await seedDelivery();
    const started = deferred();
    const pending = deferred();
    const first = api.processAnalyticsDeliveries({
      now: new Date('2026-10-12T10:01:00Z'), workerId: 'same-worker',
      senders: { mixpanel: () => { started.resolve(); return pending.promise; } },
    });
    await started.promise;
    const competing = await api.processAnalyticsDeliveries({
      now: new Date('2026-10-12T10:01:01Z'),
      senders: { mixpanel: async () => { throw new Error('must not run'); } },
    });
    assert.equal(competing.claimed, 0);
    const second = await api.processAnalyticsDeliveries({
      now: new Date('2026-10-12T10:02:01Z'), workerId: 'same-worker',
      senders: { mixpanel: async () => ({ ackId: 'new-owner' }) },
    });
    assert.equal(second.delivered, 1);
    if (outcome === 'success') pending.resolve({ ackId: 'stale-owner' });
    else pending.reject(new Error('late failure'));
    const stale = await first;
    assert.equal(stale.delivered + stale.retrying + stale.failed, 0);
    assert.equal(db.state.deliveries[0].status, 'delivered');
    assert.equal(db.state.deliveries[0].providerAckId, 'new-owner');
    assert.equal(db.state.deliveries[0].attempts, 2);
  });
}

test('hung sender is aborted and retried without a late completion changing state', async () => {
  const api = await seedDelivery();
  const pending = deferred();
  let signal;
  const result = await api.processAnalyticsDeliveries({
    now: new Date('2026-10-12T10:01:00Z'), sendTimeoutMs: 5,
    senders: { mixpanel: (_item, received) => { signal = received; return pending.promise; } },
  });
  assert.equal(result.retrying, 1);
  assert.equal(signal.aborted, true);
  pending.resolve({ ackId: 'late' });
  await Promise.resolve();
  assert.equal(db.state.deliveries[0].status, 'retrying');
});

test('claims get fresh leases and worker stops claiming at its time budget', async () => {
  const api = await seedDelivery();
  await seedDelivery('evt-race-2');
  await seedDelivery('evt-race-3');
  let time = Date.parse('2026-10-12T10:01:00Z');
  const leases = [];
  const result = await api.processAnalyticsDeliveries({
    clock: () => new Date(time),
    senders: { mixpanel: async (item) => {
      leases.push(db.state.deliveries.find((row) => row.id === item.id).leaseExpiresAt.getTime());
      time += 20_000;
      return {};
    } },
  });
  assert.equal(result.claimed, 2);
  assert.equal(leases[1] - leases[0], 20_000);
  assert.equal(db.state.deliveries[2].status, 'pending');
});

test('preview cannot process or disable production rows and summary is isolated', async () => {
  const api = await seedDelivery('evt-production', 'production');
  await seedDelivery('evt-preview', 'preview');
  process.env.VERCEL_ENV = 'preview';
  delete process.env.MIXPANEL_PROJECT_TOKEN;
  const result = await api.processAnalyticsDeliveries({ now: new Date('2026-10-12T10:01:00Z') });
  assert.equal(result.disabled, 1);
  assert.equal(db.state.deliveries[0].status, 'pending');
  db.state.deliveries[0].status = 'failed';
  const summary = await api.getAnalyticsDashboardSummary(new Date('2026-10-12T12:00:00Z'));
  assert.equal(summary.eventCount, 1);
  assert.deepEqual(summary.deliveryCounts, [{ destination: 'mixpanel', status: 'disabled', count: 1 }]);
  assert.deepEqual(summary.failedDeliveries, []);
});

test('Mixpanel retry payload keeps its canonical deduplication identity', async () => {
  const api = await seedDelivery();
  const calls = [];
  mixpanelTrack = (name, properties, callback) => {
    calls.push({ name, properties });
    callback(calls.length === 1 ? new Error('response lost') : null);
  };
  await api.processAnalyticsDeliveries({ now: new Date('2026-10-12T10:01:00Z') });
  await api.processAnalyticsDeliveries({ now: new Date('2026-10-12T10:02:00Z') });
  assert.deepEqual(calls[0], calls[1]);
  assert.equal(calls[0].properties.$insert_id, 'evt-race-1');
  await seedDelivery('evt-race-2');
  await api.processAnalyticsDeliveries({ now: new Date('2026-10-12T10:03:00Z') });
  assert.equal(calls[2].properties.$insert_id, 'evt-race-2');
});

test('manual delivery accepts either configured secret and rejects malformed auth', async () => {
  const route = load('app/api/cron/analytics-delivery/route.ts');
  const request = (value) => new Request('http://localhost/api/cron/analytics-delivery', {
    headers: value == null ? {} : { authorization: value },
  });
  assert.equal((await route.GET(request('Bearer undefined'))).status, 401);
  for (const [cron, manual] of [['cron', ''], ['', 'manual'], ['cron', 'manual'], ['same', 'same']]) {
    process.env.CRON_SECRET = cron;
    process.env.OBSERVABILITY_CRON_SECRET = manual;
    for (const secret of [cron, manual].filter(Boolean)) {
      assert.equal((await route.GET(request(`Bearer ${secret}`))).status, 200);
    }
    for (const header of [null, 'Bearer wrong', 'cron', 'Basic manual']) {
      assert.equal((await route.GET(request(header))).status, 401);
    }
  }
});
