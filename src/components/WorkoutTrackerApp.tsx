'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Workout, ActiveTab, WorkoutAppState, TrainingPlan, WarmupCheckins } from '@/src/types';
import type { EditToolInput } from '@/src/chat/editTools';
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
import { ApplyBumsteadEdit, BumsteadChat } from './BumsteadChat';
import {
  combineWorkouts,
  createDefaultAppState,
  forgetGoogleAccessToken,
  signInWithGoogle,
  saveLocalState,
  splitWorkouts,
} from '@/src/utils/driveStorage';
import { isE2EMode, loadE2ESeed, saveE2EState } from '@/src/utils/e2eBridge';
import { AppStateError, loadStateFromPostgres, saveStateToPostgres } from '@/src/utils/postgresState';
import { calculateCompletedSets, calculateTotalDistance, calculateWorkoutVolume } from '@/src/utils/formatters';
import type { AnalyticsEventName, AnalyticsPropertiesByEvent, AnalyticsTrackOptions } from '@/src/analytics/events';

interface WorkoutTrackerAppProps {
  initialProfile: UserProfile;
  initialWorkouts: Workout[];
  initialActiveWorkout: Workout | null;
  initialScheduledSession: ScheduledSession | null;
  initialTrainingPlan?: TrainingPlan;
  initialWarmupCheckins?: WarmupCheckins;
  initialTab?: ActiveTab;
}

type PendingAnalyticsEvent = {
  [TEvent in AnalyticsEventName]: {
    event: TEvent;
    properties: AnalyticsPropertiesByEvent[TEvent];
    options?: AnalyticsTrackOptions;
  }
}[AnalyticsEventName];

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
  // Signed in means Drive was granted; an expired Drive token is renewed by the upload button.
  const [authState, setAuthState] = useState<'checking' | 'signed-out' | 'ready'>('checking');
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
  const pendingAnalytics = useRef<PendingAnalyticsEvent[]>([]);

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

  const queueAnalyticsAfterPersistence = <TEvent extends AnalyticsEventName>(
    event: TEvent,
    properties: AnalyticsPropertiesByEvent[TEvent],
    options?: AnalyticsTrackOptions
  ) => {
    pendingAnalytics.current.push({ event, properties, options } as PendingAnalyticsEvent);
  };

  const flushPersistedAnalytics = (queued: PendingAnalyticsEvent[]) => {
    for (const item of queued) {
      track(item.event, item.properties as never, item.options);
    }
  };

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
    
    loadStateFromPostgres()
      .then((state) => {
        setAuthState('ready');
        applyLoadedState(state);
        revision.current = state.revision || 0;
        const { revision: _revision, ...loaded } = state;
        lastSaved.current = JSON.stringify(loaded);
        setIsPersistenceReady(true);
        setSyncStatus('Loaded from Postgres.');
      })
      .catch((error) => {
        if (error instanceof AppStateError && error.status === 401) {
          setAuthState('signed-out');
          setSyncStatus('');
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
        const analyticsForThisSave = pendingAnalytics.current;
        pendingAnalytics.current = [];
        try {
          const saved = await saveStateToPostgres({ ...appState, revision: revision.current });
          revision.current = saved.revision!;
          lastSaved.current = JSON.stringify(appState);
          setSyncStatus('Saved.');
          flushPersistedAnalytics(analyticsForThisSave);
        } catch (error) {
          pendingAnalytics.current = [...analyticsForThisSave, ...pendingAnalytics.current];
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

  useEffect(() => {
    track('tab_viewed', { tab: activeTab });
  }, [activeTab, track]);

  const handleTabChange = (tab: ActiveTab) => {
    setActiveTab(tab);
  };

  const handleUpdateActiveWorkout = (updated: Workout) => {
    setActiveWorkout(updated);
  };

  const handleFinishWorkout = (completedWorkout: Workout) => {
    const finished = { ...completedWorkout, isCompleted: true };
    queueAnalyticsAfterPersistence('workout_completed', {
      workout_id: finished.id,
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
        workout_id: activeWorkout.id,
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
      queueAnalyticsAfterPersistence('workout_deleted', {
        workout_id: workout.id,
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
      workout_id: newActive.id,
      source_workout_id: workout.id,
      exercise_count: workout.exercises.length,
      completed_set_count: calculateCompletedSets(workout),
    });
    track('workout_started', {
      workout_id: newActive.id,
      source_workout_id: workout.id,
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
      workout_id: newActive.id,
      scheduled_session_id: scheduledSession?.id,
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
      workout_id: newActive.id,
      scheduled_session_id: scheduledSession?.id,
      has_notes: Boolean(scheduledSession?.notes?.trim()),
    });
    track('workout_started', {
      workout_id: newActive.id,
      scheduled_session_id: scheduledSession?.id,
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

  // Bumstead edits go through the same state as manual edits, so the normal autosave persists them.
  const applyBumsteadEdit: ApplyBumsteadEdit = (name, input) => {
    if (!isPersistenceReady) throw new Error('Your workouts are still loading. Try again in a moment.');
    const findWorkout = (workoutId: string) => {
      const workout = workouts.find((w) => w.id === workoutId);
      if (!workout) throw new Error('That workout no longer exists.');
      return workout;
    };
    const validDate = (value: string) => {
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) throw new Error(`"${value}" is not a valid date.`);
      return date;
    };
    if (name === 'scheduleSession') {
      const { title, scheduledDate, notes } = input as EditToolInput<'scheduleSession'>;
      const date = validDate(scheduledDate);
      const session = { id: `session-${Date.now()}`, title, scheduledDate: date.toISOString(), notes: notes || '' };
      handleSaveScheduledSession(session);
      queueAnalyticsAfterPersistence('bumstead_edit_applied', { tool: name, scheduled_session_id: session.id });
      return `Scheduled "${title}" for ${date.toLocaleString()}.`;
    }
    if (name === 'renameWorkout') {
      const { workoutId, title } = input as EditToolInput<'renameWorkout'>;
      const workout = findWorkout(workoutId);
      handleUpdateWorkoutTitle(workoutId, title);
      queueAnalyticsAfterPersistence('bumstead_edit_applied', { tool: name, workout_id: workout.id });
      return `Renamed "${workout.title}" to "${title}".`;
    }
    if (name === 'moveWorkoutDate') {
      const { workoutId, date } = input as EditToolInput<'moveWorkoutDate'>;
      const workout = findWorkout(workoutId);
      const moved = validDate(date);
      handleUpdateWorkoutDate(workoutId, moved.toISOString());
      queueAnalyticsAfterPersistence('bumstead_edit_applied', { tool: name, workout_id: workout.id });
      return `Moved "${workout.title}" to ${moved.toLocaleDateString()}.`;
    }
    const { exerciseName, category, sets } = input as EditToolInput<'addExerciseToActiveWorkout'>;
    const stamp = Date.now();
    const base: Workout = activeWorkout || {
      id: `w-${stamp}`,
      title: 'Full Body Movement',
      date: new Date().toISOString(),
      durationMinutes: 0,
      unit: sets[0].weightUnit,
      clientName: profile.clientName,
      ptName: profile.ptName,
      ptNotes: '',
      isCompleted: false,
      exercises: [],
    };
    setActiveWorkout({
      ...base,
      exercises: [...base.exercises, {
        id: `ex-${stamp}`,
        exerciseName,
        category,
        seatSettings: '',
        notes: '',
        sets: sets.map((set, index) => ({
          id: `s-${stamp}-${index}`,
          setNumber: index + 1,
          type: set.type,
          weight: set.weight,
          weightUnit: set.weightUnit,
          reps: set.reps,
          completed: false,
        })),
      }],
    });
    queueAnalyticsAfterPersistence('bumstead_edit_applied', { tool: name, workout_id: base.id });
    return `Added ${exerciseName} with ${sets.length} set${sets.length === 1 ? '' : 's'} to ${activeWorkout ? 'your workout' : 'a new workout'}.`;
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


  return (
    <div
      className={`workout-app-shell ${
        authState === 'ready' ? 'drive-connected' : 'drive-dead'
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

        <main className="flex-1 px-4 pt-3 pb-24 overflow-y-auto space-y-4">
          <p role="status" className="text-xs text-[#a39588]">{syncStatus}</p>
          {authState === 'signed-out' && (
            <div className="bg-[#181412] border border-[#382f29] rounded-3xl p-6 text-center space-y-4 shadow-xl">
              <h3 className="text-lg font-serif font-bold text-[#f7f3ee]">Sign in to continue</h3>
              <p className="text-xs text-[#a39588] font-light max-w-xs mx-auto">
                Sign in with Google to load your workouts and upload videos to your Drive.
              </p>
              <button
                onClick={handleSignIn}
                className="block w-full py-3.5 bg-gradient-to-r from-[#d97724] via-[#c86d51] to-[#e6a15c] text-[#0c0a09] font-syne font-bold text-xs rounded-2xl shadow-lg shadow-[#d97724]/20"
              >
                Sign in with Google
              </button>
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

          {/* Tab 5: Bumstead. Outside the fieldset so chat works while workouts load; edits check readiness themselves. */}
          {activeTab === 'bumstead' && authState === 'ready' && <BumsteadChat onApplyEdit={applyBumsteadEdit} />}
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
