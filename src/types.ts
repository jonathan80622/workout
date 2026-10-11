export type WeightUnit = 'lbs' | 'kg';

export type SetType = 'warmup' | 'working' | 'drop' | 'failure';

export type MuscleGroup = 
  | 'Chest'
  | 'Lats & Back'
  | 'Quads'
  | 'Hamstrings'
  | 'Glutes'
  | 'Shoulders'
  | 'Biceps'
  | 'Triceps'
  | 'Abs & Core'
  | 'Calves'
  | 'Lower Back'
  | 'Forearms'
  | 'Cardio & Running';

export interface WorkoutSet {
  id: string;
  setNumber: number;
  type: SetType;
  weight: number;
  weightUnit: WeightUnit;
  reps: number;
  completed: boolean;
  rpe?: number; // Rate of Perceived Exertion (1-10)
  distance?: number; // Distance in miles or km
  runningTimeMinutes?: number; // Running duration in minutes
}

export interface ExerciseLog {
  id: string;
  exerciseName: string;
  category: MuscleGroup;
  seatSettings?: string; // e.g., "Seat: 4, Lever: B"
  sets: WorkoutSet[];
  notes?: string;
  distance?: number; // Total distance for cardio exercise
  runningTimeMinutes?: number; // Total running time for exercise
  videos?: WorkoutVideo[];
  ptComment?: string; // Trainer feedback on this exercise
}

export interface Workout {
  id: string;
  title: string;
  date: string; // ISO string
  startTime?: string;
  endTime?: string;
  durationMinutes: number;
  unit: WeightUnit; // Legacy workout-level default only. Set weightUnit is authoritative.
  exercises: ExerciseLog[];
  runningDistance?: number; // Total running distance in miles/km
  runningTimeMinutes?: number; // Total running time in minutes
  ptNotes?: string; // Special note intended for PT
  ptComment?: string; // Trainer feedback on the completed workout
  ptName?: string; // e.g. "Trainer Coach Sarah"
  clientName?: string; // User name e.g. "Alex"
  isCompleted: boolean;
}

export interface WorkoutVideo {
  id: string;
  workoutId: string;
  exerciseId: string;
  driveFileId: string;
  createdAt: string;
  durationSeconds: number;
  mimeType: string;
  name?: string;
  webViewLink?: string;
}

export interface BodyWeightEntry {
  schemaVersion: 1;
  id: string;
  date: string; // YYYY-MM-DD, local weigh-in date
  weightKg: number; // Canonical storage unit for all body weight math.
  sourceValue: number; // The value as originally entered.
  sourceUnit: WeightUnit;
}

export interface BodyWeightStore {
  version: 1;
  entries: BodyWeightEntry[];
}

export interface TrainingPlanExercise {
  id: string;
  name: string;
  sets: string;
  reps: string;
  rest: string;
}

export interface TrainingPlanBlock {
  id: string;
  title: string;
  subtitle: string;
  accent: string;
  exercises: TrainingPlanExercise[];
}

export interface WarmupMove {
  id: string;
  name: string;
  target: string;
}

export interface TrainingPlan {
  version: 1;
  title: string;
  blocks: TrainingPlanBlock[];
  warmupMoves: WarmupMove[];
}

export type WarmupCheckins = Record<string, Record<string, boolean>>;

export interface WorkoutAppState {
  version: 1;
  revision?: number;
  profile: {
    clientName: string;
    ptName: string;
    appTitle?: string;
    preferredUnit?: WeightUnit; // Legacy only. Workout weights are scoped by Workout.unit.
    themeColor: 'ios-blue' | 'ios-emerald' | 'ios-purple' | 'ios-orange';
  };
  workouts: Workout[];
  trainingPlan: TrainingPlan;
  warmupCheckins: WarmupCheckins;
  scheduledSession: import('./utils/calendar').ScheduledSession | null;
  videos?: WorkoutVideo[]; // Legacy top-level video list, migrated into ExerciseLog.videos on load.
}

export type ActiveTab = 'workout' | 'plan' | 'history' | 'weight' | 'bumstead';
