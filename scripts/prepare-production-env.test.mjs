import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { parseEnv } from 'node:util';

const script = fileURLToPath(new URL('./prepare-production-env.mjs', import.meta.url));

function run(contents, actions = false, databaseUrl = '', googleClientId = '123-example.apps.googleusercontent.com') {
  const cwd = mkdtempSync(join(tmpdir(), 'workout-env-test-'));
  try {
    if (contents !== undefined) {
      mkdirSync(join(cwd, '.vercel'));
      writeFileSync(join(cwd, '.vercel/.env.production.local'), contents);
    }
    const result = spawnSync(process.execPath, [script], {
      cwd,
      env: {
        ...process.env,
        GITHUB_ACTIONS: String(actions),
        DATABASE_URL: databaseUrl,
        NEXT_PUBLIC_GOOGLE_CLIENT_ID: googleClientId,
      },
      encoding: 'utf8',
    });
    if (contents !== undefined) {
      result.envFile = readFileSync(join(cwd, '.vercel/.env.production.local'), 'utf8');
    }
    return result;
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
  const result = run(
    'DATABASE_URL="[SENSITIVE]"\nNEXT_PUBLIC_GOOGLE_CLIENT_ID="[SENSITIVE]"',
    false,
    'postgresql://user:p$a%23ss@localhost/db?sslmode=require',
  );
  assert.equal(result.status, 0);
  assert.equal(result.stdout, 'Production environment is ready.\n');
});

test('reproduces the broken deploy env that sent a placeholder as the Google OAuth client id', () => {
  const pulledVercelEnv = parseEnv([
    'DATABASE_URL="[SENSITIVE]"',
    'NEXT_PUBLIC_GOOGLE_CLIENT_ID="[SENSITIVE]"',
  ].join('\n'));

  const buildEnvBeforeFix = {
    ...pulledVercelEnv,
    DATABASE_URL: 'postgresql://localhost/db',
  };

  assert.equal(buildEnvBeforeFix.NEXT_PUBLIC_GOOGLE_CLIENT_ID, '[SENSITIVE]');
  assert.equal(getDriveGoogleClientIdFromBuildEnv(buildEnvBeforeFix), '[SENSITIVE]');
  assert.equal(isGoogleOAuthClientId(buildEnvBeforeFix.NEXT_PUBLIC_GOOGLE_CLIENT_ID), false);
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

test('Google OAuth client ID is required when Vercel pulls a sensitive placeholder', () => {
  const result = run(
    'DATABASE_URL="[SENSITIVE]"\nNEXT_PUBLIC_GOOGLE_CLIENT_ID="[SENSITIVE]"',
    false,
    'postgresql://localhost/db',
    '',
  );

  assert.equal(result.status, 1);
  assert.match(result.stderr, /NEXT_PUBLIC_GOOGLE_CLIENT_ID/);
});

test('GitHub Google client ID replaces Vercel sensitive placeholder for the build', () => {
  const result = run(
    'DATABASE_URL="[SENSITIVE]"\nNEXT_PUBLIC_GOOGLE_CLIENT_ID="[SENSITIVE]"\nOTHER=value',
    false,
    'postgresql://localhost/db',
    '987-production.apps.googleusercontent.com',
  );

  assert.equal(result.status, 0);
  assert.equal(result.stdout, 'Production environment is ready.\n');
  assert.match(result.envFile, /NEXT_PUBLIC_GOOGLE_CLIENT_ID="987-production\.apps\.googleusercontent\.com"/);
  assert.doesNotMatch(result.envFile, /NEXT_PUBLIC_GOOGLE_CLIENT_ID="\[SENSITIVE\]"/);
});

function getDriveGoogleClientIdFromBuildEnv(buildEnv) {
  return buildEnv.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
}

function isGoogleOAuthClientId(value) {
  return Boolean(value && value !== '[SENSITIVE]' && /^[0-9a-z-]+\.apps\.googleusercontent\.com$/i.test(value));
}
