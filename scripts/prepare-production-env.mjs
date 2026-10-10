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
  for (const value of Object.values(environment)) {
    if (value) {
      const escaped = value.replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A');
      console.log(`::add-mask::${escaped}`);
    }
  }
}

if (!environment.DATABASE_URL?.trim()) {
  console.error('DATABASE_URL is missing from the Vercel production environment.');
  process.exit(1);
}

console.log('Production environment is ready.');
