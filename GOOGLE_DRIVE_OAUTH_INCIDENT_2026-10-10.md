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

The test named **"reproduces the broken deploy env that sent a placeholder as the Google OAuth client id"** constructs the pulled Vercel environment:

```text
DATABASE_URL="[SENSITIVE]"
NEXT_PUBLIC_GOOGLE_CLIENT_ID="[SENSITIVE]"
```

It then proves that the pre-fix build environment exposes:

```text
NEXT_PUBLIC_GOOGLE_CLIENT_ID === "[SENSITIVE]"
```

and that this is not a valid Google OAuth web client ID.

## Fix

The fix has three parts:

1. `.github/workflows/deploy-production.yml` now passes `NEXT_PUBLIC_GOOGLE_CLIENT_ID` from GitHub Actions secrets into the validation and build steps.
2. `scripts/prepare-production-env.mjs` validates that the effective Google client ID matches the expected OAuth web client format:

```text
*.apps.googleusercontent.com
```

3. If Vercel pulled `[SENSITIVE]`, `scripts/prepare-production-env.mjs` rewrites `.vercel/.env.production.local` with the GitHub Actions secret before `vercel build`.

`src/utils/driveStorage.ts` also rejects missing, placeholder, or malformed Google OAuth client IDs before attempting to call Google Identity Services.

## Verification

Commands run after the fix:

```bash
node --test scripts/prepare-production-env.test.mjs
npm run build
```

Both passed.

## Operational Requirement

GitHub Actions must contain a secret named:

```text
NEXT_PUBLIC_GOOGLE_CLIENT_ID
```

Its value must be the production Google OAuth **Web client ID**, ending in:

```text
.apps.googleusercontent.com
```

Do not rely on Vercel sensitive placeholders for `NEXT_PUBLIC_*` values during external CI builds. Public Next.js variables are intentionally bundled into browser JavaScript, so CI must provide their real build-time values.

