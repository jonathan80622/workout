'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Workout, ActiveTab, WorkoutAppState, TrainingPlan, WarmupCheckins } from '@/src/types';
import { UserProfile } from '@/src/utils/storage';
import { ScheduledSession } from '@/src/utils/calendar';
import { AnalyticsProvider, useAnalytics } from '@/src/analytics/AnalyticsProvider';
import { IOSHeader } from './IOSHeader';
import { IOSTabBar } from './IOSTabBar';
import { ActiveWorkout } from './ActiveWorkout';
import { WorkoutHistory } from './WorkoutHistory';
import { TrainingPlanView } from './TrainingPlanView';
import WeightTrackingPage from '@/app/weight-tracking/page';
import { ProfileModal } from './ProfileModal';
import { ScheduleCalendarModal } from './ScheduleCalendarModal';
import { NextSessionBanner } from './NextSessionBanner';
import {
  combineWorkouts,
  createDefaultAppState,
  DriveConnection,
  forgetGoogleAccessToken,
  hasDriveAccessToken,
  requestGoogleAccessToken,
  signInWithGoogle,
  saveLocalState,
  splitWorkouts,
} from '@/src/utils/driveStorage';
import { isE2EMode, loadE2ESeed, saveE2EState } from '@/src/utils/e2eBridge';
import { AppStateError, loadStateFromPostgres, saveStateToPostgres } from '@/src/utils/postgresState';
import { calculateCompletedSets, calculateTotalDistance, calculateWorkoutVolume } from '@/src/utils/formatters';

interface WorkoutTrackerAppProps {
  initialProfile: UserProfile;
  initialWorkouts: Workout[];
  initialActiveWorkout: Workout | null;
  initialScheduledSession: ScheduledSession | null;
  initialTrainingPlan?: TrainingPlan;
  initialWarmupCheckins?: WarmupCheckins;
  initialTab?: ActiveTab;
}

export function WorkoutTrackerApp(props: WorkoutTrackerAppProps) {
  return (
    <AnalyticsProvider>
      <WorkoutTrackerAppContent {...props} />
    </AnalyticsProvider>
  );
}

function WorkoutTrackerAppContent({
  initialProfile,
  initialWorkouts,
  initialActiveWorkout,
  initialScheduledSession,
  initialTrainingPlan,
  initialWarmupCheckins,
  initialTab = 'workout',
}: WorkoutTrackerAppProps) {
  const track = useAnalytics();
  const [activeTab, setActiveTab] = useState<ActiveTab>(initialTab);
  const [profile, setProfile] = useState<UserProfile>(initialProfile);
  const [workouts, setWorkouts] = useState<Workout[]>(initialWorkouts);
  const [activeWorkout, setActiveWorkout] = useState<Workout | null>(initialActiveWorkout);
  const [trainingPlan, setTrainingPlan] = useState<TrainingPlan>(initialTrainingPlan || createDefaultAppState().trainingPlan);
  const [warmupCheckins, setWarmupCheckins] = useState<WarmupCheckins>(initialWarmupCheckins || {});
  const [scheduledSession, setScheduledSession] = useState<ScheduledSession | null>(initialScheduledSession);
  const [driveConnection, setDriveConnection] = useState<DriveConnection>('checking');
  const [authState, setAuthState] = useState<'checking' | 'signed-out' | 'unlinked' | 'ready'>('checking');
  const [syncStatus, setSyncStatus] = useState<string>('Loading workouts...');
  const [portalUrl, setPortalUrl] = useState<string>('');
  // In e2e mode, state is mirrored to the test oracle only after the seed loads,
  // so the default starter state never overwrites it.
  const [isE2ESeeded, setIsE2ESeeded] = useState<boolean>(false);
  const [isPersistenceReady, setIsPersistenceReady] = useState<boolean>(false);
  const revision = useRef(0);
  const saveQueue = useRef(Promise.resolve());
  const persistenceBlocked = useRef(false);
  const lastSaved = useRef('');

  const [isProfileModalOpen, setIsProfileModalOpen] = useState<boolean>(false);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState<boolean>(false);

  const appState: WorkoutAppState = useMemo(
    () => ({
      version: 1,
      profile,
      workouts: combineWorkouts(workouts, activeWorkout),
      trainingPlan,
      warmupCheckins,
      scheduledSession,
    }),
    [activeWorkout, profile, scheduledSession, trainingPlan, warmupCheckins, workouts]
  );

  useEffect(() => {
    if (isE2EMode()) {
      loadE2ESeed()
        .then((state) => {
          applyLoadedState(state);
          setAuthState('ready');
          setIsE2ESeeded(true);
          setSyncStatus('Loaded e2e seed.');
        })
        .catch((error) => setSyncStatus(error instanceof Error ? error.message : 'E2E seed failed.'));
      return;
    }

    setPortalUrl(`${window.location.origin}/pt`);
    const authError = new URLSearchParams(window.location.search).get('auth_error');

    loadStateFromPostgres()
      .then((state) => {
        setAuthState('ready');
        setDriveConnection(hasDriveAccessToken() ? 'connected' : 'disconnected');
        applyLoadedState(state);
        revision.current = state.revision || 0;
        const { revision: _revision, ...loaded } = state;
        lastSaved.current = JSON.stringify(loaded);
        setIsPersistenceReady(true);
        setSyncStatus('Loaded from Postgres.');
      })
      .catch((error) => {
        if (error instanceof AppStateError && (error.status === 401 || error.status === 403)) {
          setAuthState(error.status === 401 ? 'signed-out' : 'unlinked');
          setSyncStatus(authError ? 'Google sign-in did not finish. Try again.' : '');
          return;
        }
        setSyncStatus(error instanceof Error ? `${error.message} Reload to retry.` : 'Workouts could not be loaded. Reload to retry.');
      });
  }, []);

  useEffect(() => {
    // Never let seeded e2e data overwrite a real browser's saved workouts.
    if (isE2EMode()) {
      if (isE2ESeeded) saveE2EState(appState).catch(() => undefined);
      return;
    }
    if (!isPersistenceReady) return;
    saveLocalState(appState);
  }, [appState, isE2ESeeded, isPersistenceReady]);

  useEffect(() => {
    if (!isPersistenceReady || isE2EMode()) return;

    const timer = window.setTimeout(() => {
      saveQueue.current = saveQueue.current.then(async () => {
        if (persistenceBlocked.current || JSON.stringify(appState) === lastSaved.current) return;
        try {
          const saved = await saveStateToPostgres({ ...appState, revision: revision.current });
          revision.current = saved.revision!;
          lastSaved.current = JSON.stringify(appState);
          setSyncStatus('Saved.');
        } catch (error) {
          persistenceBlocked.current = true;
          setSyncStatus(error instanceof Error ? error.message : 'Save failed. Reload before saving.');
        }
      });
    }, 900);

    return () => window.clearTimeout(timer);
  }, [appState, isPersistenceReady]);

  const applyLoadedState = (state: WorkoutAppState) => {
    const split = splitWorkouts(state.workouts);
    setProfile(state.profile);
    setWorkouts(split.completedWorkouts);
    setActiveWorkout(split.activeWorkout);
    setTrainingPlan(state.trainingPlan);
    setWarmupCheckins(state.warmupCheckins);
    setScheduledSession(state.scheduledSession);
  };

  const handleSaveProfile = (newProfile: UserProfile) => {
    setProfile(newProfile);
  };

  const handleTabChange = (tab: ActiveTab) => {
    setActiveTab(tab);
    track('tab_viewed', { tab });
  };

  const handleUpdateActiveWorkout = (updated: Workout) => {
    setActiveWorkout(updated);
  };

  const handleFinishWorkout = (completedWorkout: Workout) => {
    const finished = { ...completedWorkout, isCompleted: true };
    track('workout_completed', {
      duration_minutes: finished.durationMinutes,
      exercise_count: finished.exercises.length,
      completed_set_count: calculateCompletedSets(finished),
      total_volume: calculateWorkoutVolume(finished),
      total_distance: calculateTotalDistance(finished),
      has_pt_note: Boolean(finished.ptNotes?.trim()),
      video_count: finished.exercises.reduce((sum, exercise) => sum + (exercise.videos?.length || 0), 0),
    });
    setActiveWorkout(null);
    setWorkouts((prev) => [finished, ...prev]);
    setActiveTab('history');
  };

  const handleDiscardActiveWorkout = () => {
    if (activeWorkout) {
      track('workout_discarded', {
        duration_minutes: activeWorkout.durationMinutes,
        exercise_count: activeWorkout.exercises.length,
        completed_set_count: calculateCompletedSets(activeWorkout),
      });
    }
    setActiveWorkout(null);
  };

  const handleDeleteWorkout = (workoutId: string) => {
    const workout = workouts.find((w) => w.id === workoutId);
    if (workout) {
      track('workout_deleted', {
        exercise_count: workout.exercises.length,
        completed_set_count: calculateCompletedSets(workout),
      });
    }
    setWorkouts((prev) => prev.filter((w) => w.id !== workoutId));
  };

  const handleRepeatWorkout = (workout: Workout) => {
    const newActive: Workout = {
      id: `w-${Date.now()}`,
      title: workout.title,
      date: new Date().toISOString(),
      durationMinutes: 0,
      unit: workout.unit,
      clientName: profile.clientName,
      ptName: profile.ptName,
      ptNotes: workout.ptNotes || '',
      isCompleted: false,
      exercises: workout.exercises.map((ex, idx) => ({
        id: `ex-${Date.now()}-${idx}`,
        exerciseName: ex.exerciseName,
        category: ex.category,
        seatSettings: ex.seatSettings || '',
        sets: ex.sets.map((s, sIdx) => ({
          id: `s-${Date.now()}-${idx}-${sIdx}`,
          setNumber: s.setNumber,
          type: s.type,
          weight: s.weight,
          weightUnit: s.weightUnit,
          reps: s.reps,
          completed: false,
          rpe: s.rpe,
        })),
        notes: ex.notes || '',
      })),
    };

    setActiveWorkout(newActive);
    setActiveTab('workout');
    track('workout_repeated', {
      exercise_count: workout.exercises.length,
      completed_set_count: calculateCompletedSets(workout),
    });
    track('workout_started', {
      source: 'history',
      exercise_count: newActive.exercises.length,
    });
  };

  const handleStartNewWorkoutFromScratch = () => {
    const newActive: Workout = {
      id: `w-${Date.now()}`,
      title: 'Full Body Movement',
      date: new Date().toISOString(),
      durationMinutes: 0,
      unit: 'lbs',
      clientName: profile.clientName,
      ptName: profile.ptName,
      ptNotes: '',
      isCompleted: false,
      exercises: [],
    };
    setActiveWorkout(newActive);
    track('workout_started', {
      source: 'scratch',
      has_scheduled_session: Boolean(scheduledSession),
      exercise_count: 0,
    });
  };

  const handleStartScheduledNow = () => {
    const title = scheduledSession?.title || 'Scheduled Session';
    const newActive: Workout = {
      id: `w-${Date.now()}`,
      title,
      date: new Date().toISOString(),
      durationMinutes: 0,
      unit: 'lbs',
      clientName: profile.clientName,
      ptName: profile.ptName,
      ptNotes: scheduledSession?.notes || '',
      isCompleted: false,
      exercises: [],
    };
    setActiveWorkout(newActive);
    setScheduledSession(null);
    setActiveTab('workout');
    track('scheduled_session_started', {
      has_notes: Boolean(scheduledSession?.notes?.trim()),
    });
    track('workout_started', {
      source: 'scheduled',
      has_scheduled_session: true,
      exercise_count: 0,
    });
  };

  const handleSaveScheduledSession = (session: ScheduledSession) => {
    setScheduledSession(session);
  };

  const handleClearScheduledSession = () => {
    setScheduledSession(null);
  };

  const handleSignIn = async () => {
    try {
      setSyncStatus('Opening Google sign-in...');
      await signInWithGoogle();
      window.location.reload();
    } catch (error) {
      setSyncStatus(error instanceof Error ? error.message : 'Sign-in failed. Try again.');
    }
  };

  const handleConnectDrive = async () => {
    try {
      setSyncStatus('Opening Google authorization...');
      await requestGoogleAccessToken();
      setDriveConnection('connected');
      setSyncStatus('Drive connected for video uploads.');
      track('drive_connected', {});
    } catch (error) {
      setSyncStatus(error instanceof Error ? error.message : 'Unable to connect Google Drive.');
    }
  };

  const handleSignOut = async () => {
    forgetGoogleAccessToken();
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => undefined);
    window.location.reload();
  };

  const handleUpdateWorkoutTitle = (workoutId: string, newTitle: string) => {
    setWorkouts((prev) =>
      prev.map((w) => {
        if (w.id === workoutId) {
          const updated = { ...w, title: newTitle };
          return updated;
        }
        return w;
      })
    );
  };

  const handleUpdateWorkoutDate = (workoutId: string, newDateIso: string) => {
    setWorkouts((prev) =>
      prev.map((w) => {
        if (w.id === workoutId) {
          const updated = { ...w, date: newDateIso };
          return updated;
        }
        return w;
      })
    );
  };

  const handleUpdateExercisePtComment = (workoutId: string, exerciseId: string, ptComment: string) => {
    setWorkouts((prev) => prev.map((workout) =>
      workout.id === workoutId
        ? {
            ...workout,
            exercises: workout.exercises.map((exercise) =>
              exercise.id === exerciseId ? { ...exercise, ptComment } : exercise
            ),
          }
        : workout
    ));
  };

  const isDriveConnected = driveConnection === 'connected';

  return (
    <div
      className={`workout-app-shell ${
        isDriveConnected ? 'drive-connected' : 'drive-dead'
      } min-h-screen bg-[#0c0a09] text-[#f7f3ee] flex flex-col max-w-md mx-auto shadow-2xl relative border-x border-[#2b241f]`}
    >
      <div className="drive-theme-content flex min-h-screen flex-col">
        <IOSHeader
          title={profile.appTitle || 'Workout Studio'}
          isTimerRunning={!!activeWorkout}
          timerSeconds={0}
          clientName={profile.clientName}
          ptName={profile.ptName}
          onOpenProfileModal={() => setIsProfileModalOpen(true)}
        />

        {authState === 'ready' && driveConnection === 'disconnected' && (
          <div className="border-b border-[#545454] bg-[#1a1a1a] px-4 py-2 text-center">
            <p className="font-syne text-[10px] font-bold uppercase tracking-wider text-[#c7c7c7]">
              Connect Drive to upload videos
            </p>
          </div>
        )}

        <main className="flex-1 px-4 pt-3 pb-24 overflow-y-auto space-y-4">
          <p role="status" className="text-xs text-[#a39588]">{syncStatus}</p>
          {(authState === 'signed-out' || authState === 'unlinked') && (
            <div className="bg-[#181412] border border-[#382f29] rounded-3xl p-6 text-center space-y-4 shadow-xl">
              <h3 className="text-lg font-serif font-bold text-[#f7f3ee]">
                {authState === 'signed-out' ? 'Sign in to continue' : 'Account not linked'}
              </h3>
              <p className="text-xs text-[#a39588] font-light max-w-xs mx-auto">
                {authState === 'signed-out'
                  ? 'Sign in with Google to load your workouts and enable video uploads.'
                  : 'This Google account is signed in but not linked to workout data yet.'}
              </p>
              {authState === 'signed-out' ? (
                <button
                  onClick={handleSignIn}
                  className="block w-full py-3.5 bg-gradient-to-r from-[#d97724] via-[#c86d51] to-[#e6a15c] text-[#0c0a09] font-syne font-bold text-xs rounded-2xl shadow-lg shadow-[#d97724]/20"
                >
                  Sign in with Google
                </button>
              ) : (
                <button
                  onClick={handleSignOut}
                  className="w-full py-3 bg-[#211b18] border border-[#382f29] text-[#c86d51] font-syne font-bold text-xs rounded-2xl"
                >
                  Sign out
                </button>
              )}
            </div>
          )}
          {(authState === 'checking' || authState === 'ready') && (
          <fieldset disabled={!isPersistenceReady && !isE2ESeeded} className="contents">
          {/* Tab 1: Workout */}
          {activeTab === 'workout' && (
            <div className="space-y-4">
              <NextSessionBanner
                scheduledSession={scheduledSession}
                onOpenScheduleModal={() => setIsScheduleModalOpen(true)}
                onClearSession={handleClearScheduledSession}
                onStartSessionNow={handleStartScheduledNow}
              />

              {activeWorkout ? (
                <ActiveWorkout
                  workout={activeWorkout}
                  workoutHistory={workouts}
                  onUpdateWorkout={handleUpdateActiveWorkout}
                  onFinishWorkout={handleFinishWorkout}
                  onDiscardWorkout={handleDiscardActiveWorkout}
                  onTrack={track}
                />
              ) : (
                <div className="bg-[#181412] border border-[#382f29] rounded-3xl p-6 text-center space-y-4 shadow-xl">
                  <div className="w-14 h-14 rounded-full bg-[#d97724]/20 border border-[#d97724]/40 flex items-center justify-center mx-auto text-[#e6a15c]">
                    <span className="text-2xl">🏋️</span>
                  </div>
                  <div>
                    <h3 className="text-lg font-serif font-bold text-[#f7f3ee]">No Active Session</h3>
                    <p className="text-xs text-[#a39588] font-light max-w-xs mx-auto mt-1">
                      Start a workout or repeat a past training session.
                    </p>
                  </div>
                  <button
                    onClick={handleStartNewWorkoutFromScratch}
                    className="w-full py-3.5 bg-gradient-to-r from-[#d97724] via-[#c86d51] to-[#e6a15c] text-[#0c0a09] font-syne font-bold text-xs rounded-2xl shadow-lg shadow-[#d97724]/20 transition-all hover:opacity-95"
                  >
                    + Start New Workout Session
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Tab 2: Training Plan */}
          {activeTab === 'plan' && (
            <TrainingPlanView
              trainingPlan={trainingPlan}
              warmupCheckins={warmupCheckins}
              onWarmupCheckinsChange={setWarmupCheckins}
            />
          )}

          {/* Tab 3: History */}
          {activeTab === 'history' && (
            <WorkoutHistory
              workouts={workouts}
              onDeleteWorkout={handleDeleteWorkout}
              onRepeatWorkout={handleRepeatWorkout}
              onStartNewWorkout={handleStartNewWorkoutFromScratch}
              onUpdateWorkoutTitle={handleUpdateWorkoutTitle}
              onUpdateWorkoutDate={handleUpdateWorkoutDate}
              onUpdateExercisePtComment={handleUpdateExercisePtComment}
              onTrack={track}
            />
          )}

          {/* Tab 4: Weight */}
          {activeTab === 'weight' && (
            <div className="-mx-4 -my-3">
              <WeightTrackingPage />
            </div>
          )}

          </fieldset>
          )}
        </main>

        <IOSTabBar
          activeTab={activeTab}
          onTabChange={handleTabChange}
          hasActiveWorkout={!!activeWorkout}
        />

        <ProfileModal
          profile={profile}
          isOpen={isProfileModalOpen}
          onClose={() => setIsProfileModalOpen(false)}
          onSaveProfile={handleSaveProfile}
          driveConnection={driveConnection}
          onConnectDrive={handleConnectDrive}
          onSignOut={handleSignOut}
          syncStatus={syncStatus}
          portalUrl={portalUrl}
        />

        <ScheduleCalendarModal
          isOpen={isScheduleModalOpen}
          onClose={() => setIsScheduleModalOpen(false)}
          onSessionSaved={handleSaveScheduledSession}
          onTrack={track}
        />
      </div>
    </div>
  );
}
