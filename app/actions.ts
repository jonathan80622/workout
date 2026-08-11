'use server';

import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { Workout, MachinePreset, WeightUnit, MuscleGroup, SorenessLevel, JointComfort, SetType } from '@/src/types';
import { UserProfile } from '@/src/utils/storage';
import { ScheduledSession } from '@/src/utils/calendar';
import { DEFAULT_MACHINES } from '@/src/data/defaultMachines';
import { SAMPLE_WORKOUTS } from '@/src/data/sampleWorkouts';

const GUEST_USER_EMAIL = 'guest@workouttracker.local';

async function getOrCreateUserId(): Promise<string> {
  const session = await auth();
  if (session?.user?.id) {
    return session.user.id;
  }

  // Fallback to guest user for unauthenticated sessions
  let guestUser = await prisma.user.findUnique({
    where: { email: GUEST_USER_EMAIL },
  });

  if (!guestUser) {
    guestUser = await prisma.user.create({
      data: {
        email: GUEST_USER_EMAIL,
        name: 'Guest Athlete',
      },
    });
  }

  return guestUser.id;
}

function safeJsonParse<T>(val: string | null | undefined, fallback: T): T {
  if (!val) return fallback;
  try {
    return JSON.parse(val) as T;
  } catch {
    return fallback;
  }
}

export async function getSessionInfo() {
  const session = await auth();
  return session;
}

export async function getAppData() {
  const userId = await getOrCreateUserId();

  // Load User Profile
  let profile = await prisma.userProfile.findUnique({
    where: { userId },
  });

  if (!profile) {
    profile = await prisma.userProfile.create({
      data: {
        userId,
        clientName: '',
        ptName: '',
        appTitle: 'Workout Studio',
        preferredUnit: 'lbs',
        themeColor: 'ios-blue',
      },
    });
  }

  // Load Machine Presets
  let dbMachines = await prisma.machinePreset.findMany({
    where: { OR: [{ userId }, { userId: null }] },
    orderBy: { createdAt: 'asc' },
  });

  if (dbMachines.length === 0) {
    // Seed default machines
    await prisma.machinePreset.createMany({
      data: DEFAULT_MACHINES.map((m) => ({
        id: m.id,
        userId,
        name: m.name,
        category: m.category,
        defaultSeatSettings: m.defaultSeatSettings || '',
        equipmentType: m.equipmentType,
        targetDescription: m.targetDescription || '',
      })),
    });

    dbMachines = await prisma.machinePreset.findMany({
      where: { userId },
    });
  }

  // Load Workouts
  let dbWorkouts = await prisma.workout.findMany({
    where: { userId },
    include: {
      exercises: {
        include: {
          sets: { orderBy: { setNumber: 'asc' } },
          muscleFeeling: true,
        },
        orderBy: { orderIndex: 'asc' },
      },
    },
    orderBy: { date: 'desc' },
  });

  if (dbWorkouts.length === 0) {
    // Seed sample workouts for new user
    for (const sample of SAMPLE_WORKOUTS) {
      await prisma.workout.create({
        data: {
          id: sample.id,
          userId,
          title: sample.title,
          date: new Date(sample.date),
          durationMinutes: sample.durationMinutes,
          unit: sample.unit,
          clientName: sample.clientName || '',
          ptName: sample.ptName || '',
          ptNotes: sample.ptNotes || '',
          isCompleted: sample.isCompleted,
          runningDistance: sample.runningDistance,
          runningTimeMinutes: sample.runningTimeMinutes,
          exercises: {
            create: sample.exercises.map((ex, idx) => ({
              id: ex.id,
              machineName: ex.machineName,
              category: ex.category,
              seatSettings: ex.seatSettings || '',
              notes: ex.notes || '',
              orderIndex: idx,
              sets: {
                create: ex.sets.map((s) => ({
                  id: s.id,
                  setNumber: s.setNumber,
                  type: s.type,
                  weight: s.weight,
                  reps: s.reps,
                  completed: s.completed,
                  rpe: s.rpe,
                  distance: s.distance,
                  runningTimeMinutes: s.runningTimeMinutes,
                })),
              },
              muscleFeeling: ex.muscleFeeling
                ? {
                    create: {
                      targetMuscles: JSON.stringify(ex.muscleFeeling.targetMuscles || []),
                      sorenessLevel: ex.muscleFeeling.sorenessLevel,
                      pumpQuality: ex.muscleFeeling.pumpQuality,
                      jointComfort: ex.muscleFeeling.jointComfort,
                      notes: ex.muscleFeeling.notes || '',
                      quickTags: JSON.stringify(ex.muscleFeeling.quickTags || []),
                    },
                  }
                : undefined,
            })),
          },
        },
      });
    }

    dbWorkouts = await prisma.workout.findMany({
      where: { userId },
      include: {
        exercises: {
          include: {
            sets: { orderBy: { setNumber: 'asc' } },
            muscleFeeling: true,
          },
          orderBy: { orderIndex: 'asc' },
        },
      },
      orderBy: { date: 'desc' },
    });
  }

  // Load Scheduled Session
  const dbSchedule = await prisma.scheduledSession.findFirst({
    where: { userId },
    orderBy: { scheduledDate: 'desc' },
  });

  // Map to frontend domain types
  const formattedWorkouts: Workout[] = dbWorkouts.map((w) => ({
    id: w.id,
    title: w.title,
    date: w.date.toISOString(),
    startTime: w.startTime || undefined,
    endTime: w.endTime || undefined,
    durationMinutes: w.durationMinutes,
    unit: w.unit as WeightUnit,
    runningDistance: w.runningDistance || undefined,
    runningTimeMinutes: w.runningTimeMinutes || undefined,
    ptNotes: w.ptNotes || undefined,
    ptName: w.ptName || undefined,
    clientName: w.clientName || undefined,
    isCompleted: w.isCompleted,
    exercises: w.exercises.map((ex) => ({
      id: ex.id,
      machineName: ex.machineName,
      category: ex.category as MuscleGroup,
      seatSettings: ex.seatSettings || undefined,
      notes: ex.notes || undefined,
      distance: ex.distance || undefined,
      runningTimeMinutes: ex.runningTimeMinutes || undefined,
      sets: ex.sets.map((s) => ({
        id: s.id,
        setNumber: s.setNumber,
        type: s.type as SetType,
        weight: s.weight,
        reps: s.reps,
        completed: s.completed,
        rpe: s.rpe || undefined,
        distance: s.distance || undefined,
        runningTimeMinutes: s.runningTimeMinutes || undefined,
      })),
      muscleFeeling: ex.muscleFeeling
        ? {
            targetMuscles: safeJsonParse<MuscleGroup[]>(ex.muscleFeeling.targetMuscles, [ex.category as MuscleGroup]),
            sorenessLevel: ex.muscleFeeling.sorenessLevel as SorenessLevel,
            pumpQuality: ex.muscleFeeling.pumpQuality,
            jointComfort: ex.muscleFeeling.jointComfort as JointComfort,
            notes: ex.muscleFeeling.notes,
            quickTags: safeJsonParse<string[]>(ex.muscleFeeling.quickTags, []),
          }
        : {
            targetMuscles: [ex.category as MuscleGroup],
            sorenessLevel: 'none',
            pumpQuality: 4,
            jointComfort: 'great',
            notes: '',
            quickTags: [],
          },
    })),
  }));

  const activeWorkout = formattedWorkouts.find((w) => !w.isCompleted) || null;
  const completedWorkouts = formattedWorkouts.filter((w) => w.isCompleted);

  const formattedMachines: MachinePreset[] = dbMachines.map((m) => ({
    id: m.id,
    name: m.name,
    category: mCategory(m.category),
    defaultSeatSettings: m.defaultSeatSettings || undefined,
    equipmentType: m.equipmentType as MachinePreset['equipmentType'],
    targetDescription: m.targetDescription,
  }));

  const userProfile: UserProfile = {
    clientName: profile.clientName,
    ptName: profile.ptName,
    appTitle: profile.appTitle,
    preferredUnit: profile.preferredUnit as 'lbs' | 'kg',
    themeColor: profile.themeColor as UserProfile['themeColor'],
  };

  const scheduledSession: ScheduledSession | null = dbSchedule
    ? {
        id: dbSchedule.id,
        title: dbSchedule.title,
        scheduledDate: dbSchedule.scheduledDate.toISOString(),
        notes: dbSchedule.notes || undefined,
      }
    : null;

  return {
    profile: userProfile,
    workouts: completedWorkouts,
    activeWorkout,
    machines: formattedMachines,
    scheduledSession,
  };
}

function mCategory(cat: string): MuscleGroup {
  return cat as MuscleGroup;
}

export async function saveUserProfile(profile: UserProfile) {
  const userId = await getOrCreateUserId();
  await prisma.userProfile.upsert({
    where: { userId },
    update: {
      clientName: profile.clientName,
      ptName: profile.ptName,
      appTitle: profile.appTitle || 'Workout Studio',
      preferredUnit: profile.preferredUnit,
      themeColor: profile.themeColor,
    },
    create: {
      userId,
      clientName: profile.clientName,
      ptName: profile.ptName,
      appTitle: profile.appTitle || 'Workout Studio',
      preferredUnit: profile.preferredUnit,
      themeColor: profile.themeColor,
    },
  });
}

export async function saveWorkout(workout: Workout) {
  const userId = await getOrCreateUserId();

  // Delete existing exercises and sets for clean overwrite if workout exists
  const existing = await prisma.workout.findUnique({
    where: { id: workout.id },
  });

  if (existing) {
    await prisma.exerciseLog.deleteMany({
      where: { workoutId: workout.id },
    });
  }

  await prisma.workout.upsert({
    where: { id: workout.id },
    update: {
      title: workout.title,
      date: new Date(workout.date),
      startTime: workout.startTime,
      endTime: workout.endTime,
      durationMinutes: workout.durationMinutes,
      unit: workout.unit,
      clientName: workout.clientName || '',
      ptName: workout.ptName || '',
      ptNotes: workout.ptNotes || '',
      isCompleted: workout.isCompleted,
      runningDistance: workout.runningDistance,
      runningTimeMinutes: workout.runningTimeMinutes,
      exercises: {
        create: workout.exercises.map((ex, idx) => ({
          id: ex.id.startsWith('ex-') ? undefined : ex.id,
          machineName: ex.machineName,
          category: ex.category,
          seatSettings: ex.seatSettings || '',
          notes: ex.notes || '',
          orderIndex: idx,
          sets: {
            create: ex.sets.map((s) => ({
              id: s.id.startsWith('s-') ? undefined : s.id,
              setNumber: s.setNumber,
              type: s.type,
              weight: s.weight,
              reps: s.reps,
              completed: s.completed,
              rpe: s.rpe,
              distance: s.distance,
              runningTimeMinutes: s.runningTimeMinutes,
            })),
          },
          muscleFeeling: ex.muscleFeeling
            ? {
                create: {
                  targetMuscles: JSON.stringify(ex.muscleFeeling.targetMuscles || []),
                  sorenessLevel: ex.muscleFeeling.sorenessLevel,
                  pumpQuality: ex.muscleFeeling.pumpQuality,
                  jointComfort: ex.muscleFeeling.jointComfort,
                  notes: ex.muscleFeeling.notes || '',
                  quickTags: JSON.stringify(ex.muscleFeeling.quickTags || []),
                },
              }
            : undefined,
        })),
      },
    },
    create: {
      id: workout.id,
      userId,
      title: workout.title,
      date: new Date(workout.date),
      startTime: workout.startTime,
      endTime: workout.endTime,
      durationMinutes: workout.durationMinutes,
      unit: workout.unit,
      clientName: workout.clientName || '',
      ptName: workout.ptName || '',
      ptNotes: workout.ptNotes || '',
      isCompleted: workout.isCompleted,
      runningDistance: workout.runningDistance,
      runningTimeMinutes: workout.runningTimeMinutes,
      exercises: {
        create: workout.exercises.map((ex, idx) => ({
          id: ex.id.startsWith('ex-') ? undefined : ex.id,
          machineName: ex.machineName,
          category: ex.category,
          seatSettings: ex.seatSettings || '',
          notes: ex.notes || '',
          orderIndex: idx,
          sets: {
            create: ex.sets.map((s) => ({
              id: s.id.startsWith('s-') ? undefined : s.id,
              setNumber: s.setNumber,
              type: s.type,
              weight: s.weight,
              reps: s.reps,
              completed: s.completed,
              rpe: s.rpe,
              distance: s.distance,
              runningTimeMinutes: s.runningTimeMinutes,
            })),
          },
          muscleFeeling: ex.muscleFeeling
            ? {
                create: {
                  targetMuscles: JSON.stringify(ex.muscleFeeling.targetMuscles || []),
                  sorenessLevel: ex.muscleFeeling.sorenessLevel,
                  pumpQuality: ex.muscleFeeling.pumpQuality,
                  jointComfort: ex.muscleFeeling.jointComfort,
                  notes: ex.muscleFeeling.notes || '',
                  quickTags: JSON.stringify(ex.muscleFeeling.quickTags || []),
                },
              }
            : undefined,
        })),
      },
    },
  });
}

export async function deleteWorkout(workoutId: string) {
  const userId = await getOrCreateUserId();
  await prisma.workout.deleteMany({
    where: { id: workoutId, userId },
  });
}

export async function saveMachinePresets(machines: MachinePreset[]) {
  const userId = await getOrCreateUserId();

  for (const m of machines) {
    await prisma.machinePreset.upsert({
      where: { id: m.id },
      update: {
        name: m.name,
        category: m.category,
        defaultSeatSettings: m.defaultSeatSettings || '',
        equipmentType: m.equipmentType,
        targetDescription: m.targetDescription || '',
      },
      create: {
        id: m.id,
        userId,
        name: m.name,
        category: m.category,
        defaultSeatSettings: m.defaultSeatSettings || '',
        equipmentType: m.equipmentType,
        targetDescription: m.targetDescription || '',
      },
    });
  }
}

export async function saveScheduledSession(session: ScheduledSession | null) {
  const userId = await getOrCreateUserId();

  if (!session) {
    await prisma.scheduledSession.deleteMany({
      where: { userId },
    });
    return;
  }

  await prisma.scheduledSession.upsert({
    where: { id: session.id },
    update: {
      title: session.title,
      scheduledDate: new Date(session.scheduledDate),
      notes: session.notes || '',
    },
    create: {
      id: session.id,
      userId,
      title: session.title,
      scheduledDate: new Date(session.scheduledDate),
      notes: session.notes || '',
    },
  });
}
