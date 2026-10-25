import { MuscleGroup, WeightUnit, Workout } from '../types';

export type HistoricalExerciseOption = {
  id: string;
  name: string;
  category: MuscleGroup;
  seatSettings: string;
  lastSet?: {
    weight: number;
    weightUnit: WeightUnit;
    reps: number;
  };
};

export function getHistoricalExercises(workouts: Workout[]): HistoricalExerciseOption[] {
  const seen = new Map<string, HistoricalExerciseOption>();
  [...workouts]
    .filter((workout) => workout.isCompleted)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .forEach((workout) => workout.exercises.forEach((exercise) => {
      const name = exercise.exerciseName.trim();
      const key = name.toLocaleLowerCase();
      if (name && !seen.has(key)) {
        const lastSet = exercise.sets[exercise.sets.length - 1];
        seen.set(key, {
          id: `history-${exercise.id}`,
          name,
          category: exercise.category,
          seatSettings: exercise.seatSettings || '',
          lastSet: lastSet && {
            weight: lastSet.weight,
            weightUnit: lastSet.weightUnit,
            reps: lastSet.reps,
          },
        });
      }
    }));
  return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name));
}
