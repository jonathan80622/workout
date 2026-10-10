import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is required.');
  process.exit(1);
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const prismaBin = resolve(root, 'node_modules/.bin/prisma');

const migrate = spawnSync(prismaBin, ['migrate', 'deploy'], {
  cwd: root,
  env: process.env,
  stdio: 'inherit',
});

if (migrate.status !== 0) {
  process.exit(migrate.status ?? 1);
}

const verify = spawnSync(process.execPath, ['scripts/verify-database.mjs'], {
  cwd: root,
  env: process.env,
  stdio: 'inherit',
});

process.exit(verify.status ?? 1);
