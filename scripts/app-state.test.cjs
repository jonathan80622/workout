const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

// Load the actual TypeScript modules with an isolated database double.
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
    if (name === '@/src/server/db') return { prisma: new Proxy({}, { get: (_, key) => key === '$transaction' ? async (fn) => fn(db) : db[key] }) };
    if (name.startsWith('@/')) return load(name.slice(2));
    if (name.startsWith('.')) return load(path.resolve(path.dirname(file), name));
    return Module.createRequire(file)(name);
  };
  new Function('require', 'module', 'exports', code)(localRequire, module, module.exports);
  return module.exports;
}
const { normalizeAppState, createDefaultAppState, readLocalState } = load('src/utils/driveStorage.ts');
const { getHistoricalExercises } = load('src/utils/exerciseHistory.ts');
const { writeWorkoutAppState, readWorkoutAppState, StateConflictError, OWNER_AUTH_SUBJECT } = load('src/server/appStateStore.ts');
process.env.AUTH_SECRET = 'test-only-auth-secret-at-least-32-characters';
const { signSession, encryptSecret, decryptSecret } = load('src/server/auth.ts');
const linkedAccount = { id: 'account-1', ownerUserId: 'owner-1' };
const withSession = (accountId) => ({ cookie: `workout_session=${signSession(accountId)}` });
const accounts = (...rows) => ({ findUnique: async ({ where }) => rows.find((row) => row.id === where.id) || null });
const seed = JSON.parse(fs.readFileSync(path.join(root, 'e2e/jev-use/seed.json'), 'utf8'));
const importedSnapshot = JSON.parse(fs.readFileSync(path.join(root, 'data/imports/workout-data.json'), 'utf8'));

test('actual Mandarin workout logs supply every picker choice; machine presets supply none', () => {
  const state = normalizeAppState(importedSnapshot);
  assert.equal(state.workouts.length, 9);
  assert.equal(state.workouts.flatMap((workout) => workout.exercises).length, 37);
  const expected = [...new Set(importedSnapshot.workouts.filter((workout) => workout.isCompleted)
    .flatMap((workout) => workout.exercises.map((exercise) => exercise.machineName.trim())))].sort();
  const names = getHistoricalExercises(state.workouts).map((exercise) => exercise.name);
  assert.deepEqual([...names].sort(), expected);
  assert.equal(names.length, 12);
  assert.ok(names.includes('Life 機械正手下拉'));
  assert.ok(names.includes('海默二頭彎舉'));
  for (const preset of importedSnapshot.machines) assert.equal(names.includes(preset.name), false, preset.name);
  assert.equal(names.some((name) => name.includes('Leg Press')), false);
  const poisoned = { ...importedSnapshot, machines: [{ name: 'UNWANTED PRESET' }] };
  assert.deepEqual(getHistoricalExercises(normalizeAppState(poisoned).workouts), getHistoricalExercises(state.workouts));
});

test('empty startup and normalization never invent sample workouts or picker entries', () => {
  assert.deepEqual(createDefaultAppState().workouts, []);
  assert.deepEqual(normalizeAppState({}).workouts, []);
  assert.deepEqual(readLocalState().workouts, []);
  assert.deepEqual(getHistoricalExercises([]), []);
});

test('legacy names become exerciseName without losing sets, videos, or feedback', () => {
  const input = structuredClone(seed);
  const exercise = input.workouts[0].exercises[0];
  exercise.machineName = 'Legacy exercise';
  delete exercise.exerciseName;
  exercise.ptComment = 'VU VU';
  const output = normalizeAppState(input);
  const saved = output.workouts[0].exercises[0];
  assert.equal(saved.exerciseName, 'Legacy exercise');
  assert.equal(saved.ptComment, 'VU VU');
  assert.deepEqual(saved.sets, exercise.sets);
  assert.equal('machineName' in saved, false);
  assert.equal('machines' in output, false);
});

test('new names take precedence over legacy names', () => {
  const input = structuredClone(seed);
  input.workouts[0].exercises[0].machineName = 'Old';
  const output = normalizeAppState(input);
  assert.equal(output.workouts[0].exercises[0].exerciseName, input.workouts[0].exercises[0].exerciseName);
});

function fakeDatabase(revisionMatches = true) {
  const calls = [];
  const models = ['user', 'workout', 'exerciseLog', 'workoutSet', 'video', 'profile', 'trainingPlan', 'warmupCheckin', 'scheduledSession'];
  const result = { calls };
  for (const model of models) {
    result[model] = {};
    for (const operation of ['upsert', 'update', 'updateMany', 'deleteMany', 'create', 'createMany']) {
      result[model][operation] = async (args) => {
        calls.push({ model, operation, args });
        return operation === 'updateMany' ? { count: revisionMatches ? 1 : 0 } : { id: `${model}-id` };
      };
    }
  }
  return result;
}

test('Prisma writes exerciseName and preserves workout and exercise identities', async () => {
  db = fakeDatabase();
  const input = { ...normalizeAppState(seed), revision: 3 };
  const saved = await writeWorkoutAppState(input, 'owner-1');
  assert.equal(saved.revision, 4);
  const exerciseWrites = db.calls.filter((call) => call.model === 'exerciseLog' && call.operation === 'upsert');
  assert.ok(exerciseWrites.length > 0);
  assert.equal(exerciseWrites[0].args.create.exerciseName, input.workouts[0].exercises[0].exerciseName);
  assert.equal('machineName' in exerciseWrites[0].args.create, false);
  assert.deepEqual(exerciseWrites[0].args.update, exerciseWrites[0].args.create);
  const deletes = db.calls.filter((call) => ['workout', 'exerciseLog'].includes(call.model) && call.operation === 'deleteMany');
  assert.ok(deletes.every((call) => call.args.where.NOT.legacyId.in.length > 0));
  assert.ok(!db.calls.some((call) => call.model === 'machinePreset'));
});

test('actual import writes only the 37 Mandarin exercise occurrences to Prisma', async () => {
  db = fakeDatabase();
  await writeWorkoutAppState({ ...normalizeAppState(importedSnapshot), revision: 0 }, 'owner-1');
  const writes = db.calls.filter((call) => call.model === 'exerciseLog' && call.operation === 'upsert');
  assert.equal(writes.length, 37);
  assert.deepEqual(writes.map((call) => call.args.create.exerciseName), importedSnapshot.workouts.flatMap((workout) => workout.exercises.map((exercise) => exercise.machineName)));
  assert.equal(writes.some((call) => call.args.create.exerciseName.includes('Leg Press')), false);
});

test('stale state is rejected before any workout writes', async () => {
  db = fakeDatabase(false);
  await assert.rejects(writeWorkoutAppState({ ...normalizeAppState(seed), revision: 2 }, 'owner-1'), StateConflictError);
  assert.ok(db.calls.every((call) => call.model === 'user'));
});

test('partial or invalid state cannot silently erase workouts', async () => {
  db = fakeDatabase();
  await assert.rejects(writeWorkoutAppState({ revision: 1 }, 'owner-1'), TypeError);
  const input = { ...normalizeAppState(seed), revision: 1 };
  delete input.workouts[0].exercises[0].exerciseName;
  await assert.rejects(writeWorkoutAppState(input, 'owner-1'), TypeError);
  assert.equal(db.calls.length, 0);
});

test('an empty database returns an empty workout collection', async () => {
  db = { user: { findUnique: async () => null } };
  const state = await readWorkoutAppState();
  assert.deepEqual(state.workouts, []);
  assert.equal(state.revision, 0);
  assert.equal('machines' in state, false);
});

test('PT rejects a wrong password without reading or writing the database', async () => {
  process.env.PT_VIEW_PASSWORD = 'test-only-password';
  db = {};
  const route = load('app/api/pt-state/route.ts');
  const request = () => new Request('http://localhost/api/pt-state', { method: 'POST', body: JSON.stringify({ password: 'wrong' }) });
  assert.equal((await route.POST(request())).status, 401);
  assert.equal((await route.PATCH(request())).status, 401);
});

test('PT comment writes only the selected exercise and increments the owner revision', async () => {
  db = fakeDatabase();
  db.workout.findUniqueOrThrow = async () => ({ id: 'existing-workout' });
  const route = load('app/api/pt-state/route.ts');
  const response = await route.PATCH(new Request('http://localhost/api/pt-state', { method: 'PATCH', body: JSON.stringify({ password: 'test-only-password', workoutId: 'legacy-workout', exerciseId: 'legacy-exercise', text: 'VU VU' }) }));
  assert.equal(response.status, 200);
  assert.deepEqual(db.calls.map((call) => [call.model, call.operation]), [['user', 'update'], ['exerciseLog', 'update']]);
  assert.deepEqual(db.calls[0].args.data, { stateRevision: { increment: 1 } });
  assert.deepEqual(db.calls[1].args, {
    where: { workoutId_legacyId: { workoutId: 'existing-workout', legacyId: 'legacy-exercise' } }, data: { ptComment: 'VU VU' },
  });
});

test('body weight reads convert Prisma decimals into UI values', async () => {
  db = { account: accounts(linkedAccount), bodyWeightEntry: { findMany: async ({ where }) => where.ownerId !== 'owner-1' ? [] : [{ legacyId: 'weight-1', date: new Date('2026-10-11'), weightKg: { toNumber: () => 80 }, sourceValue: { toNumber: () => 80 }, sourceUnit: 'kg' }] } };
  const route = load('app/api/body-weights/route.ts');
  const response = await route.GET(new Request('http://localhost/api/body-weights', { headers: withSession('account-1') }));
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).entries[0], { schemaVersion: 1, id: 'weight-1', date: '2026-10-11', weightKg: 80, sourceValue: 80, sourceUnit: 'kg' });
});

test('invalid body weights are rejected before database writes', async () => {
  db = {};
  const route = load('app/api/body-weights/route.ts');
  const response = await route.POST(new Request('http://localhost/api/body-weights', { method: 'POST', body: JSON.stringify({ date: '2026-10-11', weightKg: -1 }) }));
  assert.equal(response.status, 400);
});

test('workout and weight routes require a signed-in account linked to an owner', async () => {
  const appState = load('app/api/app-state/route.ts');
  const weights = load('app/api/body-weights/route.ts');
  db = { account: accounts(linkedAccount, { id: 'account-2', ownerUserId: null }) };
  const get = (headers) => new Request('http://localhost/api/app-state', { headers });
  assert.equal((await appState.GET(get({}))).status, 401);
  assert.equal((await appState.GET(get(withSession('account-2')))).status, 403);
  assert.equal((await appState.GET(get(withSession('missing-account')))).status, 401);
  assert.equal((await appState.PUT(new Request('http://localhost/api/app-state', { method: 'PUT', body: '{}' }))).status, 401);
  assert.equal((await weights.GET(new Request('http://localhost/api/body-weights'))).status, 401);
  assert.equal((await weights.DELETE(new Request('http://localhost/api/body-weights', { method: 'DELETE', body: JSON.stringify({ id: 'weight-1' }) }))).status, 401);
});

test('a tampered or expired session is rejected', async () => {
  const route = load('app/api/app-state/route.ts');
  db = { account: accounts(linkedAccount, { id: 'account-9', ownerUserId: 'owner-9' }) };
  const [, expires, signature] = signSession('account-1').split('.');
  const forged = `workout_session=account-9.${expires}.${signature}`;
  assert.equal((await route.GET(new Request('http://localhost/api/app-state', { headers: { cookie: forged } }))).status, 401);
  const expired = `workout_session=${signSession('account-1', Date.now() - 91 * 24 * 60 * 60 * 1000)}`;
  assert.equal((await route.GET(new Request('http://localhost/api/app-state', { headers: { cookie: expired } }))).status, 401);
});

test('the app reads the linked owner by id', async () => {
  const route = load('app/api/app-state/route.ts');
  let lookedUp;
  db = { account: accounts(linkedAccount), user: { findUnique: async ({ where }) => { lookedUp = where; return null; } } };
  assert.equal((await route.GET(new Request('http://localhost/api/app-state', { headers: withSession('account-1') }))).status, 200);
  assert.deepEqual(lookedUp, { id: 'owner-1' });
});

test('the PT portal still reads the imported owner and needs no Google session', async () => {
  const route = load('app/api/pt-state/route.ts');
  let lookedUp;
  db = { user: { findUnique: async ({ where }) => { lookedUp = where; return null; } } };
  const response = await route.POST(new Request('http://localhost/api/pt-state', { method: 'POST', body: JSON.stringify({ password: 'test-only-password' }) }));
  assert.equal(response.status, 200);
  assert.deepEqual(lookedUp, { authSubject: 'legacy-import:workout-data' });
  assert.equal(OWNER_AUTH_SUBJECT, 'legacy-import:workout-data');
});

test('refresh tokens are encrypted and tamper-evident', () => {
  const stored = encryptSecret('refresh-token-value');
  assert.doesNotMatch(stored, /refresh-token-value/);
  assert.equal(decryptSecret(stored), 'refresh-token-value');
  const [iv, tag, data] = stored.split('.');
  assert.throws(() => decryptSecret([iv, tag, data.slice(0, -2) + (data.endsWith('A') ? 'B' : 'A')].join('.')));
});

test('sign-in sends the user to Google with PKCE, offline access and the Drive scope', async () => {
  process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID = '123-test.apps.googleusercontent.com';
  process.env.GOOGLE_CLIENT_SECRET = 'test-only-client-secret';
  db = { account: accounts() };
  const route = load('app/api/auth/google/route.ts');
  const response = await route.GET(new Request('https://workout.example/api/auth/google'));
  const location = new URL(response.headers.get('location'));
  assert.equal(location.origin, 'https://accounts.google.com');
  assert.equal(location.searchParams.get('redirect_uri'), 'https://workout.example/api/auth/google/callback');
  assert.equal(location.searchParams.get('access_type'), 'offline');
  assert.equal(location.searchParams.get('code_challenge_method'), 'S256');
  assert.match(location.searchParams.get('scope'), /drive\.file/);
  assert.equal(location.searchParams.has('prompt'), false);
  assert.match(response.headers.get('set-cookie'), /workout_oauth=.*HttpOnly/i);
});

test('sign-in callback rejects a mismatched state without calling Google', async () => {
  const route = load('app/api/auth/google/callback/route.ts');
  const originalFetch = global.fetch;
  global.fetch = async () => { throw new Error('Google must not be called'); };
  try {
    const response = await route.GET(new Request('https://workout.example/api/auth/google/callback?code=c&state=attacker', { headers: { cookie: 'workout_oauth=expected.verifier.0' } }));
    assert.equal(new URL(response.headers.get('location')).searchParams.get('auth_error'), 'state');
  } finally {
    global.fetch = originalFetch;
  }
});

test('sign-in callback stores the encrypted refresh token and starts a session', async () => {
  const route = load('app/api/auth/google/callback/route.ts');
  const idToken = ['header', Buffer.from(JSON.stringify({ iss: 'https://accounts.google.com', aud: '123-test.apps.googleusercontent.com', sub: 'google-sub-1', email: 'me@example.com', exp: Math.floor(Date.now() / 1000) + 300 })).toString('base64url'), 'sig'].join('.');
  let tokenRequest;
  let saved;
  const originalFetch = global.fetch;
  global.fetch = async (url, init) => {
    tokenRequest = Object.fromEntries(new URLSearchParams(init.body));
    return new Response(JSON.stringify({ id_token: idToken, refresh_token: 'refresh-1', scope: 'openid https://www.googleapis.com/auth/drive.file' }));
  };
  db = { account: { upsert: async (args) => { saved = args; return { id: 'account-1', encryptedRefreshToken: args.create.encryptedRefreshToken }; } } };
  try {
    const response = await route.GET(new Request('https://workout.example/api/auth/google/callback?code=c&state=s1', { headers: { cookie: 'workout_oauth=s1.verifier-1.0' } }));
    assert.equal(new URL(response.headers.get('location')).pathname, '/');
    assert.equal(tokenRequest.code_verifier, 'verifier-1');
    assert.equal(saved.where.googleSub, 'google-sub-1');
    assert.equal(decryptSecret(saved.create.encryptedRefreshToken), 'refresh-1');
    assert.match(response.headers.get('set-cookie'), /workout_session=account-1\./);
  } finally {
    global.fetch = originalFetch;
  }
});
