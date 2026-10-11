import { DEFAULT_TRAINING_PLAN } from '../data/defaultTrainingPlan';
import { ExerciseLog, SetType, WeightUnit, Workout, WorkoutAppState, WorkoutSet, WorkoutVideo } from '../types';
import { ScheduledSession } from './calendar';
import { UserProfile } from './storage';

const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
// openid + email let the same popup that grants Drive also identify the account for sign-in.
const GOOGLE_SCOPES = `openid email ${DRIVE_SCOPE}`;
const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3';
const ROOT_FOLDER_NAME = 'Workout Recorder';
const VIDEO_FOLDER_NAME = 'videos';
const LOCAL_STORAGE_KEY = 'workout-recorder-drive-state';
const TOKEN_STORAGE_KEY = 'workout-recorder-google-token';
const CHUNK_SIZE = 8 * 1024 * 1024;

type TokenResponse = {
  access_token: string;
  expires_in?: number;
  error?: string;
};

type GoogleTokenClient = {
  requestAccessToken: (options?: { prompt?: string }) => void;
};

declare global {
  interface Window {
    google?: {
      accounts?: {
        oauth2?: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (response: TokenResponse) => void;
            error_callback?: (error: { type?: string; message?: string }) => void;
          }) => GoogleTokenClient;
        };
      };
    };
  }
}

export function createDefaultAppState(): WorkoutAppState {
  return {
    version: 1,
    profile: {
      clientName: '',
      ptName: '',
      appTitle: 'Workout Studio',
      themeColor: 'ios-blue',
    },
    workouts: [],
    trainingPlan: DEFAULT_TRAINING_PLAN,
    warmupCheckins: {},
    scheduledSession: null,
  };
}

export function splitWorkouts(workouts: Workout[]) {
  return {
    activeWorkout: workouts.find((workout) => !workout.isCompleted) || null,
    completedWorkouts: workouts.filter((workout) => workout.isCompleted),
  };
}

export function combineWorkouts(completedWorkouts: Workout[], activeWorkout: Workout | null): Workout[] {
  return activeWorkout ? [activeWorkout, ...completedWorkouts] : completedWorkouts;
}

export function readLocalState(): WorkoutAppState {
  if (typeof window === 'undefined') return createDefaultAppState();

  const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY);
  if (!raw) return createDefaultAppState();

  try {
    return normalizeAppState(JSON.parse(raw));
  } catch {
    return createDefaultAppState();
  }
}

export function saveLocalState(state: WorkoutAppState) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(normalizeAppState(state)));
}

export function hasDriveAccessToken(): boolean {
  return Boolean(readStoredToken());
}

// Google access tokens last about an hour; an expired one reads as disconnected rather than failing mid-upload.
function readStoredToken(): string | null {
  if (typeof window === 'undefined') return null;
  const raw = window.sessionStorage.getItem(TOKEN_STORAGE_KEY);
  if (!raw) return null;

  try {
    const { token, expiresAt } = JSON.parse(raw) as { token?: string; expiresAt?: number };
    if (token && typeof expiresAt === 'number' && Date.now() < expiresAt) return token;
  } catch {
    // Unreadable entry: drop it and ask Google again.
  }
  window.sessionStorage.removeItem(TOKEN_STORAGE_KEY);
  return null;
}

export function forgetGoogleAccessToken() {
  window.sessionStorage.removeItem(TOKEN_STORAGE_KEY);
}

/** Opens Google's popup. Call it from a click handler, or the browser blocks the popup. */
export async function requestGoogleAccessToken(): Promise<string> {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  if (!clientId) throw new Error('Google sign-in is not configured.');

  await loadGoogleIdentityScript();
  const { access_token: token, expires_in: expiresIn = 3600 } = await requestAccessToken(clientId);
  // Expire a minute early so an upload never starts with a token about to lapse.
  const expiresAt = Date.now() + (expiresIn - 60) * 1000;
  window.sessionStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify({ token, expiresAt }));
  return token;
}

export async function getDriveAccessToken(): Promise<string> {
  return readStoredToken() ?? requestGoogleAccessToken();
}

/** Signs in with the Google popup, which also grants Drive; the server checks the token and starts a session. */
export async function signInWithGoogle(): Promise<void> {
  const accessToken = await requestGoogleAccessToken();
  const response = await fetch('/api/auth/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accessToken }),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(typeof data?.error === 'string' ? data.error : 'Sign-in failed. Try again.');
  }
}

export async function uploadWorkoutVideo(params: {
  accessToken: string;
  workout: Workout;
  exercise: import('../types').ExerciseLog;
  file: File;
  durationSeconds: number;
}): Promise<WorkoutVideo> {
  const { accessToken, workout, exercise, file, durationSeconds } = params;
  const folderId = await getOrCreateExerciseVideoFolder(accessToken, workout, exercise);
  const createdAt = new Date().toISOString();
  const extension = getFileExtension(file);
  const workoutDate = getDatePart(workout.date);
  const titleSlug = slugify(workout.title || 'workout');
  const exerciseSlug = slugify(exercise.exerciseName || 'exercise');
  const videoNumber = (exercise.videos?.length || 0) + 1;
  const name = `${workoutDate}_${titleSlug}_${exerciseSlug}_video-${String(videoNumber).padStart(2, '0')}.${extension}`;

  const session = await fetch(`${DRIVE_UPLOAD_API}/files?uploadType=resumable&fields=id,webViewLink,name,mimeType`, {
    method: 'POST',
    headers: {
      ...authHeaders(accessToken),
      'Content-Type': 'application/json; charset=UTF-8',
      'X-Upload-Content-Type': file.type || 'application/octet-stream',
      'X-Upload-Content-Length': String(file.size),
    },
    body: JSON.stringify({
      name,
      mimeType: file.type || 'application/octet-stream',
      parents: [folderId],
    }),
  });

  const uploadUrl = session.headers.get('Location');
  if (!session.ok || !uploadUrl) throw new Error(await driveError(session, 'Unable to start Drive video upload.'));

  let offset = 0;
  let uploadedFile: { id: string; webViewLink?: string; name?: string; mimeType?: string } | null = null;

  while (offset < file.size) {
    const end = Math.min(offset + CHUNK_SIZE, file.size) - 1;
    const chunk = file.slice(offset, end + 1, file.type);
    const response = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Length': String(chunk.size),
        'Content-Range': `bytes ${offset}-${end}/${file.size}`,
      },
      body: chunk,
    });

    if (response.status === 308) {
      const range = response.headers.get('Range');
      offset = range ? Number(range.split('-')[1]) + 1 : end + 1;
      continue;
    }

    if (!response.ok) throw new Error(await driveError(response, 'Drive video upload failed.'));
    uploadedFile = await response.json();
    offset = file.size;
  }

  if (!uploadedFile?.id) throw new Error('Drive upload completed without a file id.');
  await ensureAnyoneWithLinkReader(accessToken, uploadedFile.id);

  return {
    id: `video-${Date.now()}`,
    workoutId: workout.id,
    exerciseId: exercise.id,
    driveFileId: uploadedFile.id,
    createdAt,
    durationSeconds,
    mimeType: uploadedFile.mimeType || file.type || 'application/octet-stream',
    name: uploadedFile.name || name,
    webViewLink: uploadedFile.webViewLink,
  };
}

export function normalizeAppState(value: Partial<WorkoutAppState>): WorkoutAppState {
  const defaults = createDefaultAppState();
  const legacyVideos = Array.isArray(value.videos) ? value.videos : [];
  const workouts = Array.isArray(value.workouts) ? value.workouts : defaults.workouts;
  const normalizedWorkouts = workouts.flatMap((workout) => {
    const normalizedWorkout = normalizeWorkout(workout);
    if (!normalizedWorkout) return [];
    const workoutLevelVideos = Array.isArray((workout as Workout & { videos?: WorkoutVideo[] }).videos)
      ? (workout as Workout & { videos?: WorkoutVideo[] }).videos || []
      : [];
    const exerciseFallbackId = normalizedWorkout.exercises[0]?.id || '';
    const videosForWorkout = [...legacyVideos, ...workoutLevelVideos].filter((video) => video.workoutId === normalizedWorkout.id);
    return [{
      ...normalizedWorkout,
      exercises: normalizedWorkout.exercises.map((exercise) => {
        const exerciseVideos = Array.isArray(exercise.videos) ? exercise.videos : [];
        const migratedVideos = videosForWorkout.filter((video) => {
          const targetExerciseId = video.exerciseId || exerciseFallbackId;
          return targetExerciseId === exercise.id && !exerciseVideos.some((existing) => existing.id === video.id);
        });

        return {
          ...exercise,
          videos: [...exerciseVideos, ...migratedVideos.map((video) => ({ ...video, exerciseId: exercise.id }))],
        };
      }),
    }];
  });

  return {
    version: 1,
    profile: { ...defaults.profile, ...(value.profile || {}) },
    workouts: normalizedWorkouts,
    trainingPlan: normalizeTrainingPlan(value.trainingPlan, defaults.trainingPlan),
    warmupCheckins: normalizeWarmupCheckins(value.warmupCheckins),
    scheduledSession: (value.scheduledSession || null) as ScheduledSession | null,
  };
}

function normalizeWorkout(value: unknown): Workout | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;

  const workout = value as Partial<Workout>;
  if (
    typeof workout.id !== 'string' ||
    typeof workout.title !== 'string' ||
    typeof workout.date !== 'string' ||
    typeof workout.durationMinutes !== 'number' ||
    typeof workout.isCompleted !== 'boolean' ||
    !isWeightUnit(workout.unit) ||
    !Array.isArray(workout.exercises)
  ) {
    return null;
  }

  const exercises = workout.exercises.map(normalizeExercise).filter(Boolean);
  if (exercises.length !== workout.exercises.length) return null;

  return {
    ...workout,
    unit: workout.unit,
    exercises,
  } as Workout;
}

function normalizeExercise(value: unknown): ExerciseLog | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;

  const { machineName, ...current } = value as Partial<ExerciseLog> & { machineName?: string };
  const exercise = { ...current, exerciseName: current.exerciseName ?? machineName };
  if (
    typeof exercise.id !== 'string' ||
    typeof exercise.exerciseName !== 'string' ||
    typeof exercise.category !== 'string' ||
    !Array.isArray(exercise.sets)
  ) {
    return null;
  }

  const sets = exercise.sets.map(normalizeSet).filter(Boolean);
  if (sets.length !== exercise.sets.length) return null;

  return {
    ...exercise,
    sets,
  } as ExerciseLog;
}

function normalizeSet(value: unknown): WorkoutSet | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;

  const set = value as Partial<WorkoutSet>;
  if (
    typeof set.id !== 'string' ||
    typeof set.setNumber !== 'number' ||
    !isSetType(set.type) ||
    typeof set.weight !== 'number' ||
    !isWeightUnit(set.weightUnit) ||
    typeof set.reps !== 'number' ||
    typeof set.completed !== 'boolean'
  ) {
    return null;
  }

  return set as WorkoutSet;
}

function isWeightUnit(value: unknown): value is WeightUnit {
  return value === 'lbs' || value === 'kg';
}

function isSetType(value: unknown): value is SetType {
  return value === 'warmup' || value === 'working' || value === 'drop' || value === 'failure';
}

function normalizeTrainingPlan(
  value: Partial<WorkoutAppState['trainingPlan']> | undefined,
  fallback: WorkoutAppState['trainingPlan']
): WorkoutAppState['trainingPlan'] {
  if (!value || !Array.isArray(value.blocks) || !Array.isArray(value.warmupMoves)) return fallback;

  return {
    version: 1,
    title: typeof value.title === 'string' && value.title.trim() ? value.title : fallback.title,
    blocks: value.blocks.length > 0 ? value.blocks : fallback.blocks,
    warmupMoves: value.warmupMoves.length > 0 ? value.warmupMoves : fallback.warmupMoves,
  };
}

function normalizeWarmupCheckins(value: unknown): WorkoutAppState['warmupCheckins'] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};

  const checkins: WorkoutAppState['warmupCheckins'] = {};

  Object.entries(value as Record<string, unknown>).forEach(([dateKey, moves]) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey) || !moves || typeof moves !== 'object' || Array.isArray(moves)) {
      return;
    }

    const dayCheckins: Record<string, boolean> = {};
    Object.entries(moves as Record<string, unknown>).forEach(([moveId, checked]) => {
      if (typeof checked === 'boolean') {
        dayCheckins[moveId] = checked;
      }
    });
    checkins[dateKey] = dayCheckins;
  });

  return checkins;
}

async function getOrCreateRootFolder(accessToken: string): Promise<string> {
  const q = encodeURIComponent(
    `name='${ROOT_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`
  );
  const existing = await fetch(`${DRIVE_API}/files?q=${q}&fields=files(id,name)`, {
    headers: authHeaders(accessToken),
  });
  if (!existing.ok) throw new Error(await driveError(existing, 'Unable to search Drive workout folder.'));
  const data = await existing.json();
  if (data.files?.[0]?.id) return data.files[0].id;

  const created = await fetch(`${DRIVE_API}/files?fields=id`, {
    method: 'POST',
    headers: {
      ...authHeaders(accessToken),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: ROOT_FOLDER_NAME,
      mimeType: 'application/vnd.google-apps.folder',
    }),
  });
  if (!created.ok) throw new Error(await driveError(created, 'Unable to create Drive workout folder.'));
  const folder = await created.json();
  return folder.id;
}

async function getOrCreateVideoFolder(accessToken: string): Promise<string> {
  const rootFolderId = await getOrCreateRootFolder(accessToken);
  return getOrCreateChildFolder(accessToken, rootFolderId, VIDEO_FOLDER_NAME, 'video');
}

async function getOrCreateExerciseVideoFolder(
  accessToken: string,
  workout: Workout,
  exercise: import('../types').ExerciseLog
): Promise<string> {
  const videoFolderId = await getOrCreateVideoFolder(accessToken);
  const dateFolderId = await getOrCreateChildFolder(accessToken, videoFolderId, getDatePart(workout.date), 'video date');
  const workoutFolderId = await getOrCreateChildFolder(
    accessToken,
    dateFolderId,
    slugify(workout.title || 'workout'),
    'workout video'
  );
  return getOrCreateChildFolder(accessToken, workoutFolderId, slugify(exercise.exerciseName || 'exercise'), 'exercise video');
}

async function getOrCreateChildFolder(
  accessToken: string,
  parentFolderId: string,
  name: string,
  label: string
): Promise<string> {
  const q = encodeURIComponent(
    `name='${escapeDriveQueryValue(name)}' and '${parentFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`
  );
  const existing = await fetch(`${DRIVE_API}/files?q=${q}&fields=files(id,name)`, {
    headers: authHeaders(accessToken),
  });
  if (!existing.ok) throw new Error(await driveError(existing, `Unable to search Drive ${label} folder.`));
  const data = await existing.json();
  if (data.files?.[0]?.id) return data.files[0].id;

  const created = await fetch(`${DRIVE_API}/files?fields=id`, {
    method: 'POST',
    headers: {
      ...authHeaders(accessToken),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentFolderId],
    }),
  });
  if (!created.ok) throw new Error(await driveError(created, `Unable to create Drive ${label} folder.`));
  const folder = await created.json();
  return folder.id;
}

function getDatePart(dateIso: string): string {
  return dateIso ? dateIso.split('T')[0] : new Date().toISOString().split('T')[0];
}

function getFileExtension(file: File): string {
  const nameExtension = file.name.split('.').pop()?.toLowerCase();
  if (nameExtension && /^[a-z0-9]+$/.test(nameExtension)) return nameExtension;
  if (file.type.includes('mp4')) return 'mp4';
  if (file.type.includes('quicktime')) return 'mov';
  if (file.type.includes('webm')) return 'webm';
  return 'video';
}

function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .trim()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'workout';
}

function escapeDriveQueryValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

async function ensureAnyoneWithLinkReader(accessToken: string, fileId: string): Promise<void> {
  const existing = await fetch(`${DRIVE_API}/files/${fileId}/permissions?fields=permissions(id,type,role)`, {
    headers: authHeaders(accessToken),
  });

  if (existing.ok) {
    const data = await existing.json();
    const alreadyShared = data.permissions?.some(
      (permission: { type?: string; role?: string }) =>
        permission.type === 'anyone' && ['reader', 'commenter', 'writer', 'owner'].includes(permission.role || '')
    );
    if (alreadyShared) return;
  }

  const response = await fetch(`${DRIVE_API}/files/${fileId}/permissions`, {
    method: 'POST',
    headers: {
      ...authHeaders(accessToken),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      role: 'reader',
      type: 'anyone',
      allowFileDiscovery: false,
    }),
  });

  if (!response.ok) {
    throw new Error(await driveError(response, 'Unable to make Drive file viewable by link.'));
  }
}

function authHeaders(accessToken: string) {
  return { Authorization: `Bearer ${accessToken}` };
}

async function loadGoogleIdentityScript() {
  if (window.google?.accounts?.oauth2) return;

  await new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[src="https://accounts.google.com/gsi/client"]');
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('Google Identity Services failed to load.')), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Google Identity Services failed to load.'));
    document.head.appendChild(script);
  });
}

async function requestAccessToken(clientId: string): Promise<TokenResponse> {
  return new Promise((resolve, reject) => {
    const tokenClient = window.google?.accounts?.oauth2?.initTokenClient({
      client_id: clientId,
      scope: GOOGLE_SCOPES,
      callback: (response) => {
        if (response.error || !response.access_token) {
          reject(new Error(response.error || 'Google authorization failed.'));
          return;
        }
        resolve(response);
      },
      // Fires when the popup is closed or blocked; without it the promise would never settle.
      error_callback: (error) => reject(new Error(error.message || 'Google sign-in was closed.')),
    });

    if (!tokenClient) {
      reject(new Error('Google Identity Services is unavailable.'));
      return;
    }

    // Empty prompt: Google shows consent only on first grant, then reuses the existing authorization.
    tokenClient.requestAccessToken({ prompt: '' });
  });
}

async function driveError(response: Response, fallback: string) {
  try {
    const data = await response.json();
    return data.error?.message || fallback;
  } catch {
    return fallback;
  }
}
