import { Workout, MachinePreset } from '../types';
import { SAMPLE_WORKOUTS } from '../data/sampleWorkouts';
import { DEFAULT_MACHINES } from '../data/defaultMachines';

const WORKOUTS_KEY = 'ios_workout_tracker_workouts_v1';
const MACHINES_KEY = 'ios_workout_tracker_machines_v1';
const ACTIVE_WORKOUT_KEY = 'ios_workout_tracker_active_session_v1';
const USER_PROFILE_KEY = 'ios_workout_tracker_user_profile_v1';

export interface UserProfile {
  clientName: string;
  ptName: string;
  appTitle?: string;
  preferredUnit: 'lbs' | 'kg';
  themeColor: 'ios-blue' | 'ios-emerald' | 'ios-purple' | 'ios-orange';
}

function sanitizeWorkout(w: Workout): Workout {
  let title = w.title || 'Workout';
  title = title
    .replace(/Grounding Lower Vessel Flow/gi, 'Leg Day & Quad Focus')
    .replace(/Grounding Lower Vessel Movement/gi, 'Leg Day & Quad Focus')
    .replace(/Grounding Lower Vessel/gi, 'Leg Day & Quad Focus')
    .replace(/Somatic Movement/gi, 'Workout')
    .replace(/Somatic Flow/gi, 'Workout')
    .replace(/Grounding/gi, 'Strength')
    .replace(/Somatic/gi, 'Workout')
    .replace(/Vessel/gi, 'Body');

  const clientName = w.clientName === 'Jordan Vance' || w.clientName === 'Jordan' ? '' : w.clientName;
  const ptName = w.ptName === 'Coach Marcus' ? '' : w.ptName;

  return {
    ...w,
    title,
    clientName,
    ptName
  };
}

export function loadWorkouts(): Workout[] {
  try {
    const raw = localStorage.getItem(WORKOUTS_KEY);
    if (!raw) {
      localStorage.setItem(WORKOUTS_KEY, JSON.stringify(SAMPLE_WORKOUTS));
      return SAMPLE_WORKOUTS;
    }
    const parsed: Workout[] = JSON.parse(raw);
    const sanitized = parsed.map(sanitizeWorkout);
    // Persist cleaned version back to storage
    localStorage.setItem(WORKOUTS_KEY, JSON.stringify(sanitized));
    return sanitized;
  } catch (err) {
    console.error('Failed to load workouts from localStorage:', err);
    return SAMPLE_WORKOUTS;
  }
}

export function saveWorkouts(workouts: Workout[]): void {
  try {
    localStorage.setItem(WORKOUTS_KEY, JSON.stringify(workouts));
  } catch (err) {
    console.error('Failed to save workouts to localStorage:', err);
  }
}

export function loadMachines(): MachinePreset[] {
  try {
    const raw = localStorage.getItem(MACHINES_KEY);
    if (!raw) {
      localStorage.setItem(MACHINES_KEY, JSON.stringify(DEFAULT_MACHINES));
      return DEFAULT_MACHINES;
    }
    return JSON.parse(raw);
  } catch (err) {
    console.error('Failed to load machines from localStorage:', err);
    return DEFAULT_MACHINES;
  }
}

export function saveMachines(machines: MachinePreset[]): void {
  try {
    localStorage.setItem(MACHINES_KEY, JSON.stringify(machines));
  } catch (err) {
    console.error('Failed to save machines to localStorage:', err);
  }
}

export function loadActiveWorkout(): Workout | null {
  try {
    const raw = localStorage.getItem(ACTIVE_WORKOUT_KEY);
    if (!raw) return null;
    const parsed: Workout = JSON.parse(raw);
    const sanitized = sanitizeWorkout(parsed);
    localStorage.setItem(ACTIVE_WORKOUT_KEY, JSON.stringify(sanitized));
    return sanitized;
  } catch (err) {
    console.error('Failed to load active session:', err);
    return null;
  }
}

export function saveActiveWorkout(workout: Workout | null): void {
  try {
    if (workout) {
      localStorage.setItem(ACTIVE_WORKOUT_KEY, JSON.stringify(workout));
    } else {
      localStorage.removeItem(ACTIVE_WORKOUT_KEY);
    }
  } catch (err) {
    console.error('Failed to save active session:', err);
  }
}

export function loadUserProfile(): UserProfile {
  const defaultProfile: UserProfile = {
    clientName: '',
    ptName: '',
    appTitle: 'Workout Studio',
    preferredUnit: 'lbs',
    themeColor: 'ios-blue'
  };
  try {
    const raw = localStorage.getItem(USER_PROFILE_KEY);
    if (!raw) {
      localStorage.setItem(USER_PROFILE_KEY, JSON.stringify(defaultProfile));
      return defaultProfile;
    }
    return { ...defaultProfile, ...JSON.parse(raw) };
  } catch (err) {
    return defaultProfile;
  }
}

export function saveUserProfile(profile: UserProfile): void {
  try {
    localStorage.setItem(USER_PROFILE_KEY, JSON.stringify(profile));
  } catch (err) {
    console.error('Failed to save user profile:', err);
  }
}
