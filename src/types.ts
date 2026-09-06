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

export type SorenessLevel = 'none' | 'mild' | 'moderate' | 'intense';
export type JointComfort = 'great' | 'minor_stiffness' | 'discomfort';

export interface WorkoutSet {
  id: string;
  setNumber: number;
  type: SetType;
  weight: number;
  weightUnit: WeightUnit;
  reps: number;
  completed: boolean;
  rpe?: number;
  distance?: number;
  runningTimeMinutes?: number;
}

export interface MuscleFeeling {
  targetMuscles: MuscleGroup[];
  sorenessLevel: SorenessLevel;
  pumpQuality: number;
  jointComfort: JointComfort;
  notes: string;
  quickTags: string[];
}

export interface ExerciseLog {
  id: string;
  machineName: string;
  category: MuscleGroup;
  seatSettings?: string;
  sets: WorkoutSet[];
  muscleFeeling: MuscleFeeling;
  notes?: string;
  distance?: number;
  runningTimeMinutes?: number;
  videos?: WorkoutVideo[];
  ptComment?: string;
}

export interface Workout {
  id: string;
  title: string;
  date: string;
  startTime?: string;
  endTime?: string;
  durationMinutes: number;
  unit: WeightUnit;
  exercises: ExerciseLog[];
  runningDistance?: number;
  runningTimeMinutes?: number;
  ptNotes?: string;
  ptComment?: string;
  ptName?: string;
  clientName?: string;
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
  date: string;
  weightKg: number;
  sourceValue: number;
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
  cue?: string;
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
  profile: {
    clientName: string;
    ptName: string;
    appTitle?: string;
    preferredUnit?: WeightUnit;
    themeColor: 'ios-blue' | 'ios-emerald' | 'ios-purple' | 'ios-orange';
    /** AES-GCM encrypted Google refresh credential; server-only semantics. */
    serverDriveCredential?: string;
  };
  machines: MachinePreset[];
  workouts: Workout[];
  trainingPlan: TrainingPlan;
  warmupCheckins: WarmupCheckins;
  scheduledSession: import('./utils/calendar').ScheduledSession | null;
  videos?: WorkoutVideo[];
}

export interface MachinePreset {
  id: string;
  name: string;
  category: MuscleGroup;
  defaultSeatSettings?: string;
  equipmentType: 'Machine' | 'Cable' | 'Free Weight' | 'Smith Machine' | 'Cardio / Treadmill';
  targetDescription: string;
}

export type ActiveTab = 'workout' | 'plan' | 'history' | 'weight' | 'machines';
