import { DEFAULT_MACHINES } from '../data/defaultMachines';
import { SAMPLE_WORKOUTS } from '../data/sampleWorkouts';
import { Workout, WorkoutAppState, WorkoutVideo } from '../types';
import { ScheduledSession } from './calendar';
import { UserProfile } from './storage';

const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3';
const APP_DATA_FILE_NAME = 'workout-data.json';
const ROOT_FOLDER_NAME = 'Workout Recorder';
const VIDEO_FOLDER_NAME = 'videos';
const LOCAL_STORAGE_KEY = 'workout-recorder-drive-state';
const TOKEN_STORAGE_KEY = 'workout-recorder-google-token';
const CHUNK_SIZE = 8 * 1024 * 1024;

type TokenResponse = {
  access_token: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
  error?: string;
};

type GoogleTokenClient = {
  callback: (response: TokenResponse) => void;
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
          }) => GoogleTokenClient;
          revoke: (token: string, done: () => void) => void;
        };
      };
    };
  }
}

export type DriveConnection = {
  isConfigured: boolean;
  isConnected: boolean;
  accessToken: string | null;
};

export type DriveSyncTarget = {
  folderId: string;
  dataFileId: string;
  portalUrl: string;
};

export function createDefaultAppState(): WorkoutAppState {
  return {
    version: 1,
    profile: {
      clientName: '',
      ptName: '',
      appTitle: 'Workout Studio',
      preferredUnit: 'lbs',
      themeColor: 'ios-blue',
    },
    machines: DEFAULT_MACHINES,
    workouts: SAMPLE_WORKOUTS,
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

export function getDriveConnection(): DriveConnection {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const stored = typeof window === 'undefined' ? null : window.sessionStorage.getItem(TOKEN_STORAGE_KEY);

  return {
    isConfigured: Boolean(clientId),
    isConnected: Boolean(stored),
    accessToken: stored,
  };
}

export async function connectGoogleDrive(): Promise<DriveConnection> {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  if (!clientId) {
    throw new Error('Missing NEXT_PUBLIC_GOOGLE_CLIENT_ID.');
  }

  await loadGoogleIdentityScript();
  const token = await requestAccessToken(clientId);
  window.sessionStorage.setItem(TOKEN_STORAGE_KEY, token);
  return getDriveConnection();
}

export function disconnectGoogleDrive() {
  const token = typeof window === 'undefined' ? null : window.sessionStorage.getItem(TOKEN_STORAGE_KEY);
  if (token && window.google?.accounts?.oauth2?.revoke) {
    window.google.accounts.oauth2.revoke(token, () => undefined);
  }
  window.sessionStorage.removeItem(TOKEN_STORAGE_KEY);
}

export async function loadStateFromDrive(accessToken: string): Promise<WorkoutAppState> {
  const fileId = await findDataFile(accessToken);
  if (!fileId) {
    const initial = readLocalState();
    await saveStateToDrive(accessToken, initial);
    return initial;
  }

  const response = await fetch(`${DRIVE_API}/files/${fileId}?alt=media`, {
    headers: authHeaders(accessToken),
  });
  if (!response.ok) throw new Error(await driveError(response, 'Unable to load workout-data.json from Drive.'));

  const state = normalizeAppState(await response.json());
  saveLocalState(state);
  return state;
}

export async function saveStateToDrive(accessToken: string, state: WorkoutAppState): Promise<void> {
  const normalized = normalizeAppState(state);
  const fileId = (await findDataFile(accessToken)) || (await createDataFile(accessToken));

  const response = await fetch(`${DRIVE_UPLOAD_API}/files/${fileId}?uploadType=media`, {
    method: 'PATCH',
    headers: {
      ...authHeaders(accessToken),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(normalized, null, 2),
  });
  if (!response.ok) throw new Error(await driveError(response, 'Unable to save workout-data.json to Drive.'));
  await ensureAnyoneWithLinkReader(accessToken, fileId);
  saveLocalState(normalized);
}

export async function getDriveSyncTarget(accessToken: string): Promise<DriveSyncTarget> {
  const folderId = await getOrCreateRootFolder(accessToken);
  const dataFileId = (await findDataFile(accessToken)) || (await createDataFile(accessToken));
  await ensureAnyoneWithLinkReader(accessToken, dataFileId);

  return {
    folderId,
    dataFileId,
    portalUrl: getPortalUrl(dataFileId),
  };
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
  const exerciseSlug = slugify(exercise.machineName || 'exercise');
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

function normalizeAppState(value: Partial<WorkoutAppState>): WorkoutAppState {
  const defaults = createDefaultAppState();
  const legacyVideos = Array.isArray(value.videos) ? value.videos : [];
  const workouts = Array.isArray(value.workouts) ? value.workouts : defaults.workouts;
  const normalizedWorkouts = workouts.map((workout) => {
    const workoutLevelVideos = Array.isArray((workout as Workout & { videos?: WorkoutVideo[] }).videos)
      ? (workout as Workout & { videos?: WorkoutVideo[] }).videos || []
      : [];
    const exerciseFallbackId = workout.exercises[0]?.id || '';
    const videosForWorkout = [...legacyVideos, ...workoutLevelVideos].filter((video) => video.workoutId === workout.id);
    return {
      ...workout,
      exercises: workout.exercises.map((exercise) => {
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
    };
  });

  return {
    version: 1,
    profile: { ...defaults.profile, ...(value.profile || {}) },
    machines: Array.isArray(value.machines) && value.machines.length > 0 ? value.machines : defaults.machines,
    workouts: normalizedWorkouts,
    scheduledSession: (value.scheduledSession || null) as ScheduledSession | null,
  };
}

async function findDataFile(accessToken: string): Promise<string | null> {
  const folderId = await getOrCreateRootFolder(accessToken);
  const q = encodeURIComponent(`name='${APP_DATA_FILE_NAME}' and '${folderId}' in parents and trashed=false`);
  const response = await fetch(`${DRIVE_API}/files?q=${q}&fields=files(id,name)`, {
    headers: authHeaders(accessToken),
  });
  if (!response.ok) throw new Error(await driveError(response, 'Unable to search Drive workout data.'));
  const data = await response.json();
  return data.files?.[0]?.id || null;
}

async function createDataFile(accessToken: string): Promise<string> {
  const folderId = await getOrCreateRootFolder(accessToken);
  const response = await fetch(`${DRIVE_API}/files?fields=id`, {
    method: 'POST',
    headers: {
      ...authHeaders(accessToken),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: APP_DATA_FILE_NAME,
      parents: [folderId],
      mimeType: 'application/json',
    }),
  });
  if (!response.ok) throw new Error(await driveError(response, 'Unable to create Drive workout data file.'));
  const data = await response.json();
  return data.id;
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
  return getOrCreateChildFolder(accessToken, workoutFolderId, slugify(exercise.machineName || 'exercise'), 'exercise video');
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

function getPortalUrl(dataFileId: string): string {
  if (typeof window === 'undefined') return `/pt?dataFileId=${encodeURIComponent(dataFileId)}`;
  return `${window.location.origin}/pt?dataFileId=${encodeURIComponent(dataFileId)}`;
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

async function requestAccessToken(clientId: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const tokenClient = window.google?.accounts?.oauth2?.initTokenClient({
      client_id: clientId,
      scope: DRIVE_SCOPE,
      callback: (response) => {
        if (response.error || !response.access_token) {
          reject(new Error(response.error || 'Google authorization failed.'));
          return;
        }
        resolve(response.access_token);
      },
    });

    if (!tokenClient) {
      reject(new Error('Google Identity Services is unavailable.'));
      return;
    }

    tokenClient.requestAccessToken({ prompt: 'consent' });
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
