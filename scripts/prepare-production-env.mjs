import { readFileSync, writeFileSync } from 'node:fs';
import { parseEnv } from 'node:util';

const envFile = '.vercel/.env.production.local';
let environment;
let environmentContents;
try {
  environmentContents = readFileSync(envFile, 'utf8');
  environment = parseEnv(environmentContents);
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

const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim() ||
  environment.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim();

if (!isGoogleOAuthClientId(googleClientId)) {
  console.error('NEXT_PUBLIC_GOOGLE_CLIENT_ID is missing, sensitive, or not a Google OAuth web client ID. Add a GitHub Actions secret with the production client ID so the browser build can authorize Drive.');
  process.exit(1);
}

if (process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim() &&
    environment.NEXT_PUBLIC_GOOGLE_CLIENT_ID !== googleClientId) {
  environmentContents = upsertEnvValue(
    environmentContents,
    'NEXT_PUBLIC_GOOGLE_CLIENT_ID',
    googleClientId,
  );
  writeFileSync(envFile, environmentContents);
}

console.log('Production environment is ready.');

function isGoogleOAuthClientId(value) {
  return Boolean(value && value !== '[SENSITIVE]' && /^[0-9a-z-]+\.apps\.googleusercontent\.com$/i.test(value));
}

function upsertEnvValue(contents, key, value) {
  const line = `${key}=${quoteEnvValue(value)}`;
  const pattern = new RegExp(`^${key}=.*$`, 'm');
  if (pattern.test(contents)) {
    return contents.replace(pattern, line);
  }

  const separator = contents.endsWith('\n') || contents.length === 0 ? '' : '\n';
  return `${contents}${separator}${line}\n`;
}

function quoteEnvValue(value) {
  return `"${value.replaceAll('\\', '\\\\').replaceAll('"', '\\"').replaceAll('\n', '\\n')}"`;
}
