const databaseUrl = process.env.DATABASE_URL?.trim();

if (!databaseUrl || databaseUrl === '[SENSITIVE]') {
  console.error('Add a GitHub Actions secret named DATABASE_URL containing the production PostgreSQL connection string.');
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

console.log('Production migration environment is ready.');
