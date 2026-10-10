import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const script = fileURLToPath(new URL('./prepare-production-env.mjs', import.meta.url));
const workflow = fileURLToPath(new URL('../.github/workflows/deploy-production.yml', import.meta.url));

function run(databaseUrl = '') {
  return spawnSync(process.execPath, [script], {
    env: { ...process.env, DATABASE_URL: databaseUrl },
    encoding: 'utf8',
  });
}

test('missing database URL blocks deployment', () => {
  for (const url of ['', '  ', '[SENSITIVE]']) {
    const result = run(url);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /DATABASE_URL/);
  }
});

test('non-PostgreSQL database URLs fail with actionable messages', () => {
  for (const url of ['prisma+postgres://example.com/db', 'https://example.com', 'postgresql://']) {
    const result = run(url);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /PostgreSQL connection string/);
  }
});

test('both native PostgreSQL URL protocols are accepted', () => {
  for (const url of ['postgres://localhost/db', 'postgresql://localhost/db']) {
    const result = run(url);
    assert.equal(result.status, 0);
    assert.equal(result.stdout, 'Production migration environment is ready.\n');
  }
});

test('production deploy lets Vercel build with project environment variables', () => {
  const contents = readFileSync(workflow, 'utf8');

  assert.doesNotMatch(contents, /vercel pull/);
  assert.doesNotMatch(contents, /vercel build/);
  assert.doesNotMatch(contents, /--prebuilt/);
  assert.doesNotMatch(contents, /NEXT_PUBLIC_GOOGLE_CLIENT_ID/);
  assert.match(contents, /vercel deploy --prod --yes --token="\$VERCEL_TOKEN"/);
});
