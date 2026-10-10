# GitHub Actions Crash Course

This guide uses the workout app's actual deployment setup as its example.

**GitHub stores our code. GitHub Actions runs our deployment commands. Vercel hosts
the app. Postgres stores the structured data once the application's data migration
is complete.** Your phone or laptop can start and monitor a run; it does not have
to stay on while the run executes.

## 1. What runs where?

```text
You push code to main, or click Run workflow
                     |
                     v
GitHub Actions starts a temporary Ubuntu computer
  1. Downloads the repository
  2. Installs Node.js and dependencies
  3. Retrieves production settings from Vercel
  4. Builds the app
  5. Applies and verifies database migrations ------> Postgres
  6. Uploads the built app -------------------------> Vercel
                     |
                     v
The runner finishes; Vercel keeps serving the app
```

The temporary computer is called a **runner**. `ubuntu-24.04` in our workflow asks
GitHub to provide one. We do not rent or maintain that machine ourselves.

GitHub Actions is useful for tests, builds, deployments, and other automation.
It is not where this app runs after deployment. Google Cloud Run is a separate
hosting product and is not involved here.

## 2. The vocabulary

| Term | Meaning | Our example |
| --- | --- | --- |
| Workflow | A saved automation recipe | `Deploy production` |
| Workflow file | YAML describing that recipe | `.github/workflows/deploy-production.yml` |
| Event / trigger | What starts the recipe | Push to `main`, or a manual click |
| Run | One execution of the recipe | A deployment attempt for a specific commit |
| Job | A group of steps assigned to a runner | Our `deploy` job |
| Step | One operation within a job | Build, migrate, or deploy |
| Action | A reusable component invoked by a step | `actions/checkout@v5` |
| Secret | A protected value supplied to a workflow | `VERCEL_TOKEN` |

Steps in one job run in order and share the runner's working files. Separate jobs
can run in parallel unless dependencies are specified. Our workflow uses one job
so the order is explicit. See [GitHub's workflow overview](https://docs.github.com/en/actions/concepts/workflows-and-actions/workflows).

## 3. Where the workflow file lives

GitHub looks in the repository's `.github/workflows/` directory for workflow YAML
files. `.yml` and `.yaml` are both valid extensions. The file is committed like
application code, so its changes can be reviewed and tracked.

Our file is [deploy-production.yml](.github/workflows/deploy-production.yml).
Editing it locally does not change GitHub's behavior until it is committed and
pushed. Creating secrets alone also does not run anything.

YAML uses indentation to group settings. Use spaces, not tabs. `#` begins a comment,
and a dash introduces a list item.

## 4. Reading our workflow

### Name and triggers

```yaml
name: Deploy production

on:
  push:
    branches: [main]
  workflow_dispatch:
```

`name` is the label shown in the Actions tab. `on` lists events that start a run.
`push` includes a merge that updates `main`. `workflow_dispatch` enables the manual
**Run workflow** button once the workflow is on the default branch.

### Runner and conditions

```yaml
jobs:
  deploy:
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-24.04
    timeout-minutes: 30
```

`deploy` is our job's internal name. The condition permits deployment only from
`main`, including manual runs. Choosing another branch manually will skip the job.
The timeout limits how long the job can run.

### Reusable actions versus commands

```yaml
- uses: actions/setup-node@v6
  with:
    node-version: '22'
    cache: npm

- name: Install dependencies
  run: npm ci
```

`uses` invokes a reusable action. Here, it prepares Node.js 22 and npm caching.
`@v6` is the version reference of that action, not the Node version.
`with` supplies the action's inputs.

`run` executes a command on the runner. `npm ci` installs the dependency versions
recorded in our npm lockfile. `run: |` introduces a command block spanning multiple
lines. [GitHub workflow syntax reference](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax)

## 5. What the secrets do

| GitHub secret | Purpose | Is it a credential? |
| --- | --- | --- |
| `VERCEL_TOKEN` | Authenticates the runner to Vercel | Yes; treat it like a password |
| `VERCEL_ORG_ID` | Selects the Vercel team/account scope | No; it is an identifier |
| `VERCEL_PROJECT_ID` | Selects the existing workout project | No; it is an identifier |
| `DATABASE_URL` | Connects the migration runner to production Postgres | Yes; includes database credentials |

There is **one token and two IDs**, not three passwords. The IDs tell Vercel which
project we mean; the token proves that the runner has permission to act there.
We store those three Vercel settings as secrets for consistent configuration.
The fourth secret, `DATABASE_URL`, is required because Vercel cannot return values
marked Sensitive to an external runner.

On GitHub: **Repository > Settings > Secrets and variables > Actions > Secrets >
New repository secret**. Names must match the workflow exactly.

```yaml
env:
  VERCEL_TOKEN: ${{ secrets.VERCEL_TOKEN }}
```

`${{ secrets.VERCEL_TOKEN }}` tells GitHub to retrieve the stored secret. `env`
makes it available as an environment variable to the job's processes. A shell
command then reads that variable using `$VERCEL_TOKEN`:

```bash
vercel pull --yes --environment=production --token="$VERCEL_TOKEN"
```

The workflow contains the reference, never the actual token. GitHub masks registered
secrets in logs, but masking is not a substitute for keeping credentials out of
printed output. A workflow with access to a secret can use it, so review changes to
deployment code. [GitHub secret handling](https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-secrets)

If the Vercel token expires or is revoked, deployment authentication stops working.
Create a replacement and update `VERCEL_TOKEN` in GitHub. You do not need to edit
the YAML. The token's scope determines its Vercel access.
[Vercel access tokens](https://vercel.com/kb/guide/how-do-i-use-a-vercel-api-access-token)

### What about GITHUB_TOKEN?

GitHub provides its own temporary `GITHUB_TOKEN` for workflow access to GitHub.
Our `permissions: contents: read` limits that token to reading repository contents.
It does not grant Vercel access and does not replace `VERCEL_TOKEN`. You do not need
to create a GitHub personal access token for this workflow.

## 6. Where DATABASE_URL goes

`DATABASE_URL` is a database connection string containing connection details and
credentials. Keep it in Vercel's **Production** environment for the app, and put the
production connection string in a GitHub Actions secret named `DATABASE_URL` for
the migration runner. Obtain the PostgreSQL connection string from your database
provider's connection settings; do not use a Prisma API URL.

Our workflow uses the Vercel token to pull production settings into:

```text
.vercel/.env.production.local
```

Sensitive values in this file are `[SENSITIVE]` placeholders, not usable credentials.
The token does not bypass that restriction. The
[environment preparation script](scripts/prepare-production-env.mjs) validates the
separate GitHub database secret and masks downloaded credential values without
masking ordinary flags such as `1`. [Vercel sensitive variables](https://vercel.com/docs/environment-variables/sensitive-environment-variables)

For the migration, the workflow injects the GitHub secret as `DATABASE_URL` and runs:

```bash
node scripts/deploy-database.mjs
```

Prisma reads `DATABASE_URL` from that environment and connects to Postgres.
We do not paste the connection string into YAML or add a `NEXT_PUBLIC_` prefix.
The runner's downloaded environment file is ignored by Git, is not uploaded as
an Actions artifact, and has a cleanup step at the end.

If the GitHub secret is missing, a placeholder, or not a PostgreSQL URL, the workflow
stops at the environment check. Having a value configured is not proof that the runner can
connect; the migration step tests the real connection.

## 7. Build, migrate, deploy: three different operations

| Operation | What happens | Effect on production |
| --- | --- | --- |
| Build | Next.js compiles the app on the runner | Does not publish the new app |
| Migrate | Prisma applies pending SQL migration files | Changes the live database schema |
| Verify | Our script checks expected tables and constraints | Blocks deployment if checks fail |
| Deploy | Vercel receives the prebuilt output | Publishes the new app |

`vercel build --prod` uses production build settings. `vercel deploy --prebuilt
--prod` uploads that built output rather than requesting another build.
[Vercel's GitHub Actions integration](https://vercel.com/kb/guide/how-can-i-use-github-actions-with-vercel)

The related files in this repository are:

| File | Role |
| --- | --- |
| `.github/workflows/deploy-production.yml` | Orders the deployment steps |
| `package.json` and `package-lock.json` | Define commands and npm dependencies |
| `prisma/schema.prisma` | Describes the intended data model |
| `prisma/migrations/*/migration.sql` | Versioned SQL changes applied to the database |
| `scripts/deploy-database.mjs` | Runs migrations, then schema verification |
| `scripts/verify-database.mjs` | Checks the expected database structures |
| `vercel.json` | Configures Vercel and disables Git-triggered deployment of `main` |

The `main` setting prevents Vercel's Git integration from independently deploying
the same push before our migration finishes. Other branches retain automatic
Vercel previews. Manual Vercel deployments can bypass the workflow, so production
releases should go through Actions.
[Vercel Git configuration](https://vercel.com/docs/project-configuration/git-configuration)

## 8. Failures and repeated runs

Normally, a failed step skips the subsequent steps. Our cleanup step uses
`if: always()` so it is attempted even after another step fails.

| Failure | What to inspect |
| --- | --- |
| Missing credential | The four GitHub secret names and values |
| Vercel authentication error | Token expiration, scope, team ID, project ID |
| Missing database URL | GitHub's `DATABASE_URL` secret; Vercel's sensitive value cannot be pulled |
| Build failure | The first useful compiler/type error in the build log |
| Migration failure | Connection error or failed SQL migration details |
| Verification failure | Missing table, index, or constraint listed in the log |
| Deploy failure | Vercel deployment output; migration may already have succeeded |

A workflow is not a database transaction. If migration succeeds and deployment
fails, the database changes remain while the previous app stays live. That is why
schema changes need to work with the old app during deployment.

Prisma tracks applied migrations, so a normal rerun skips successful migrations.
A failed migration may require inspection and explicit resolution. Do not reset
the production database to make a workflow green.

Our concurrency group allows only one active production run at a time, and
`cancel-in-progress: false` avoids automatically interrupting it on a newer push.
It should not be treated as a guarantee that every queued commit will deploy.

## 9. The phone-friendly operating guide

Use GitHub in Safari or Chrome; request the desktop site if a control is hidden.

1. Open the workout repository and select **Actions**.
2. Select **Deploy production**.
3. To start manually, select **Run workflow**, choose `main`, and confirm.
4. Open the new run, then its `deploy` job.
5. Expand a step to read its output. Start with the failed step if the run is red.
6. After fixing a transient or settings issue, use the run's rerun control.

A rerun uses the original run's commit. To deploy newly fixed code, push the fix
or start a fresh run on the updated `main` branch.
[Manual workflow runs](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow)

| Task | Phone browser | Desktop |
| --- | --- | --- |
| Add or replace secrets | Yes | Easier for copying values |
| Start a workflow | Yes | Yes |
| Read logs and rerun | Yes | Easier for long logs |
| Edit YAML on GitHub | Possible | Better for review and validation |
| Develop and test app changes locally | Not needed for triggering a run | Best handled here in the repo |

## 10. What a green run proves for this project

A green run means the configured checks, build, schema migration, verification,
and deployment commands succeeded. It does not prove every application feature
works or that historical data was imported.

At the time this guide was written, the app still used its local/Drive structured
data path. The deployment workflow prepares the database schema. Authentication,
authorized APIs, historical data import, and the switch to Postgres persistence
are separate work. See [the cutover runbook](POSTGRES_CUTOVER.md).
