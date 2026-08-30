'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Workout, MachinePreset, ActiveTab, WeightUnit, WorkoutAppState, TrainingPlan, WarmupCheckins } from '@/src/types';
import { UserProfile } from '@/src/utils/storage';
import { ScheduledSession } from '@/src/utils/calendar';
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
import { convertWeight } from '@/src/utils/formatters';

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

export function WorkoutTrackerApp({
  initialProfile,
  initialWorkouts,
  initialActiveWorkout,
  initialMachines,
  initialScheduledSession,
  initialTrainingPlan,
  initialWarmupCheckins,
  initialTab = 'workout',
}: WorkoutTrackerAppProps) {
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
    saveLocalState(appState);
  }, [appState]);

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

  const handleUpdateActiveWorkout = (updated: Workout) => {
    setActiveWorkout(updated);
  };

  const handleToggleActiveWorkoutUnit = () => {
    if (!activeWorkout) return;

    const nextUnit: WeightUnit = activeWorkout.unit === 'lbs' ? 'kg' : 'lbs';
    setActiveWorkout({
      ...activeWorkout,
      unit: nextUnit,
      exercises: activeWorkout.exercises.map((exercise) => ({
        ...exercise,
        sets: exercise.sets.map((set) => ({
          ...set,
          weight: convertWeight(set.weight, activeWorkout.unit, nextUnit),
        })),
      })),
    });
  };

  const handleFinishWorkout = (completedWorkout: Workout) => {
    const finished = { ...completedWorkout, isCompleted: true };
    setActiveWorkout(null);
    setWorkouts((prev) => [finished, ...prev]);
    setActiveTab('history');
  };

  const handleDiscardActiveWorkout = () => {
    setActiveWorkout(null);
  };

  const handleDeleteWorkout = (workoutId: string) => {
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
          reps: s.reps,
          completed: false,
          rpe: s.rpe,
        })),
        muscleFeeling: {
          targetMuscles: [ex.category],
          sorenessLevel: 'none',
          pumpQuality: 4,
          jointComfort: 'great',
          notes: '',
          quickTags: [],
        },
      })),
    };

    setActiveWorkout(newActive);
    setActiveTab('workout');
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
            weight: activeWorkout.unit === 'lbs' ? 100 : 45,
            reps: 10,
            completed: false,
          },
        ],
        muscleFeeling: {
          targetMuscles: [machine.category],
          sorenessLevel: 'none' as const,
          pumpQuality: 4,
          jointComfort: 'great' as const,
          notes: '',
          quickTags: [],
        },
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
                reps: 10,
                completed: false,
              },
            ],
            muscleFeeling: {
              targetMuscles: [machine.category],
              sorenessLevel: 'none' as const,
              pumpQuality: 4,
              jointComfort: 'great' as const,
              notes: '',
              quickTags: [],
            },
          },
        ],
      };
      setActiveWorkout(newWorkout);
    }
    setActiveTab('workout');
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
    } catch (error) {
      setSyncStatus(error instanceof Error ? error.message : 'Unable to connect Google Drive.');
    }
  };

  const handleDisconnectDrive = () => {
    disconnectGoogleDrive();
    setDriveConnection(getDriveConnection());
    setPortalUrl('');
    setSyncStatus('Drive disconnected. Changes stay in this browser.');
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
                  machines={machines}
                  onUpdateWorkout={handleUpdateActiveWorkout}
                  onToggleWorkoutUnit={handleToggleActiveWorkoutUnit}
                  onFinishWorkout={handleFinishWorkout}
                  onDiscardWorkout={handleDiscardActiveWorkout}
                  driveAccessToken={driveConnection.accessToken}
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
          onTabChange={setActiveTab}
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
        />
      </div>
    </div>
  );
}
