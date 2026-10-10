import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';

const EQUIPMENT_TYPES = {
  Machine: 'MACHINE',
  Cable: 'CABLE',
  'Free Weight': 'FREE_WEIGHT',
  'Smith Machine': 'SMITH_MACHINE',
  'Cardio / Treadmill': 'CARDIO_TREADMILL',
};

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const fileArgIndex = args.indexOf('--file');
const ownerArgIndex = args.indexOf('--owner');
const filePath = resolve(fileArgIndex === -1 ? 'data/imports/workout-data.json' : args[fileArgIndex + 1] || '');
const authSubject = ownerArgIndex === -1 ? 'legacy-import:workout-data' : args[ownerArgIndex + 1] || '';

if (!authSubject.trim()) fail('Missing value after --owner.');
if (!process.env.DATABASE_URL && apply) fail('DATABASE_URL is required when using --apply.');

let contents;
let source;
try {
  contents = readFileSync(filePath, 'utf8');
  source = JSON.parse(contents);
} catch (error) {
  fail(`Could not read JSON file: ${error.message}`);
}

const normalized = validateAndNormalize(source);
const checksum = createHash('sha256').update(contents).digest('hex');
const report = summarize(normalized, checksum);

console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', filePath, ownerAuthSubject: authSubject, report }, null, 2));

if (!apply) {
  console.log('\nDry run complete. No database connection or writes were made. Run again with --apply to import this snapshot.');
  process.exit(0);
}

const prisma = new PrismaClient();
try {
  const outcome = await prisma.$transaction(async (db) => {
    const user = await db.user.upsert({
      where: { authSubject },
      create: { authSubject, role: 'CLIENT', displayName: normalized.profile.clientName || null },
      update: { displayName: normalized.profile.clientName || null },
    });

    // This owner is reserved for this snapshot; replacing its roots makes retries idempotent.
    await db.workout.deleteMany({ where: { ownerId: user.id } });
    await db.machinePreset.deleteMany({ where: { ownerId: user.id } });
    await db.trainingPlan.deleteMany({ where: { ownerId: user.id } });
    await db.warmupCheckin.deleteMany({ where: { ownerId: user.id } });
    await db.scheduledSession.deleteMany({ where: { ownerId: user.id } });

    await db.profile.upsert({
      where: { userId: user.id },
      create: profileData(user.id, normalized.profile),
      update: profileData(user.id, normalized.profile),
    });

    await db.machinePreset.createMany({
      data: normalized.machines.map((machine, position) => ({
        ownerId: user.id,
        legacyId: machine.id,
        position,
        name: machine.name,
        category: machine.category,
        equipmentType: EQUIPMENT_TYPES[machine.equipmentType],
        defaultSeatSettings: optionalText(machine.defaultSeatSettings),
        targetDescription: machine.targetDescription,
      })),
    });

    for (const workout of normalized.workouts) {
      await db.workout.create({
        data: {
          ownerId: user.id,
          legacyId: workout.id,
          title: workout.title,
          date: new Date(workout.date),
          startTimeRaw: optionalText(workout.startTime),
          endTimeRaw: optionalText(workout.endTime),
          durationMinutes: workout.durationMinutes,
          isCompleted: workout.isCompleted,
          ptNotes: optionalText(workout.ptNotes),
          ptComment: optionalText(workout.ptComment),
          runningDistance: numberOrNull(workout.runningDistance),
          runningTimeMinutes: numberOrNull(workout.runningTimeMinutes),
          exercises: {
            create: workout.exercises.map((exercise, position) => ({
              legacyId: exercise.id,
              position,
              machineName: exercise.machineName,
              category: exercise.category,
              seatSettings: optionalText(exercise.seatSettings),
              notes: optionalText(exercise.notes),
              distance: numberOrNull(exercise.distance),
              runningTimeMinutes: numberOrNull(exercise.runningTimeMinutes),
              ptComment: optionalText(exercise.ptComment),
              sets: {
                create: exercise.sets.map((set, setPosition) => ({
                  legacyId: set.id,
                  position: setPosition,
                  setNumber: set.setNumber,
                  type: set.type,
                  weight: set.weight,
                  weightUnit: set.weightUnit,
                  reps: set.reps,
                  completed: set.completed,
                  rpe: numberOrNull(set.rpe),
                  distance: numberOrNull(set.distance),
                  runningTimeMinutes: numberOrNull(set.runningTimeMinutes),
                })),
              },
              videos: {
                create: exercise.videos.map((video) => ({
                  legacyId: video.id,
                  driveFileId: video.driveFileId,
                  createdAt: new Date(video.createdAt),
                  durationSeconds: video.durationSeconds,
                  mimeType: video.mimeType,
                  name: optionalText(video.name),
                  webViewLink: optionalText(video.webViewLink),
                })),
              },
            })),
          },
        },
      });
    }

    await db.trainingPlan.create({
      data: {
        ownerId: user.id,
        title: normalized.trainingPlan.title,
        version: normalized.trainingPlan.version,
        isCurrent: true,
        blocks: {
          create: normalized.trainingPlan.blocks.map((block, position) => ({
            legacyId: block.id,
            position,
            title: block.title,
            subtitle: optionalText(block.subtitle),
            accent: optionalText(block.accent),
            exercises: {
              create: block.exercises.map((exercise, exercisePosition) => ({
                legacyId: exercise.id,
                position: exercisePosition,
                name: exercise.name,
                setsText: exercise.sets,
                repsText: exercise.reps,
                restText: exercise.rest,
              })),
            },
          })),
        },
        warmupMoves: {
          create: normalized.trainingPlan.warmupMoves.map((move, position) => ({
            legacyId: move.id,
            position,
            name: move.name,
            targetText: move.target,
          })),
        },
      },
    });

    const checkins = Object.entries(normalized.warmupCheckins).flatMap(([date, moves]) =>
      Object.entries(moves).map(([moveIdOrLegacyKey, completed]) => ({
        ownerId: user.id,
        checkinDate: new Date(`${date}T00:00:00.000Z`),
        moveIdOrLegacyKey,
        completed,
      }))
    );
    if (checkins.length) await db.warmupCheckin.createMany({ data: checkins });

    if (normalized.scheduledSession) {
      await db.scheduledSession.create({
        data: {
          ownerId: user.id,
          legacyId: normalized.scheduledSession.id || null,
          title: normalized.scheduledSession.title,
          scheduledDate: new Date(normalized.scheduledSession.scheduledDate),
          notes: optionalText(normalized.scheduledSession.notes),
          status: 'scheduled',
        },
      });
    }

    await db.importBatch.upsert({
      where: { ownerId_sourceType_checksum: { ownerId: user.id, sourceType: 'drive_json', checksum } },
      create: { ownerId: user.id, sourceType: 'drive_json', checksum, status: 'completed', completedAt: new Date(), reportJson: report },
      update: { status: 'completed', completedAt: new Date(), reportJson: report },
    });

    return user.id;
  }, { timeout: 30_000 });

  const verification = await countImportedRecords(prisma, outcome);
  if (!sameCounts(report, verification)) {
    fail(`Import verification failed: expected ${JSON.stringify(report.counts)}, got ${JSON.stringify(verification)}.`);
  }
  console.log(`\nImport complete and verified for ${authSubject}: ${JSON.stringify(verification)}.`);
} finally {
  await prisma.$disconnect();
}

function profileData(userId, profile) {
  return {
    userId,
    clientName: profile.clientName || '',
    ptNameLabel: optionalText(profile.ptName),
    appTitle: optionalText(profile.appTitle),
    themeColor: optionalText(profile.themeColor),
  };
}

async function countImportedRecords(prisma, ownerId) {
  const [machines, workouts, exercises, sets, videos, planBlocks, planExercises, warmupMoves, warmupCheckins, sessions] = await Promise.all([
    prisma.machinePreset.count({ where: { ownerId } }),
    prisma.workout.count({ where: { ownerId } }),
    prisma.exerciseLog.count({ where: { workout: { ownerId } } }),
    prisma.workoutSet.count({ where: { exercise: { workout: { ownerId } } } }),
    prisma.video.count({ where: { exercise: { workout: { ownerId } } } }),
    prisma.trainingPlanBlock.count({ where: { plan: { ownerId } } }),
    prisma.trainingPlanExercise.count({ where: { block: { plan: { ownerId } } } }),
    prisma.warmupMove.count({ where: { plan: { ownerId } } }),
    prisma.warmupCheckin.count({ where: { ownerId } }),
    prisma.scheduledSession.count({ where: { ownerId } }),
  ]);
  return { machines, workouts, exercises, sets, videos, planBlocks, planExercises, warmupMoves, warmupCheckins, sessions };
}

function sameCounts(report, actual) {
  return Object.entries(report.counts).every(([key, expected]) => actual[key] === expected);
}

function summarize(data, checksum) {
  const exercises = data.workouts.flatMap((workout) => workout.exercises);
  const blocks = data.trainingPlan.blocks;
  return {
    checksum,
    counts: {
      machines: data.machines.length,
      workouts: data.workouts.length,
      exercises: exercises.length,
      sets: exercises.reduce((total, exercise) => total + exercise.sets.length, 0),
      videos: exercises.reduce((total, exercise) => total + exercise.videos.length, 0),
      planBlocks: blocks.length,
      planExercises: blocks.reduce((total, block) => total + block.exercises.length, 0),
      warmupMoves: data.trainingPlan.warmupMoves.length,
      warmupCheckins: Object.values(data.warmupCheckins).reduce((total, moves) => total + Object.keys(moves).length, 0),
      sessions: data.scheduledSession ? 1 : 0,
    },
    ignored: ['muscleFeeling'],
  };
}

function validateAndNormalize(value) {
  assertObject(value, 'root');
  const profile = object(value.profile, 'profile');
  const machines = array(value.machines, 'machines').map((machine, index) => validateMachine(object(machine, `machines[${index}]`)));
  const workouts = array(value.workouts, 'workouts').map((workout, index) => validateWorkout(object(workout, `workouts[${index}]`)));
  const trainingPlan = validatePlan(object(value.trainingPlan, 'trainingPlan'));
  const warmupCheckins = validateCheckins(value.warmupCheckins);
  const scheduledSession = value.scheduledSession == null ? null : validateSession(object(value.scheduledSession, 'scheduledSession'));
  return {
    profile: {
      clientName: string(profile.clientName, 'profile.clientName', true),
      ptName: string(profile.ptName, 'profile.ptName', true),
      appTitle: string(profile.appTitle, 'profile.appTitle', true),
      themeColor: string(profile.themeColor, 'profile.themeColor', true),
    },
    machines,
    workouts,
    trainingPlan,
    warmupCheckins,
    scheduledSession,
  };
}

function validateMachine(value) {
  const equipmentType = string(value.equipmentType, 'machine.equipmentType');
  if (!EQUIPMENT_TYPES[equipmentType]) fail(`Unsupported equipment type: ${equipmentType}.`);
  return { id: string(value.id, 'machine.id'), name: string(value.name, 'machine.name'), category: string(value.category, 'machine.category'), equipmentType, defaultSeatSettings: string(value.defaultSeatSettings, 'machine.defaultSeatSettings', true), targetDescription: string(value.targetDescription, 'machine.targetDescription') };
}

function validateWorkout(value) {
  return {
    id: string(value.id, 'workout.id'), title: string(value.title, 'workout.title'), date: isoDate(value.date, 'workout.date'),
    startTime: string(value.startTime, 'workout.startTime', true), endTime: string(value.endTime, 'workout.endTime', true),
    durationMinutes: nonNegativeInteger(value.durationMinutes, 'workout.durationMinutes'), isCompleted: boolean(value.isCompleted, 'workout.isCompleted'),
    ptNotes: string(value.ptNotes, 'workout.ptNotes', true), ptComment: string(value.ptComment, 'workout.ptComment', true),
    runningDistance: optionalNumber(value.runningDistance, 'workout.runningDistance'), runningTimeMinutes: optionalNumber(value.runningTimeMinutes, 'workout.runningTimeMinutes'),
    exercises: array(value.exercises, 'workout.exercises').map((exercise, index) => validateExercise(object(exercise, `exercise[${index}]`))),
  };
}

function validateExercise(value) {
  return {
    id: string(value.id, 'exercise.id'), machineName: string(value.machineName, 'exercise.machineName'), category: string(value.category, 'exercise.category'),
    seatSettings: string(value.seatSettings, 'exercise.seatSettings', true), notes: string(value.notes, 'exercise.notes', true), ptComment: string(value.ptComment, 'exercise.ptComment', true),
    distance: optionalNumber(value.distance, 'exercise.distance'), runningTimeMinutes: optionalNumber(value.runningTimeMinutes, 'exercise.runningTimeMinutes'),
    sets: array(value.sets, 'exercise.sets').map((set, index) => validateSet(object(set, `set[${index}]`))),
    videos: value.videos == null ? [] : array(value.videos, 'exercise.videos').map((video, index) => validateVideo(object(video, `video[${index}]`))),
  };
}

function validateSet(value) {
  const type = string(value.type, 'set.type');
  if (!['warmup', 'working', 'drop', 'failure'].includes(type)) fail(`Unsupported set type: ${type}.`);
  const weightUnit = string(value.weightUnit, 'set.weightUnit');
  if (!['lbs', 'kg'].includes(weightUnit)) fail(`Unsupported weight unit: ${weightUnit}.`);
  return { id: string(value.id, 'set.id'), setNumber: nonNegativeInteger(value.setNumber, 'set.setNumber'), type, weight: finiteNumber(value.weight, 'set.weight'), weightUnit, reps: nonNegativeInteger(value.reps, 'set.reps'), completed: boolean(value.completed, 'set.completed'), rpe: optionalNumber(value.rpe, 'set.rpe'), distance: optionalNumber(value.distance, 'set.distance'), runningTimeMinutes: optionalNumber(value.runningTimeMinutes, 'set.runningTimeMinutes') };
}

function validateVideo(value) {
  return { id: string(value.id, 'video.id'), driveFileId: string(value.driveFileId, 'video.driveFileId'), createdAt: isoDate(value.createdAt, 'video.createdAt'), durationSeconds: nonNegativeNumber(value.durationSeconds, 'video.durationSeconds'), mimeType: string(value.mimeType, 'video.mimeType'), name: string(value.name, 'video.name', true), webViewLink: string(value.webViewLink, 'video.webViewLink', true) };
}

function validatePlan(value) {
  return {
    version: nonNegativeInteger(value.version, 'trainingPlan.version'), title: string(value.title, 'trainingPlan.title'),
    blocks: array(value.blocks, 'trainingPlan.blocks').map((block, index) => {
      const item = object(block, `plan.blocks[${index}]`);
      return { id: string(item.id, 'plan.block.id'), title: string(item.title, 'plan.block.title'), subtitle: string(item.subtitle, 'plan.block.subtitle', true), accent: string(item.accent, 'plan.block.accent', true), exercises: array(item.exercises, 'plan.block.exercises').map((exercise) => { const entry = object(exercise, 'plan.exercise'); return { id: string(entry.id, 'plan.exercise.id'), name: string(entry.name, 'plan.exercise.name'), sets: string(entry.sets, 'plan.exercise.sets'), reps: string(entry.reps, 'plan.exercise.reps'), rest: string(entry.rest, 'plan.exercise.rest') }; }) };
    }),
    warmupMoves: array(value.warmupMoves, 'trainingPlan.warmupMoves').map((move) => { const entry = object(move, 'warmupMove'); return { id: string(entry.id, 'warmupMove.id'), name: string(entry.name, 'warmupMove.name'), target: string(entry.target, 'warmupMove.target') }; }),
  };
}

function validateCheckins(value) {
  if (value == null) return {};
  assertObject(value, 'warmupCheckins');
  return Object.fromEntries(Object.entries(value).map(([date, moves]) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) fail(`Invalid warmup check-in date: ${date}.`);
    assertObject(moves, `warmupCheckins.${date}`);
    return [date, Object.fromEntries(Object.entries(moves).map(([moveId, complete]) => [moveId, boolean(complete, `warmupCheckins.${date}.${moveId}`)]))];
  }));
}

function validateSession(value) {
  return { id: string(value.id, 'scheduledSession.id', true), title: string(value.title, 'scheduledSession.title'), scheduledDate: isoDate(value.scheduledDate, 'scheduledSession.scheduledDate'), notes: string(value.notes, 'scheduledSession.notes', true) };
}

function object(value, label) { assertObject(value, label); return value; }
function array(value, label) { if (!Array.isArray(value)) fail(`${label} must be an array.`); return value; }
function assertObject(value, label) { if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`${label} must be an object.`); }
function string(value, label, optional = false) { if (value == null && optional) return ''; if (typeof value !== 'string') fail(`${label} must be a string.`); return value; }
function boolean(value, label) { if (typeof value !== 'boolean') fail(`${label} must be true or false.`); return value; }
function nonNegativeInteger(value, label) { if (!Number.isInteger(value) || value < 0) fail(`${label} must be a non-negative integer.`); return value; }
function finiteNumber(value, label) { if (!Number.isFinite(value)) fail(`${label} must be a finite number.`); return value; }
function nonNegativeNumber(value, label) { if (!Number.isFinite(value) || value < 0) fail(`${label} must be a non-negative number.`); return value; }
function optionalNumber(value, label) { if (value == null) return null; return nonNegativeNumber(value, label); }
function isoDate(value, label) { if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) fail(`${label} must be a valid date.`); return value; }
function optionalText(value) { return typeof value === 'string' && value.trim() ? value : null; }
function numberOrNull(value) { return value == null ? null : value; }
function fail(message) { console.error(message); process.exit(1); }
