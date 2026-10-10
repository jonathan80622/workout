import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const script = fileURLToPath(new URL('./prepare-production-env.mjs', import.meta.url));

function run(contents, actions = false, databaseUrl = '') {
  const cwd = mkdtempSync(join(tmpdir(), 'workout-env-test-'));
  try {
    if (contents !== undefined) {
      mkdirSync(join(cwd, '.vercel'));
      writeFileSync(join(cwd, '.vercel/.env.production.local'), contents);
    }
    return spawnSync(process.execPath, [script], {
      cwd,
      env: { ...process.env, GITHUB_ACTIONS: String(actions), DATABASE_URL: databaseUrl },
      encoding: 'utf8',
    });
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
}

test('missing file or database URL blocks deployment', () => {
  for (const contents of [undefined, 'OTHER=value', 'DATABASE_URL="  "']) {
    assert.equal(run(contents).status, 1);
  }
});

test('quoted URL is parsed without shell evaluation or local disclosure', () => {
  const result = run('DATABASE_URL="[SENSITIVE]"', false, 'postgresql://user:p$a%23ss@localhost/db?sslmode=require');
  assert.equal(result.status, 0);
  assert.equal(result.stdout, 'Production environment is ready.\n');
});

test('Actions masks credentials but leaves common flags and environment names readable', () => {
  const result = run('DATABASE_URL="postgresql://localhost/db"\nAPI_SECRET="first%line\nsecond"\nVERCEL="1"\nVERCEL_ENV="production"', true, 'postgresql://localhost/db');
  assert.equal(result.status, 0);
  assert.match(result.stdout, /::add-mask::postgresql:\/\/localhost\/db/);
  assert.match(result.stdout, /::add-mask::first%25line%0Asecond/);
  assert.doesNotMatch(result.stdout, /::add-mask::(?:1|production)\n/);
});

test('sensitive placeholders and non-PostgreSQL URLs fail with actionable messages', () => {
  for (const url of ['', '[SENSITIVE]', 'prisma+postgres://example.com/db', 'https://example.com', 'postgresql://']) {
    const result = run('DATABASE_URL="[SENSITIVE]"', false, url);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /GitHub.*DATABASE_URL/);
    assert.doesNotMatch(result.stdout, /Production environment is ready/);
  }
});

test('both native PostgreSQL URL protocols are accepted', () => {
  for (const url of ['postgres://localhost/db', 'postgresql://localhost/db']) {
    assert.equal(run('DATABASE_URL="[SENSITIVE]"', false, url).status, 0);
  }
});
