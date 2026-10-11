import { tool } from 'ai';
import { z } from 'zod';
import { prisma } from '@/src/server/db';
import { readWorkoutAppState } from '@/src/server/appStateStore';
import { splitWorkouts } from '@/src/utils/driveStorage';
import { Workout } from '@/src/types';

// Read tools run on the server against the signed-in owner's rows only.
export function createReadTools(ownerId: string) {
  const loadState = () => readWorkoutAppState({ id: ownerId });

  return {
    getRecentWorkouts: tool({
      description: 'Completed workouts, newest first, with every exercise and set.',
      inputSchema: z.object({ limit: z.number().int().min(1).max(20).default(5) }),
      execute: async ({ limit }) => {
        const { completedWorkouts } = splitWorkouts((await loadState()).workouts);
        return [...completedWorkouts]
          .sort((a, b) => b.date.localeCompare(a.date))
          .slice(0, limit)
          .map(summarizeWorkout);
      },
    }),
    getExerciseHistory: tool({
      description: 'Every logged session of one exercise, newest first. Matches names case-insensitively and by substring.',
      inputSchema: z.object({ exerciseName: z.string().min(1) }),
      execute: async ({ exerciseName }) => {
        const query = exerciseName.trim().toLocaleLowerCase();
        const { completedWorkouts } = splitWorkouts((await loadState()).workouts);
        return [...completedWorkouts]
          .sort((a, b) => b.date.localeCompare(a.date))
          .flatMap((workout) => workout.exercises
            .filter((exercise) => exercise.exerciseName.toLocaleLowerCase().includes(query))
            .map((exercise) => ({
              date: workout.date,
              workoutTitle: workout.title,
              exerciseName: exercise.exerciseName,
              seatSettings: exercise.seatSettings || undefined,
              sets: exercise.sets.map(summarizeSet),
            })))
          .slice(0, 30);
      },
    }),
    getCurrentSession: tool({
      description: 'The in-progress workout, if any, and the next scheduled session, if any.',
      inputSchema: z.object({}),
      execute: async () => {
        const state = await loadState();
        const { activeWorkout } = splitWorkouts(state.workouts);
        return {
          activeWorkout: activeWorkout ? summarizeWorkout(activeWorkout) : null,
          scheduledSession: state.scheduledSession,
        };
      },
    }),
    getTrainingPlan: tool({
      description: 'The current training plan: blocks of exercises with target sets, reps and rest, plus warm-up moves.',
      inputSchema: z.object({}),
      execute: async () => (await loadState()).trainingPlan,
    }),
    getBodyWeights: tool({
      description: 'Body weight entries over the last N days, oldest first. weightKg is canonical; sourceValue/sourceUnit is what was typed.',
      inputSchema: z.object({ days: z.number().int().min(1).max(3650).default(90) }),
      execute: async ({ days }) => {
        const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
        const entries = await prisma.bodyWeightEntry.findMany({
          where: { ownerId, date: { gte: since } },
          orderBy: { date: 'asc' },
        });
        return entries.map((entry) => ({
          date: entry.date.toISOString().slice(0, 10),
          weightKg: entry.weightKg.toNumber(),
          sourceValue: entry.sourceValue.toNumber(),
          sourceUnit: entry.sourceUnit,
        }));
      },
    }),
  };
}

function summarizeWorkout(workout: Workout) {
  return {
    workoutId: workout.id,
    title: workout.title,
    date: workout.date,
    durationMinutes: workout.durationMinutes,
    isCompleted: workout.isCompleted,
    ptComment: workout.ptComment || undefined,
    exercises: workout.exercises.map((exercise) => ({
      exerciseName: exercise.exerciseName,
      category: exercise.category,
      sets: exercise.sets.map(summarizeSet),
      ptComment: exercise.ptComment || undefined,
    })),
  };
}

function summarizeSet(set: Workout['exercises'][number]['sets'][number]) {
  return {
    type: set.type,
    weight: set.weight,
    weightUnit: set.weightUnit,
    reps: set.reps,
    completed: set.completed,
    ...(set.rpe == null ? {} : { rpe: set.rpe }),
    ...(set.distance == null ? {} : { distance: set.distance }),
    ...(set.runningTimeMinutes == null ? {} : { runningTimeMinutes: set.runningTimeMinutes }),
  };
}
