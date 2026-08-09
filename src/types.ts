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
  reps: number;
  completed: boolean;
  rpe?: number; // Rate of Perceived Exertion (1-10)
  distance?: number; // Distance in miles or km
  runningTimeMinutes?: number; // Running duration in minutes
}

export interface MuscleFeeling {
  targetMuscles: MuscleGroup[];
  sorenessLevel: SorenessLevel;
  pumpQuality: number; // 1 to 5
  jointComfort: JointComfort;
  notes: string; // Detailed text description of muscle feeling
  quickTags: string[]; // e.g. ["Target Muscle On Fire", "Form On Point", "Slight Asymmetry"]
}

export interface ExerciseLog {
  id: string;
  machineName: string;
  category: MuscleGroup;
  seatSettings?: string; // e.g., "Seat: 4, Lever: B"
  sets: WorkoutSet[];
  muscleFeeling: MuscleFeeling;
  notes?: string;
  distance?: number; // Total distance for cardio exercise
  runningTimeMinutes?: number; // Total running time for exercise
}

export interface Workout {
  id: string;
  title: string;
  date: string; // ISO string
  startTime?: string;
  endTime?: string;
  durationMinutes: number;
  unit: WeightUnit;
  exercises: ExerciseLog[];
  runningDistance?: number; // Total running distance in miles/km
  runningTimeMinutes?: number; // Total running time in minutes
  ptNotes?: string; // Special note intended for PT
  ptName?: string; // e.g. "Trainer Coach Sarah"
  clientName?: string; // User name e.g. "Alex"
  isCompleted: boolean;
}

export interface MachinePreset {
  id: string;
  name: string;
  category: MuscleGroup;
  defaultSeatSettings?: string;
  equipmentType: 'Machine' | 'Cable' | 'Free Weight' | 'Smith Machine' | 'Cardio / Treadmill';
  targetDescription: string;
}

export type ActiveTab = 'workout' | 'history' | 'machines' | 'pt-export' | 'analytics';
