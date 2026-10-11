import { Prisma, User } from '@prisma/client';
import { prisma } from '@/src/server/db';
import { createDefaultAppState, normalizeAppState } from '@/src/utils/driveStorage';
import { TrainingPlan, Workout, WorkoutAppState } from '@/src/types';

// The imported client's data row. Only the PT portal still addresses it directly; the app
// itself reaches it through the signed-in account's owner link.
export const OWNER_AUTH_SUBJECT = 'legacy-import:workout-data';

export class StateConflictError extends Error {}

export async function readWorkoutAppState(
  owner: Prisma.UserWhereUniqueInput = { authSubject: OWNER_AUTH_SUBJECT }
): Promise<WorkoutAppState> {
  const user = await prisma.user.findUnique({
    where: owner,
    include: {
      profile: true,
      workouts: {
        orderBy: { date: 'desc' },
        include: {
          exercises: {
            orderBy: { position: 'asc' },
            include: {
              sets: { orderBy: { position: 'asc' } },
              videos: { orderBy: { createdAt: 'asc' } },
            },
          },
        },
      },
      trainingPlans: {
        where: { isCurrent: true },
        take: 1,
        include: {
          blocks: {
            orderBy: { position: 'asc' },
            include: { exercises: { orderBy: { position: 'asc' } } },
          },
          warmupMoves: { orderBy: { position: 'asc' } },
        },
      },
      warmupCheckins: true,
      scheduledSessions: {
        where: { status: 'scheduled' },
        orderBy: { scheduledDate: 'asc' },
        take: 1,
      },
    },
  });

  if (!user) return { ...createDefaultAppState(), workouts: [], revision: 0 };

  const defaults = createDefaultAppState();
  return { ...normalizeAppState({
    version: 1,
    profile: {
      clientName: user.profile?.clientName || '',
      ptName: user.profile?.ptNameLabel || '',
      appTitle: user.profile?.appTitle || defaults.profile.appTitle,
      themeColor: (user.profile?.themeColor || defaults.profile.themeColor) as WorkoutAppState['profile']['themeColor'],
    },
    workouts: user.workouts.map((workout) => ({
      id: workout.legacyId || workout.id,
      title: workout.title,
      date: workout.date.toISOString(),
      startTime: workout.startTimeRaw || '',
      endTime: workout.endTimeRaw || '',
      durationMinutes: workout.durationMinutes,
      unit: firstWorkoutUnit(workout) || 'lbs',
      exercises: workout.exercises.map((exercise) => ({
        id: exercise.legacyId || exercise.id,
        exerciseName: exercise.exerciseName,
        category: exercise.category as Workout['exercises'][number]['category'],
        seatSettings: exercise.seatSettings || '',
        notes: exercise.notes || '',
        distance: decimalNumber(exercise.distance),
        runningTimeMinutes: decimalNumber(exercise.runningTimeMinutes),
        ptComment: exercise.ptComment || '',
        sets: exercise.sets.map((set) => ({
          id: set.legacyId || set.id,
          setNumber: set.setNumber,
          type: set.type,
          weight: decimalNumber(set.weight) || 0,
          weightUnit: set.weightUnit,
          reps: set.reps,
          completed: set.completed,
          rpe: decimalNumber(set.rpe),
          distance: decimalNumber(set.distance),
          runningTimeMinutes: decimalNumber(set.runningTimeMinutes),
        })),
        videos: exercise.videos.map((video) => ({
          id: video.legacyId || video.id,
          workoutId: workout.legacyId || workout.id,
          exerciseId: exercise.legacyId || exercise.id,
          driveFileId: video.driveFileId,
          createdAt: video.createdAt.toISOString(),
          durationSeconds: decimalNumber(video.durationSeconds) || 0,
          mimeType: video.mimeType,
          name: video.name || '',
          webViewLink: video.webViewLink || '',
        })),
      })),
      runningDistance: decimalNumber(workout.runningDistance),
      runningTimeMinutes: decimalNumber(workout.runningTimeMinutes),
      ptNotes: workout.ptNotes || '',
      ptComment: workout.ptComment || '',
      isCompleted: workout.isCompleted,
    })),
    trainingPlan: user.trainingPlans[0] ? {
      version: 1,
      title: user.trainingPlans[0].title,
      blocks: user.trainingPlans[0].blocks.map((block) => ({
        id: block.legacyId || block.id,
        title: block.title,
        subtitle: block.subtitle || '',
        accent: block.accent || '',
        exercises: block.exercises.map((exercise) => ({
          id: exercise.legacyId || exercise.id,
          name: exercise.name,
          sets: exercise.setsText,
          reps: exercise.repsText,
          rest: exercise.restText,
        })),
      })),
      warmupMoves: user.trainingPlans[0].warmupMoves.map((move) => ({
        id: move.legacyId || move.id,
        name: move.name,
        target: move.targetText,
      })),
    } satisfies TrainingPlan : defaults.trainingPlan,
    warmupCheckins: Object.fromEntries(
      Object.entries(groupBy(user.warmupCheckins, (checkin) => checkin.checkinDate.toISOString().slice(0, 10)))
        .map(([date, checkins]) => [date, Object.fromEntries(checkins.map((checkin) => [checkin.moveIdOrLegacyKey, checkin.completed]))])
    ),
    scheduledSession: user.scheduledSessions[0] ? {
      id: user.scheduledSessions[0].legacyId || user.scheduledSessions[0].id,
      title: user.scheduledSessions[0].title,
      scheduledDate: user.scheduledSessions[0].scheduledDate.toISOString(),
      notes: user.scheduledSessions[0].notes || '',
    } : null,
  }), revision: user.stateRevision };
}

export async function writeWorkoutAppState(input: unknown, ownerId: string): Promise<WorkoutAppState> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TypeError('Invalid workout state.');
  const raw = input as WorkoutAppState;
  if (!raw.profile || !Array.isArray(raw.workouts) || !raw.trainingPlan || !Array.isArray(raw.trainingPlan.blocks)
    || !Array.isArray(raw.trainingPlan.warmupMoves) || !raw.warmupCheckins || !('scheduledSession' in raw)) {
    throw new TypeError('A complete workout state is required.');
  }
  const state = normalizeAppState(input as Partial<WorkoutAppState>);
  if (state.workouts.length !== raw.workouts.length) throw new TypeError('Invalid workout. Nothing was saved.');
  if (new Set(state.workouts.map((workout) => workout.id)).size !== state.workouts.length
    || state.workouts.some((workout) => new Set(workout.exercises.map((exercise) => exercise.id)).size !== workout.exercises.length)) {
    throw new TypeError('Duplicate workout or exercise IDs.');
  }
  const revision = (input as WorkoutAppState).revision;
  if (!Number.isInteger(revision)) throw new StateConflictError('Reload before saving.');

  await prisma.$transaction(async (db) => {
    const user = await db.user.update({
      where: { id: ownerId },
      data: { displayName: state.profile.clientName || null },
    });

    const updated = await db.user.updateMany({
      where: { id: user.id, stateRevision: revision },
      data: { stateRevision: { increment: 1 } },
    });
    if (!updated.count) throw new StateConflictError('Data changed in another window. Reload before saving.');

    await replaceOwnerState(db, user, state);
  }, { timeout: 30_000 });

  return { ...state, revision: revision! + 1 };
}

async function replaceOwnerState(db: Prisma.TransactionClient, user: User, state: WorkoutAppState) {
  await db.workout.deleteMany({ where: { ownerId: user.id, NOT: { legacyId: { in: state.workouts.map((workout) => workout.id) } } } });
  await db.trainingPlan.deleteMany({ where: { ownerId: user.id } });
  await db.warmupCheckin.deleteMany({ where: { ownerId: user.id } });
  await db.scheduledSession.deleteMany({ where: { ownerId: user.id } });

  await db.profile.upsert({
    where: { userId: user.id },
    create: profileData(user.id, state.profile),
    update: profileData(user.id, state.profile),
  });

  for (const workout of state.workouts) {
    const workoutData = {
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
    };
    const savedWorkout = await db.workout.upsert({
      where: { ownerId_legacyId: { ownerId: user.id, legacyId: workout.id } },
      create: workoutData,
      update: workoutData,
    });
    await db.exerciseLog.deleteMany({ where: { workoutId: savedWorkout.id, NOT: { legacyId: { in: workout.exercises.map((exercise) => exercise.id) } } } });
    for (const [position, exercise] of workout.exercises.entries()) {
      const exerciseData = {
            workoutId: savedWorkout.id,
            legacyId: exercise.id,
            position,
            exerciseName: exercise.exerciseName,
            category: exercise.category,
            seatSettings: optionalText(exercise.seatSettings),
            notes: optionalText(exercise.notes),
            distance: numberOrNull(exercise.distance),
            runningTimeMinutes: numberOrNull(exercise.runningTimeMinutes),
            ptComment: optionalText(exercise.ptComment),
      };
      const savedExercise = await db.exerciseLog.upsert({
        where: { workoutId_legacyId: { workoutId: savedWorkout.id, legacyId: exercise.id } },
        create: exerciseData,
        update: exerciseData,
      });
      await db.workoutSet.deleteMany({ where: { exerciseLogId: savedExercise.id } });
      await db.video.deleteMany({ where: { exerciseLogId: savedExercise.id } });
      await db.exerciseLog.update({ where: { id: savedExercise.id }, data: {
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
              create: (exercise.videos || []).map((video) => ({
                legacyId: video.id,
                driveFileId: video.driveFileId,
                createdAt: new Date(video.createdAt),
                durationSeconds: video.durationSeconds,
                mimeType: video.mimeType,
                name: optionalText(video.name),
                webViewLink: optionalText(video.webViewLink),
              })),
            },
      } });
    }
  }

  await db.trainingPlan.create({
    data: {
      ownerId: user.id,
      title: state.trainingPlan.title,
      version: state.trainingPlan.version,
      isCurrent: true,
      blocks: {
        create: state.trainingPlan.blocks.map((block, position) => ({
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
        create: state.trainingPlan.warmupMoves.map((move, position) => ({
          legacyId: move.id,
          position,
          name: move.name,
          targetText: move.target,
        })),
      },
    },
  });

  const checkins = Object.entries(state.warmupCheckins).flatMap(([date, moves]) =>
    Object.entries(moves).map(([moveIdOrLegacyKey, completed]) => ({
      ownerId: user.id,
      checkinDate: new Date(`${date}T00:00:00.000Z`),
      moveIdOrLegacyKey,
      completed,
    }))
  );
  if (checkins.length) await db.warmupCheckin.createMany({ data: checkins });

  if (state.scheduledSession) {
    await db.scheduledSession.create({
      data: {
        ownerId: user.id,
        legacyId: state.scheduledSession.id || null,
        title: state.scheduledSession.title,
        scheduledDate: new Date(state.scheduledSession.scheduledDate),
        notes: optionalText(state.scheduledSession.notes),
        status: 'scheduled',
      },
    });
  }
}

function firstWorkoutUnit(workout: { exercises: { sets: { weightUnit: 'lbs' | 'kg' }[] }[] }) {
  return workout.exercises.flatMap((exercise) => exercise.sets)[0]?.weightUnit;
}

function profileData(userId: string, profile: WorkoutAppState['profile']) {
  return {
    userId,
    clientName: profile.clientName || '',
    ptNameLabel: optionalText(profile.ptName),
    appTitle: optionalText(profile.appTitle),
    themeColor: optionalText(profile.themeColor),
  };
}

function decimalNumber(value: Prisma.Decimal | null) {
  return value == null ? undefined : value.toNumber();
}

function optionalText(value: string | null | undefined) {
  return typeof value === 'string' && value.trim() ? value : null;
}

function numberOrNull(value: number | null | undefined) {
  return value == null ? null : value;
}

function groupBy<T>(items: T[], key: (item: T) => string) {
  return items.reduce<Record<string, T[]>>((groups, item) => {
    const groupKey = key(item);
    groups[groupKey] ||= [];
    groups[groupKey].push(item);
    return groups;
  }, {});
}
