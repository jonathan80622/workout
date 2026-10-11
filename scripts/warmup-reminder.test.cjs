const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

// Load the actual TypeScript modules with an isolated database double and a fake LINE fetch.
const root = path.resolve(__dirname, '..');
const cache = new Map();
let db;
function load(file) {
  file = path.resolve(root, file);
  if (!path.extname(file)) file += '.ts';
  if (cache.has(file)) return cache.get(file).exports;
  const module = { exports: {} };
  cache.set(file, module);
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const localRequire = (name) => {
    if (name === '@/src/server/db') return { prisma: new Proxy({}, { get: (_, key) => db[key] }) };
    if (name.startsWith('@/')) return load(name.slice(2));
    if (name.startsWith('.')) return load(path.resolve(path.dirname(file), name));
    return Module.createRequire(file)(name);
  };
  new Function('require', 'module', 'exports', code)(localRequire, module, module.exports);
  return module.exports;
}
const { newYorkTime, formatWarmupReminder, runWarmupReminder } = load('src/server/warmupReminder.ts');
const { readLineConfig } = load('src/server/line.ts');

// The real plan's warmup moves from the imported snapshot; secrets below are synthetic.
const snapshotMoves = JSON.parse(fs.readFileSync(path.join(root, 'data/imports/workout-data.json'), 'utf8')).trainingPlan.warmupMoves;
function planWith(moves) {
  const calls = [];
  db = { trainingPlan: { findFirst: async (args) => { calls.push(args); return moves && { warmupMoves: moves.map((move) => ({ name: move.name, targetText: move.target })) }; } } };
  return calls;
}

const env = { CRON_SECRET: 'cron-secret-test', LINE_CHANNEL_ID: '1234567890', LINE_CHANNEL_SECRET: 'channel-secret-test' };
const auth = `Bearer ${env.CRON_SECRET}`;
const nineAmEdt = new Date('2026-10-12T13:30:00Z');
const expectedText = 'Morning warmup ☀️\n・Hooklying — 6-8\n・四足跪姿左側彎 — 6-8\n・死蟲式 — 8下';

function fakeLine({ token = { status: 200, body: { access_token: 'stateless-token', expires_in: 900 } }, send = { status: 200, body: {} } } = {}) {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    const reply = url.includes('/oauth2/v3/token') ? token : send;
    if (reply instanceof Error) throw reply;
    return new Response(JSON.stringify(reply.body), { status: reply.status, headers: { 'x-line-request-id': 'req-1' } });
  };
  return { calls, fetchImpl };
}

// Silence expected logs while still letting tests inspect them.
async function quietly(fn) {
  const logged = [];
  const saved = [console.log, console.warn, console.error];
  console.log = console.warn = console.error = (...args) => logged.push(args.map(String).join(' '));
  try { return { result: await fn(), logged }; } finally { [console.log, console.warn, console.error] = saved; }
}

test('New York date and hour follow DST on both sides of each transition', () => {
  // Spring forward: 2026-03-08. Fall back: 2026-11-01.
  assert.deepEqual(newYorkTime(new Date('2026-03-07T13:00:00Z')), { date: '2026-03-07', hour: 8 });
  assert.deepEqual(newYorkTime(new Date('2026-03-09T13:00:00Z')), { date: '2026-03-09', hour: 9 });
  assert.deepEqual(newYorkTime(new Date('2026-10-31T13:00:00Z')), { date: '2026-10-31', hour: 9 });
  assert.deepEqual(newYorkTime(new Date('2026-11-02T13:00:00Z')), { date: '2026-11-02', hour: 8 });
  // Late evening New York is already the next UTC day.
  assert.deepEqual(newYorkTime(new Date('2026-10-12T03:30:00Z')), { date: '2026-10-11', hour: 23 });
});

test('vercel.json keeps the Git setting and schedules one Hobby-compatible daily cron', () => {
  const config = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'));
  assert.deepEqual(config.git, { deploymentEnabled: { main: false } });
  // Hobby allows one run per day. 13:00 UTC is 9 AM New York in EDT and 8 AM in EST.
  assert.deepEqual(config.crons, [{ path: '/api/cron/warmup-reminder', schedule: '0 13 * * *' }]);
});

test('message lists the plan warmup moves in order', () => {
  assert.equal(formatWarmupReminder(snapshotMoves), expectedText);
  assert.equal(formatWarmupReminder([{ name: 'Plank', target: '' }]), 'Morning warmup ☀️\n・Plank');
});

test('missing or wrong cron secret is rejected before any database or LINE call', async () => {
  const dbCalls = planWith(snapshotMoves);
  const line = fakeLine();
  for (const header of [null, 'Bearer wrong', env.CRON_SECRET, `Bearer ${env.CRON_SECRET} `]) {
    const result = await runWarmupReminder(header, { now: nineAmEdt, env, fetchImpl: line.fetchImpl });
    assert.equal(result.status, 401, String(header));
  }
  const { result } = await quietly(() => runWarmupReminder(auth, { now: nineAmEdt, env: { ...env, CRON_SECRET: '' }, fetchImpl: line.fetchImpl }));
  assert.equal(result.status, 500);
  assert.equal(dbCalls.length, 0);
  assert.equal(line.calls.length, 0);
});

test('an authorized run reads the current plan and broadcasts its warmup', async () => {
  const dbCalls = planWith(snapshotMoves);
  const line = fakeLine();
  const { result, logged } = await quietly(() => runWarmupReminder(auth, { now: nineAmEdt, env, fetchImpl: line.fetchImpl }));
  assert.deepEqual(result, { status: 200, body: { sent: true, date: '2026-10-12', moves: 3 } });
  assert.deepEqual(dbCalls[0].where, { isCurrent: true });

  const [tokenCall, sendCall] = line.calls;
  assert.equal(tokenCall.url, 'https://api.line.me/oauth2/v3/token');
  assert.equal(tokenCall.init.body.toString(), 'grant_type=client_credentials&client_id=1234567890&client_secret=channel-secret-test');
  assert.equal(sendCall.url, 'https://api.line.me/v2/bot/message/broadcast');
  assert.equal(sendCall.init.headers.Authorization, 'Bearer stateless-token');
  assert.match(sendCall.init.headers['X-Line-Retry-Key'], /^[0-9a-f-]{36}$/);
  assert.deepEqual(JSON.parse(sendCall.init.body), { messages: [{ type: 'text', text: expectedText }] });
  assert.equal(logged.some((entry) => entry.includes(env.LINE_CHANNEL_SECRET) || entry.includes('stateless-token')), false);
});

test('LINE errors, malformed tokens, and timeouts surface as 502 without leaking credentials', async () => {
  const timeout = Object.assign(new Error('aborted'), { name: 'TimeoutError' });
  const cases = [
    [{ token: { status: 400, body: { error: 'invalid_client', message: 'Invalid client' } } }, 'LINE token request failed: HTTP 400 (Invalid client)'],
    [{ token: { status: 200, body: {} } }, 'LINE token response had no access_token.'],
    [{ token: timeout }, 'LINE token request timed out.'],
    [{ send: { status: 429, body: { message: 'You have reached your monthly limit.' } } }, 'LINE broadcast failed: HTTP 429 (You have reached your monthly limit.)'],
    [{ send: timeout }, 'LINE broadcast request timed out.'],
  ];
  for (const [replies, expected] of cases) {
    planWith(snapshotMoves);
    const line = fakeLine(replies);
    const { result, logged } = await quietly(() => runWarmupReminder(auth, { now: nineAmEdt, env, fetchImpl: line.fetchImpl }));
    assert.deepEqual(result, { status: 502, body: { sent: false, reason: 'line-error', date: '2026-10-12' } });
    assert.ok(logged.some((entry) => entry.includes(expected)), `${expected}\n${logged.join('\n')}`);
    assert.equal(logged.some((entry) => entry.includes(env.LINE_CHANNEL_SECRET) || entry.includes('stateless-token')), false);
  }
});

test('missing channel credentials fail before any LINE call', async () => {
  assert.throws(() => readLineConfig({}), /Missing LINE_CHANNEL_ID, LINE_CHANNEL_SECRET/);
  planWith(snapshotMoves);
  const line = fakeLine();
  const { result } = await quietly(() => runWarmupReminder(auth, { now: nineAmEdt, env: { CRON_SECRET: env.CRON_SECRET }, fetchImpl: line.fetchImpl }));
  assert.equal(result.status, 502);
  assert.equal(line.calls.length, 0);
});

test('no current plan or an empty warmup skips without inventing moves', async () => {
  for (const [moves, reason] of [[null, 'no-current-plan'], [[], 'no-warmup-moves']]) {
    planWith(moves);
    const line = fakeLine();
    const { result } = await quietly(() => runWarmupReminder(auth, { now: nineAmEdt, env, fetchImpl: line.fetchImpl }));
    assert.deepEqual(result, { status: 200, body: { sent: false, reason, date: '2026-10-12' } });
    assert.equal(line.calls.length, 0);
  }
});

test('database failure returns 503 without calling LINE', async () => {
  db = { trainingPlan: { findFirst: async () => { throw new Error('connection refused'); } } };
  const line = fakeLine();
  const { result } = await quietly(() => runWarmupReminder(auth, { now: nineAmEdt, env, fetchImpl: line.fetchImpl }));
  assert.equal(result.status, 503);
  assert.equal(line.calls.length, 0);
});
