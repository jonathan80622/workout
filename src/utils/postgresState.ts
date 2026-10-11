import { WorkoutAppState } from '@/src/types';

const APP_STATE_ENDPOINT = '/api/app-state';

export async function loadStateFromPostgres(): Promise<WorkoutAppState> {
  const response = await fetch(APP_STATE_ENDPOINT, { cache: 'no-store' });
  if (!response.ok) throw new Error(await apiError(response, 'Unable to load workout state from Postgres.'));
  return response.json();
}

export async function saveStateToPostgres(state: WorkoutAppState): Promise<WorkoutAppState> {
  const response = await fetch(APP_STATE_ENDPOINT, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(state),
  });
  if (!response.ok) throw new Error(await apiError(response, 'Unable to save workout state to Postgres.'));
  return response.json();
}

async function apiError(response: Response, fallback: string) {
  const data = await response.json().catch(() => null);
  return typeof data?.error === 'string' ? data.error : fallback;
}
