# PostgreSQL Cutover Runbook

This repo keeps schema migration separate from the Vercel app build. Do not run `prisma migrate dev` against production, and do not run migrations from a Route Handler.

## GitHub Actions production deployment

The `Deploy production` workflow runs on pushes to `main`. It can also be started
in a mobile or desktop browser: GitHub > repository > Actions > Deploy production >
Run workflow > main. The workflow must be on the default branch first.

Add these repository secrets under Settings > Secrets and variables > Actions:

- `VERCEL_TOKEN`: a Vercel token scoped to the project's team.
- `VERCEL_ORG_ID`: that team's ID.
- `VERCEL_PROJECT_ID`: the workout project's ID.
- `DATABASE_URL`: the production PostgreSQL connection string, starting with
  `postgresql://` or `postgres://`. Obtain it from the database provider's connection
  settings. Keep the Vercel production value too; do not disable its sensitive setting.

Vercel sensitive values are returned as `[SENSITIVE]` by `vercel pull`; the token
cannot retrieve them. Actions uses the separate GitHub `DATABASE_URL` secret for
migrations. It pulls build settings, masks downloaded credentials, validates the
GitHub database URL, builds the app,
runs the migration and schema verification, then deploys the prebuilt output.
Downloaded environment files are ignored by Git and not uploaded as artifacts.

Production runs are serialized without cancelling an active run. `vercel.json`
disables automatic Git deployments for `main`; other branches keep Vercel previews.
The Vercel production branch must remain `main`. Manual Vercel dashboard deployments
bypass this gate, so use Actions for production releases.

The first push containing the workflow attempts a production migration and deployment.
Configure the four secrets before pushing. No production migration has been verified
from this local checkout yet.

If a step fails, later steps do not run. Inspect the failed step in Actions, fix the
issue, and rerun. Prisma skips already applied migrations. A failed migration may
need inspection and explicit resolution before retrying. If migration succeeds but
deployment fails, the old app remains live with the new schema. Keep migrations
compatible with the currently deployed app; do not automatically reset the database.

## Optional local schema deployment

The current app code still uses the existing local/Drive structured-data path. The committed Prisma migration can therefore be applied before UI cutover without changing production behavior.

1. Use the Actions workflow above for normal production releases.
2. Run the production migration once from an environment that has Vercel's production `DATABASE_URL`:

   ```bash
   npm ci
   npm run db:deploy:verify
   ```

   `db:deploy:verify` runs `prisma migrate deploy` and then verifies the expected tables, custom constraints, and partial index.

3. For local use, supply the database connection string securely as `DATABASE_URL`.
   Pulling Vercel settings cannot retrieve a sensitive database URL. Never use the
   literal `[SENSITIVE]` placeholder as a connection string.

4. If running from CI, inject `DATABASE_URL` as a protected secret and run the same command as a manual job.

## What this does not do

- It does not import historical Drive JSON, browser localStorage, body weights, or PT comments.
- It does not switch structured reads/writes to Postgres.
- It does not change Google Drive video upload/playback.

Those come after the schema exists and after the importer can produce a reconciliation report.
