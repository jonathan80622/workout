import { WorkoutAppState } from '@/src/types';

const APP_STATE_ENDPOINT = '/api/app-state';

/** HTTP status lets callers tell "not signed in" (401) and "not linked" (403) from failures. */
export class AppStateError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

export async function loadStateFromPostgres(): Promise<WorkoutAppState> {
  const response = await fetch(APP_STATE_ENDPOINT, { cache: 'no-store' });
  if (!response.ok) throw new AppStateError(await apiError(response, 'Unable to load workout state from Postgres.'), response.status);
  return response.json();
}

export async function saveStateToPostgres(state: WorkoutAppState): Promise<WorkoutAppState> {
  const response = await fetch(APP_STATE_ENDPOINT, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(state),
  });
  if (!response.ok) throw new AppStateError(await apiError(response, 'Unable to save workout state to Postgres.'), response.status);
  return response.json();
}

async function apiError(response: Response, fallback: string) {
  const data = await response.json().catch(() => null);
  return typeof data?.error === 'string' ? data.error : fallback;
}
