import { Workout } from '../types';

export interface UserProfile {
  clientName: string;
  ptName: string;
  appTitle?: string;
  preferredUnit: 'lbs' | 'kg';
  themeColor: 'ios-blue' | 'ios-emerald' | 'ios-purple' | 'ios-orange';
}

export function sanitizeWorkout(w: Workout): Workout {
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
