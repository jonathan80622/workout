'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Workout, MachinePreset, ActiveTab, WorkoutAppState, TrainingPlan, WarmupCheckins } from '@/src/types';
import { UserProfile } from '@/src/utils/storage';
import { ScheduledSession } from '@/src/utils/calendar';
import { AnalyticsProvider, useAnalytics } from '@/src/analytics/AnalyticsProvider';
import { IOSHeader } from './IOSHeader';
import { IOSTabBar } from './IOSTabBar';
import { ActiveWorkout } from './ActiveWorkout';
import { WorkoutHistory } from './WorkoutHistory';
import { MachineLibrary } from './MachineLibrary';
import { TrainingPlanView } from './TrainingPlanView';
import WeightTrackingPage from '@/app/weight-tracking/page';
import { ProfileModal } from './ProfileModal';
import { ScheduleCalendarModal } from './ScheduleCalendarModal';
import { NextSessionBanner } from './NextSessionBanner';
import {
  combineWorkouts,
  connectGoogleDrive,
  createDefaultAppState,
  disconnectGoogleDrive,
  DriveConnection,
  getDriveConnection,
  getDriveSyncTarget,
  loadStateFromDrive,
  readLocalState,
  saveLocalState,
  saveStateToDrive,
  splitWorkouts,
} from '@/src/utils/driveStorage';
import { isE2EMode, loadE2ESeed, saveE2EState } from '@/src/utils/e2eBridge';
import { calculateCompletedSets, calculateTotalDistance, calculateWorkoutVolume } from '@/src/utils/formatters';

interface WorkoutTrackerAppProps {
  initialProfile: UserProfile;
  initialWorkouts: Workout[];
  initialActiveWorkout: Workout | null;
  initialMachines: MachinePreset[];
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
  initialMachines,
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
  const [machines, setMachines] = useState<MachinePreset[]>(initialMachines);
  const [trainingPlan, setTrainingPlan] = useState<TrainingPlan>(initialTrainingPlan || createDefaultAppState().trainingPlan);
  const [warmupCheckins, setWarmupCheckins] = useState<WarmupCheckins>(initialWarmupCheckins || {});
  const [scheduledSession, setScheduledSession] = useState<ScheduledSession | null>(initialScheduledSession);
  const [driveConnection, setDriveConnection] = useState<DriveConnection>({
    isConfigured: false,
    isConnected: false,
    accessToken: null,
  });
  const [syncStatus, setSyncStatus] = useState<string>('Local starter data loaded.');
  const [portalUrl, setPortalUrl] = useState<string>('');
  // In e2e mode, state is mirrored to the test oracle only after the seed loads,
  // so the default starter state never overwrites it.
  const [isE2ESeeded, setIsE2ESeeded] = useState<boolean>(false);

  const [isProfileModalOpen, setIsProfileModalOpen] = useState<boolean>(false);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState<boolean>(false);

  const appState: WorkoutAppState = useMemo(
    () => ({
      version: 1,
      profile,
      machines,
      workouts: combineWorkouts(workouts, activeWorkout),
      trainingPlan,
      warmupCheckins,
      scheduledSession,
    }),
    [activeWorkout, machines, profile, scheduledSession, trainingPlan, warmupCheckins, workouts]
  );

  useEffect(() => {
    if (isE2EMode()) {
      loadE2ESeed()
        .then((state) => {
          applyLoadedState(state);
          setIsE2ESeeded(true);
          setSyncStatus('Loaded e2e seed.');
        })
        .catch((error) => setSyncStatus(error instanceof Error ? error.message : 'E2E seed failed.'));
      return;
    }

    const connection = getDriveConnection();
    setDriveConnection(connection);
    const localState = readLocalState();
    applyLoadedState(localState);
    setSyncStatus(connection.isConnected ? 'Drive token restored for this session.' : 'Saved locally until Drive is connected.');

    if (connection.accessToken) {
      loadStateFromDrive(connection.accessToken)
        .then((state) => {
          applyLoadedState(state);
          setSyncStatus('Loaded from Google Drive.');
        })
        .catch((error) => setSyncStatus(error instanceof Error ? error.message : 'Drive load failed.'));
      getDriveSyncTarget(connection.accessToken)
        .then((target) => setPortalUrl(target.portalUrl))
        .catch(() => undefined);
    }
  }, []);

  useEffect(() => {
    // Never let seeded e2e data overwrite a real browser's saved workouts.
    if (isE2EMode()) {
      if (isE2ESeeded) saveE2EState(appState).catch(() => undefined);
      return;
    }
    saveLocalState(appState);
  }, [appState, isE2ESeeded]);

  useEffect(() => {
    if (!driveConnection.accessToken) return;

    const timer = window.setTimeout(() => {
      saveStateToDrive(driveConnection.accessToken!, appState)
        .then(() => setSyncStatus('Synced to Google Drive.'))
        .catch((error) => setSyncStatus(error instanceof Error ? error.message : 'Drive sync failed.'));
    }, 900);

    return () => window.clearTimeout(timer);
  }, [appState, driveConnection.accessToken]);

  const applyLoadedState = (state: WorkoutAppState) => {
    const split = splitWorkouts(state.workouts);
    setProfile(state.profile);
    setWorkouts(split.completedWorkouts);
    setActiveWorkout(split.activeWorkout);
    setMachines(state.machines);
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
        machineName: ex.machineName,
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

  const handleSaveMachines = (updatedMachines: MachinePreset[]) => {
    setMachines(updatedMachines);
  };

  const handleSelectMachineToLog = (machine: MachinePreset) => {
    if (activeWorkout) {
      const newExercise = {
        id: `ex-${Date.now()}`,
        machineName: machine.name,
        category: machine.category,
        seatSettings: machine.defaultSeatSettings || '',
        sets: [
          {
            id: `s-${Date.now()}-1`,
            setNumber: 1,
            type: 'working' as const,
            weight: 100,
            weightUnit: 'lbs' as const,
            reps: 10,
            completed: false,
          },
        ],
      };
      const updated = {
        ...activeWorkout,
        exercises: [...activeWorkout.exercises, newExercise],
      };
      setActiveWorkout(updated);
    } else {
      const newWorkout: Workout = {
        id: `w-${Date.now()}`,
        title: `${machine.name} Session`,
        date: new Date().toISOString(),
        durationMinutes: 0,
        unit: 'lbs',
        clientName: profile.clientName,
        ptName: profile.ptName,
        ptNotes: '',
        isCompleted: false,
        exercises: [
          {
            id: `ex-${Date.now()}`,
            machineName: machine.name,
            category: machine.category,
            seatSettings: machine.defaultSeatSettings || '',
            sets: [
              {
                id: `s-${Date.now()}-1`,
                setNumber: 1,
                type: 'working' as const,
                weight: 100,
                weightUnit: 'lbs' as const,
                reps: 10,
                completed: false,
              },
            ],
          },
        ],
      };
      setActiveWorkout(newWorkout);
    }
    setActiveTab('workout');
    track('exercise_added', {
      source: 'machine_library',
      category: machine.category,
      exercise_count: activeWorkout ? activeWorkout.exercises.length + 1 : 1,
    });
    if (!activeWorkout) {
      track('workout_started', {
        source: 'machine_library',
        exercise_count: 1,
      });
    }
  };

  const handleResetData = () => {
    applyLoadedState(createDefaultAppState());
    setSyncStatus('Starter data restored.');
  };

  const handleConnectDrive = async () => {
    try {
      setSyncStatus('Opening Google authorization...');
      const connection = await connectGoogleDrive();
      setDriveConnection(connection);
      const loaded = await loadStateFromDrive(connection.accessToken!);
      applyLoadedState(loaded);
      const target = await getDriveSyncTarget(connection.accessToken!);
      setPortalUrl(target.portalUrl);
      setSyncStatus('Connected and loaded from Google Drive.');
      track('drive_connected', {});
    } catch (error) {
      setSyncStatus(error instanceof Error ? error.message : 'Unable to connect Google Drive.');
    }
  };

  const handleDisconnectDrive = () => {
    disconnectGoogleDrive();
    setDriveConnection(getDriveConnection());
    setPortalUrl('');
    setSyncStatus('Drive disconnected. Changes stay in this browser.');
    track('drive_disconnected', {});
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

  const isDriveConnected = driveConnection.isConnected && Boolean(driveConnection.accessToken);

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

        {!isDriveConnected && (
          <div className="border-b border-[#545454] bg-[#1a1a1a] px-4 py-2 text-center">
            <p className="font-syne text-[10px] font-bold uppercase tracking-wider text-[#c7c7c7]">
              Drive disconnected · local-only mode
            </p>
          </div>
        )}

        <main className="flex-1 px-4 pt-3 pb-24 overflow-y-auto space-y-4">
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
                  driveAccessToken={driveConnection.accessToken}
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
                      Start a workout from scratch, pick from machine library, or repeat a past training session.
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

          {/* Tab 5: Machines */}
          {activeTab === 'machines' && (
            <MachineLibrary
              machines={machines}
              onUpdateMachines={handleSaveMachines}
              onSelectMachineToLog={handleSelectMachineToLog}
            />
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
          onResetData={handleResetData}
          driveConnection={driveConnection}
          onConnectDrive={handleConnectDrive}
          onDisconnectDrive={handleDisconnectDrive}
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
