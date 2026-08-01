import { Workout, ExerciseLog, WeightUnit } from '../types';

export function calculateWorkoutVolume(workout: Workout): number {
  return workout.exercises.reduce((accEx, ex) => {
    const exVolume = ex.sets.reduce((accSet, set) => {
      if (set.completed && set.weight > 0 && set.reps > 0) {
        return accSet + (set.weight * set.reps);
      }
      return accSet;
    }, 0);
    return accEx + exVolume;
  }, 0);
}

export function calculateCompletedSets(workout: Workout): number {
  return workout.exercises.reduce((acc, ex) => {
    return acc + ex.sets.filter(s => s.completed).length;
  }, 0);
}

export function calculateCompletedReps(workout: Workout): number {
  return workout.exercises.reduce((accEx, ex) => {
    return accEx + ex.sets.reduce((accSet, set) => set.completed ? accSet + set.reps : accSet, 0);
  }, 0);
}

export function getHeaviestSet(workout: Workout): { weight: number; reps: number; machineName: string } | null {
  let maxWeight = 0;
  let best: { weight: number; reps: number; machineName: string } | null = null;

  workout.exercises.forEach(ex => {
    ex.sets.forEach(set => {
      if (set.completed && set.weight > maxWeight) {
        maxWeight = set.weight;
        best = { weight: set.weight, reps: set.reps, machineName: ex.machineName };
      }
    });
  });

  return best;
}

export function formatWorkoutDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    }).format(date);
  } catch (e) {
    return dateString;
  }
}

export function formatShortDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric'
    }).format(date);
  } catch (e) {
    return dateString;
  }
}

export function convertWeight(value: number, from: WeightUnit, to: WeightUnit): number {
  if (from === to) return value;
  if (from === 'lbs' && to === 'kg') return Math.round(value * 0.453592 * 10) / 10;
  if (from === 'kg' && to === 'lbs') return Math.round(value * 2.20462);
  return value;
}
