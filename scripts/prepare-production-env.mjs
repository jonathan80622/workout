import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';

let environment;
try {
  environment = parseEnv(readFileSync('.vercel/.env.production.local', 'utf8'));
} catch {
  console.error('Could not read the production environment. Run vercel pull first.');
  process.exit(1);
}

// Pulled Vercel secrets are not automatically masked by GitHub Actions.
if (process.env.GITHUB_ACTIONS === 'true') {
  for (const [key, value] of Object.entries(environment)) {
    if (value && value !== '[SENSITIVE]' && !key.startsWith('NEXT_PUBLIC_') &&
        /TOKEN|SECRET|PASSWORD|DATABASE_URL|API_KEY|PRIVATE_KEY/i.test(key)) {
      const escaped = value.replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A');
      console.log(`::add-mask::${escaped}`);
    }
  }
}

const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl || databaseUrl === '[SENSITIVE]') {
  console.error('Add a GitHub Actions secret named DATABASE_URL containing the production PostgreSQL connection string. Vercel sensitive values cannot be downloaded.');
  process.exit(1);
}

try {
  const parsed = new URL(databaseUrl);
  if (!['postgresql:', 'postgres:'].includes(parsed.protocol) || !parsed.hostname) {
    throw new Error('Invalid PostgreSQL URL');
  }
} catch {
  console.error('GitHub DATABASE_URL must be a PostgreSQL connection string starting with postgresql:// or postgres://, not a placeholder or Prisma API URL.');
  process.exit(1);
}

console.log('Production environment is ready.');
