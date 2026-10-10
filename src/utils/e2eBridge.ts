import { WorkoutAppState } from '../types';
import { normalizeAppState } from './driveStorage';

const E2E_STATE_URL = '/api/e2e-state';

/** True when the page was opened by an end-to-end run (`?e2e=1`). */
export function isE2EMode(): boolean {
  if (typeof window === 'undefined' || process.env.NODE_ENV === 'production') return false;
  return new URLSearchParams(window.location.search).has('e2e');
}

export async function loadE2ESeed(): Promise<WorkoutAppState> {
  const response = await fetch(E2E_STATE_URL, { cache: 'no-store' });
  if (!response.ok) throw new Error(`E2E seed unavailable (HTTP ${response.status}).`);
  return normalizeAppState(await response.json());
}

export async function saveE2EState(state: WorkoutAppState): Promise<void> {
  await fetch(E2E_STATE_URL, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(normalizeAppState(state)),
  });
}
