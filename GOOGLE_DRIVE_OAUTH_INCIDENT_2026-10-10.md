# Google Drive OAuth Incident - 2026-10-10

## Summary

Clicking **Connect Drive** opened Google sign-in, then failed with:

```text
Access blocked: Authorisation error
The OAuth client was not found.
Error 401: invalid_client
```

The deployed browser build was using an invalid Google OAuth client ID. The bad value came from the production deployment workflow after `vercel pull` produced a sensitive placeholder for a public Next.js environment variable.

## Exact Cause

The app reads the Google OAuth client ID from:

```text
NEXT_PUBLIC_GOOGLE_CLIENT_ID
```

`src/utils/driveStorage.ts` passes that value directly to Google Identity Services as `client_id` when `connectGoogleDrive()` runs.

Today's deployment path introduced `vercel pull --environment=production` before `vercel build`. For sensitive Vercel values, the pulled `.vercel/.env.production.local` can contain:

```text
NEXT_PUBLIC_GOOGLE_CLIENT_ID="[SENSITIVE]"
```

Before the fix, the deploy validation did not reject this value. That meant the Next.js production build could bake `[SENSITIVE]` into the browser bundle as `process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID`.

When the user clicked **Connect Drive**, the browser sent:

```text
client_id=[SENSITIVE]
```

Google correctly rejected that as an unknown OAuth client, producing `Error 401: invalid_client`.

## Reproduction Evidence

The regression is covered by `scripts/prepare-production-env.test.mjs`.

An earlier reproduction test constructed the pulled Vercel environment:

```text
DATABASE_URL="[SENSITIVE]"
NEXT_PUBLIC_GOOGLE_CLIENT_ID="[SENSITIVE]"
```

It then proves that the pre-fix build environment exposes:

```text
NEXT_PUBLIC_GOOGLE_CLIENT_ID === "[SENSITIVE]"
```

and that this is not a valid Google OAuth web client ID.

The current regression coverage now asserts that the production workflow does not use `vercel pull`, `vercel build`, or `vercel deploy --prebuilt`. That prevents GitHub Actions from rebuilding the browser bundle from placeholder values.

## History and Assumptions

The first production workflow was added in commit `8e7e065` (**Add Prisma database configuration**). It did all production work inside GitHub Actions:

```text
vercel pull --environment=production
node scripts/prepare-production-env.mjs
vercel build --prod
node --env-file=.vercel/.env.production.local scripts/deploy-database.mjs
vercel deploy --prebuilt --prod
```

Based on that workflow and the original `prepare-production-env.mjs`, the likely assumptions were:

1. `vercel pull` would give GitHub Actions a complete production environment suitable for both the frontend build and the database migration.
2. `DATABASE_URL` would be readable from `.vercel/.env.production.local`.
3. Public `NEXT_PUBLIC_*` values needed by the browser build would also be readable from that same pulled env file.
4. Building in GitHub and deploying a prebuilt artifact would behave like a normal Vercel production build, just with the migration inserted before deployment.

Those assumptions became unsafe after commit `07ea66f` (**Use GitHub secret for production database migrations**). That commit recognized that Vercel sensitive values could be pulled as `[SENSITIVE]`, so it moved `DATABASE_URL` to a GitHub Actions secret for the migration step.

What did not change at the same time was the frontend build strategy. The workflow still ran `vercel pull`, then `vercel build --prod` inside GitHub Actions, then `vercel deploy --prebuilt --prod`. That left the browser build dependent on pulled Vercel environment values.

The production Google OAuth client ID had been configured in Vercel since Aug 16 and appeared in the Vercel UI with a lock icon. That was fine for builds that run inside Vercel. It was not fine for a GitHub-hosted prebuilt flow, because GitHub could receive only a placeholder:

```text
NEXT_PUBLIC_GOOGLE_CLIENT_ID="[SENSITIVE]"
```

So the real change was not that the OAuth client ID disappeared. The deploy architecture changed ownership of the frontend build from Vercel to GitHub Actions, but the environment variable still lived in Vercel in a form that external CI could not read.

## Fix

The workflow now avoids pulling Vercel project env into GitHub Actions for the frontend build.

GitHub Actions still validates and uses `DATABASE_URL` to run the production database migration. After that, it runs:

```bash
vercel deploy --prod --yes --token="$VERCEL_TOKEN"
```

That deploys from source and lets Vercel run the production build with the project environment variables already configured in Vercel.

`src/utils/driveStorage.ts` also rejects missing, placeholder, or malformed Google OAuth client IDs before attempting to call Google Identity Services.

## Verification

Commands run after the fix:

```bash
node --test scripts/prepare-production-env.test.mjs
npm run build
```

Both passed.

## Operational Requirement

Vercel must contain the production environment variable:

```text
NEXT_PUBLIC_GOOGLE_CLIENT_ID
```

Its value must be the production Google OAuth **Web client ID**, ending in `.apps.googleusercontent.com`.

GitHub Actions does not need this value. The app's production build should happen inside Vercel so Vercel can use the project environment variable directly, even if the dashboard displays it with a lock icon.
