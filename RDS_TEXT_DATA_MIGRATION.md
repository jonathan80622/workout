# Text data in RDS and exercise naming

## Scope

The workout UI now reads and saves profile, workouts, exercise logs, sets,
video metadata, training plans, warmup check-ins, and scheduled sessions through
`/api/app-state` and Prisma. PT comments read and write through `/api/pt-state`.
Weigh-ins read and write through `/api/body-weights`. Video files remain in Drive.
Connecting Drive no longer loads or saves workout JSON. Browser workout storage
is a cache; a failed database load displays an error and does not load cached
workouts or enable database writes. Default workout state is empty.

This retains the existing single-owner import identity, selected by
`WORKOUT_OWNER_AUTH_SUBJECT` (default `legacy-import:workout-data`). It is not a
Google account. This change does not introduce multi-user authentication; the
workout and weight APIs follow the existing personal-app access model. PT access
continues to use the configured PT password.

## Schema change

`ExerciseLog.exerciseName` maps to `exercise_logs.exercise_name`. Migration
`20261011120000_exercise_names_remove_presets` uses `RENAME COLUMN`, preserving
names and exercise rows. The original migration remains unchanged.

`MachinePreset`, its user relation, the `machine_presets` table, equipment enum,
fixtures, and library/compass navigation are removed. Add Exercise continues to
discover names from workout history. This does not create a canonical Exercise
table or merge exercise occurrences that happen to have the same name.

Legacy JSON accepts `machineName` at the import boundary and emits `exerciseName`.
The importer ignores the old `machines` collection. Existing JSON snapshots are
left unchanged as historical source data.

## Save behavior

Workouts and exercise logs are upserted by owner/workout and legacy ID so their
database identities and associated feedback survive ordinary edits. Explicitly
deleted workouts/exercises are removed. Saves run inside one transaction.
An owner revision prevents stale full-state saves from overwriting newer edits,
including PT comments. Browser saves are serialized. Conflicts stop further
saves and display an error requiring a reload; the browser cache retains the
edited workout state. PT comments save on leaving the comment field. Weight
changes update the UI only after the database accepts them.

## Rollout

Code and SQL are prepared locally; production SQL has not been run by this task.
Before deploying, take an RDS snapshot or a PostgreSQL backup and verify the
production target. Dropping `machine_presets` removes its seat defaults and cues.
The column rename also requires the new application version; the deployment
workflow migrates before deploying, so the old application must not use the new
Prisma schema during the transition. Restore the backup if a destructive rollback
is required. Do not rerun the snapshot importer against live edited data: it
replaces that owner's imported collections.

The existing one-time workout import remains sufficient for workout text. Old
browser-only weigh-ins and PT portal comments are not part of that JSON import;
their browser keys are retained and require an explicit import before discarding
that browser's data. No fabricated weight samples are added to RDS.

## Verification

`node --test scripts/app-state.test.cjs scripts/prepare-production-env.test.mjs`
tests legacy naming, lossless field conversion, Prisma write names, stable
workout/exercise IDs, revision conflicts, invalid state rejection, and empty
database startup. These use a database double, not a live RDS write.

`node scripts/import-workout-json.mjs` dry-run validates the existing snapshot:
9 workouts, 37 exercises, 112 sets, and 22 video records; presets are ignored.
`npm run build` checks the full Next.js application and generated Prisma types.

## Test fixture provenance

The browser fixture is `e2e/jev-use/seed.json`, introduced by commit `0c531bc`
on 2026-10-10 at 11:39:46 -0400. Its companion README describes an artificial
trainer-feedback scenario with Alex and Coach Sarah. Two Leg Press sessions
establish history; the latest records 200 lb and seat notch 4, while the trainer
instructs 180 lb and notch 5 next time. Seated Leg Curl provides a competing
exercise. The older workout also has different feedback, so the scenario can
distinguish the latest instruction from historical values. These are test
choices, not values inferred from the user's real workout records.

Commit `8e7e065` later removed `muscleFeeling`, preserving its nonempty text in
`notes`. This migration changes only the three `machineName` keys in that seed
to `exerciseName`; its names, dates, loads, and comments are unchanged. The browser
check copies it into ignored `e2e/jev-use/.run/schema-migration/seed.json` and uses
the dev-only E2E state bridge. Test interactions write that directory's
`state.json`, not Postgres or the normal workout browser cache.

New unit tests clone this fixture and introduce specific conditions: a legacy
field name, competing old/new names, an invalid missing name, and a stale owner
revision. `VU VU` is an explicit test marker taken from the user's earlier
message, not a note retrieved from RDS. The body-weight test's 80 kg value and
the fake database IDs/revisions are also synthetic. Database doubles record
Prisma calls and simulate results; they do not execute SQL or prove live RDS
round trips, transaction isolation, migration execution, or deployment success.

Browser verification loaded the isolated seed, started a workout, opened Add
Exercise, selected Leg Press from history, and confirmed the previous feedback
and load-history display. Local Docker was unavailable, so the SQL migration
has not been exercised against an isolated PostgreSQL instance in this task.

## Correction after the fixture review

The synthetic Leg Press smoke test was insufficient to validate the user's
Mandarin exercise data. Review found a real residual contamination path:
`createDefaultAppState()` still used English sample workouts, and the profile's
Restore Sample Sessions action could send those samples through the new database
save path. This path predated the migration, but leaving it connected was an
implementation error. It was not evidence that the machine-preset table supplied
the picker. The sample workout file/import and restore action are now removed.
Database load failures no longer substitute browser history. Startup is empty
until the database responds.

The picker now uses the directly tested `getHistoricalExercises` function, which
accepts workout logs only. Remaining preset/machine variable names and the picker
compass icon were removed to make that distinction explicit.

Regression tests now load `data/imports/workout-data.json` itself: 9 workouts,
37 exercise occurrences, and 12 distinct logged names. They require exact equality
between logged names and picker options, exclude all 16 English preset names,
and check all 37 Prisma exercise-name write arguments. Empty state produces no
exercise options. These tests still use database doubles for Prisma.

A subsequent browser check used a copy of the actual JSON in the ignored test
directory, opened Add Exercise, observed the 12 real names, and clicked
`海默二頭彎舉`. The resulting local state file was checked for that new occurrence,
absence of Leg Press, absence of the `machines` collection, and absence of
`machineName` fields. The original JSON and production database were not modified.
All 17 Node tests and the production build passed after this correction.

## Final machine-preset audit

The current schema has no MachinePreset model, user relation, equipment enum, or
replacement catalog entity. Exercise selection derives from ExerciseLog history;
seat settings belong to the logged exercise. Obsolete analytics source values and
UI labels were removed too. TrainingPlanExercise remains a planned prescription,
not a machine catalog or a replacement identity for ExerciseLog.

Historical references intentionally remain in applied migrations, the migration
that drops the old table, the unmodified source JSON, regression tests that reject
presets, and the importer report listing the ignored collection. The legacy
`machineName` reader exists only to convert old exercise-log JSON into
`exerciseName`. None of these creates or reads a current preset catalog.
The production table's removal still requires applying the pending migration;
source-code removal alone does not prove the live database has changed.
