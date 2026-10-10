const ANALYTICS_ID_STORAGE_KEY = 'workout_analytics_id';

export function getAnalyticsDistinctId(): string | null {
  if (typeof window === 'undefined') return null;

  const stored = window.localStorage.getItem(ANALYTICS_ID_STORAGE_KEY);
  if (stored) return stored;

  const id = `workout_${createUuid()}`;
  window.localStorage.setItem(ANALYTICS_ID_STORAGE_KEY, id);
  return id;
}

function createUuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const random = Math.floor(Math.random() * 16);
    const value = char === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}
