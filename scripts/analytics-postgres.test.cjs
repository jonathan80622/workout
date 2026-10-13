const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const { PrismaClient } = require('@prisma/client');
const { randomUUID } = require('node:crypto');

test('PostgreSQL fences stale claims and isolates environments', {
  skip: !process.env.ANALYTICS_TEST_DATABASE_URL,
}, async () => {
  const prisma = new PrismaClient({ datasourceUrl: process.env.ANALYTICS_TEST_DATABASE_URL });
  const cache = new Map();
  function load(relative) {
    const file = path.resolve(__dirname, '..', relative.endsWith('.ts') ? relative : `${relative}.ts`);
    if (cache.has(file)) return cache.get(file).exports;
    const module = { exports: {} };
    cache.set(file, module);
    const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    }).outputText;
    const requireLocal = (name) => {
      if (name === '@/src/server/db') return { prisma };
      if (name.startsWith('@/')) return load(name.slice(2));
      return Module.createRequire(file)(name);
    };
    new Function('require', 'module', 'exports', code)(requireLocal, module, module.exports);
    return module.exports;
  }
  const api = load('src/server/observability/analytics');
  const environment = `test-${randomUUID()}`;
  const oldEnvironment = process.env.VERCEL_ENV;
  process.env.VERCEL_ENV = environment;
  const ids = [];
  try {
    for (const outcome of ['success', 'failure']) {
      const eventId = randomUUID();
      ids.push(eventId);
      const validated = api.validateAnalyticsBody({ event: 'tab_viewed', eventId, distinctId: 'workout_test', properties: { tab: 'history' } });
      await api.recordAnalyticsEvent(validated.event, ['mixpanel']);
      let release, reject, started;
      const entered = new Promise((resolve) => { started = resolve; });
      const pending = new Promise((resolve, fail) => { release = resolve; reject = fail; });
      const now = new Date();
      const first = api.processAnalyticsDeliveries({ now, workerId: 'reused-worker', senders: {
        mixpanel: () => { started(); return pending; },
      } });
      await entered;
      const competing = await api.processAnalyticsDeliveries({ now, senders: {
        mixpanel: async () => { throw new Error('live lease must not be claimed'); },
      } });
      assert.equal(competing.claimed, 0);
      const second = await api.processAnalyticsDeliveries({
        now: new Date(now.getTime() + 61_000), workerId: 'reused-worker',
        senders: { mixpanel: async () => ({ ackId: 'new-owner' }) },
      });
      assert.equal(second.delivered, 1);
      if (outcome === 'success') release({ ackId: 'old-owner' });
      else reject(new Error('late failure'));
      const stale = await first;
      assert.equal(stale.delivered + stale.retrying + stale.failed, 0);
      const row = await prisma.analyticsDelivery.findFirstOrThrow({ where: { eventId } });
      assert.equal(row.status, 'delivered');
      assert.equal(row.providerAckId, 'new-owner');
      assert.equal(row.attempts, 2);
    }
    const foreignId = randomUUID();
    ids.push(foreignId);
    const validated = api.validateAnalyticsBody({ event: 'tab_viewed', eventId: foreignId, distinctId: 'workout_test', properties: { tab: 'history' } });
    await api.recordAnalyticsEvent({ ...validated.event, environment: `${environment}-foreign` }, ['mixpanel']);
    const result = await api.processAnalyticsDeliveries({ senders: { mixpanel: async () => ({}) } });
    assert.equal(result.claimed, 0);
    const foreign = await prisma.analyticsDelivery.findFirstOrThrow({ where: { eventId: foreignId } });
    assert.equal(foreign.status, 'pending');
    const summary = await api.getAnalyticsDashboardSummary();
    assert.equal(summary.eventCount, 2);
    assert.deepEqual(summary.deliveryCounts, [{ destination: 'mixpanel', status: 'delivered', count: 2 }]);
  } finally {
    await prisma.analyticsDelivery.deleteMany({ where: { eventId: { in: ids } } });
    await prisma.analyticsEvent.deleteMany({ where: { eventId: { in: ids } } });
    await prisma.$disconnect();
    if (oldEnvironment === undefined) delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV = oldEnvironment;
  }
});
