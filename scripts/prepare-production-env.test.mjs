import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const script = fileURLToPath(new URL('./prepare-production-env.mjs', import.meta.url));

function run(contents, actions = false) {
  const cwd = mkdtempSync(join(tmpdir(), 'workout-env-test-'));
  try {
    if (contents !== undefined) {
      mkdirSync(join(cwd, '.vercel'));
      writeFileSync(join(cwd, '.vercel/.env.production.local'), contents);
    }
    return spawnSync(process.execPath, [script], {
      cwd,
      env: { ...process.env, GITHUB_ACTIONS: String(actions) },
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
  const result = run('DATABASE_URL="postgresql://user:p$a%23ss@localhost/db?sslmode=require"');
  assert.equal(result.status, 0);
  assert.equal(result.stdout, 'Production environment is ready.\n');
});

test('Actions masks every downloaded value and escapes command control characters', () => {
  const result = run('DATABASE_URL="postgresql://localhost/db"\nOTHER="first%line\nsecond"', true);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /::add-mask::postgresql:\/\/localhost\/db/);
  assert.match(result.stdout, /::add-mask::first%25line%0Asecond/);
});
