import { tool, type InferToolInput } from 'ai';
import { z } from 'zod';

// Edit tools have no server `execute`: the call streams to the browser, the user approves it there,
// and the app applies it through its own state so the normal autosave stays the only writer.
const muscleGroups = [
  'Chest', 'Lats & Back', 'Quads', 'Hamstrings', 'Glutes', 'Shoulders', 'Biceps', 'Triceps',
  'Abs & Core', 'Calves', 'Lower Back', 'Forearms', 'Cardio & Running',
] as const;

const editOutputSchema = z.object({ applied: z.boolean(), message: z.string() });
export type EditToolOutput = z.infer<typeof editOutputSchema>;

export const editTools = {
  scheduleSession: tool({
    description: 'Schedule the next training session. Replaces any session already scheduled.',
    inputSchema: z.object({
      title: z.string().min(1).max(120),
      scheduledDate: z.string().describe('ISO 8601 date-time in the user\'s time zone, with offset.'),
      notes: z.string().max(1000).optional(),
    }),
    outputSchema: editOutputSchema,
  }),
  renameWorkout: tool({
    description: 'Rename a completed workout. Use a workoutId returned by getRecentWorkouts.',
    inputSchema: z.object({ workoutId: z.string().min(1), title: z.string().min(1).max(120) }),
    outputSchema: editOutputSchema,
  }),
  moveWorkoutDate: tool({
    description: 'Change the date of a completed workout. Use a workoutId returned by getRecentWorkouts.',
    inputSchema: z.object({
      workoutId: z.string().min(1),
      date: z.string().describe('ISO 8601 date-time, with offset.'),
    }),
    outputSchema: editOutputSchema,
  }),
  addExerciseToActiveWorkout: tool({
    description: 'Add an exercise with planned sets to the in-progress workout, starting one if none is active. '
      + 'Each set carries its own weight unit.',
    inputSchema: z.object({
      exerciseName: z.string().min(1).max(120),
      category: z.enum(muscleGroups),
      sets: z.array(z.object({
        weight: z.number().min(0),
        weightUnit: z.enum(['lbs', 'kg']),
        reps: z.number().int().min(0),
        type: z.enum(['warmup', 'working', 'drop', 'failure']).default('working'),
      })).min(1).max(12),
    }),
    outputSchema: editOutputSchema,
  }),
};

export type EditToolName = keyof typeof editTools;
export type EditToolInput<NAME extends EditToolName> = InferToolInput<(typeof editTools)[NAME]>;

export function isEditToolName(name: string): name is EditToolName {
  return Object.hasOwn(editTools, name);
}
