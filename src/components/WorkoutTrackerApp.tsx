'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Workout, MachinePreset, ActiveTab, WeightUnit, WorkoutAppState, WorkoutVideo } from '@/src/types';
import { UserProfile } from '@/src/utils/storage';
import { ScheduledSession } from '@/src/utils/calendar';
import { IOSHeader } from './IOSHeader';
import { IOSTabBar } from './IOSTabBar';
import { ActiveWorkout } from './ActiveWorkout';
import { WorkoutHistory } from './WorkoutHistory';
import { MachineLibrary } from './MachineLibrary';
import { AnalyticsView } from './AnalyticsView';
import { PTSummaryStudio } from './PTSummaryStudio';
import { ExportPNGModal } from './ExportPNGModal';
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

interface WorkoutTrackerAppProps {
  initialProfile: UserProfile;
  initialWorkouts: Workout[];
  initialActiveWorkout: Workout | null;
  initialMachines: MachinePreset[];
  initialScheduledSession: ScheduledSession | null;
  initialVideos: WorkoutVideo[];
}

export function WorkoutTrackerApp({
  initialProfile,
  initialWorkouts,
  initialActiveWorkout,
  initialMachines,
  initialScheduledSession,
  initialVideos,
}: WorkoutTrackerAppProps) {
  const [activeTab, setActiveTab] = useState<ActiveTab>('workout');
  const [profile, setProfile] = useState<UserProfile>(initialProfile);
  const [workouts, setWorkouts] = useState<Workout[]>(initialWorkouts);
  const [activeWorkout, setActiveWorkout] = useState<Workout | null>(initialActiveWorkout);
  const [machines, setMachines] = useState<MachinePreset[]>(initialMachines);
  const [scheduledSession, setScheduledSession] = useState<ScheduledSession | null>(initialScheduledSession);
  const [videos, setVideos] = useState<WorkoutVideo[]>(initialVideos);
  const [driveConnection, setDriveConnection] = useState<DriveConnection>({
    isConfigured: false,
    isConnected: false,
    accessToken: null,
  });
  const [syncStatus, setSyncStatus] = useState<string>('Local starter data loaded.');
  const [portalUrl, setPortalUrl] = useState<string>('');

  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);
  const [exportWorkout, setExportWorkout] = useState<Workout | null>(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState<boolean>(false);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState<boolean>(false);

  const unit: WeightUnit = profile.preferredUnit || 'lbs';
  const appState: WorkoutAppState = useMemo(
    () => ({
      version: 1,
      profile,
      machines,
      workouts: combineWorkouts(workouts, activeWorkout),
      scheduledSession,
      videos,
    }),
    [activeWorkout, machines, profile, scheduledSession, videos, workouts]
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
    setScheduledSession(state.scheduledSession);
    setVideos(state.videos);
  };

  const handleUnitToggle = () => {
    const nextUnit: 'lbs' | 'kg' = unit === 'lbs' ? 'kg' : 'lbs';
    const updated: UserProfile = { ...profile, preferredUnit: nextUnit };
    setProfile(updated);
  };

  const handleSaveProfile = (newProfile: UserProfile) => {
    setProfile(newProfile);
  };

  const handleUpdateActiveWorkout = (updated: Workout) => {
    setActiveWorkout(updated);
  };

  const handleFinishWorkout = (completedWorkout: Workout) => {
    const finished = { ...completedWorkout, isCompleted: true };
    setActiveWorkout(null);
    setWorkouts((prev) => [finished, ...prev]);
    setActiveTab('pt-export');
    setExportWorkout(finished);
  };

  const handleDiscardActiveWorkout = () => {
    setActiveWorkout(null);
  };

  const handleDeleteWorkout = (workoutId: string) => {
    setWorkouts((prev) => prev.filter((w) => w.id !== workoutId));
    setVideos((prev) => prev.filter((video) => video.workoutId !== workoutId));
  };

  const handleRepeatWorkout = (workout: Workout) => {
    const newActive: Workout = {
      id: `w-${Date.now()}`,
      title: workout.title,
      date: new Date().toISOString(),
      durationMinutes: 0,
      unit,
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

  const handleOpenExportForWorkout = (workout: Workout) => {
    setExportWorkout(workout);
    setIsExportModalOpen(true);
  };

  const handleStartNewWorkoutFromScratch = () => {
    const newActive: Workout = {
      id: `w-${Date.now()}`,
      title: 'Full Body Movement',
      date: new Date().toISOString(),
      durationMinutes: 0,
      unit,
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
      unit,
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
            weight: unit === 'lbs' ? 100 : 45,
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
        unit,
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
                weight: unit === 'lbs' ? 100 : 45,
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

  const handleVideoUploaded = (video: WorkoutVideo) => {
    setVideos((prev) => [video, ...prev]);
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

  const latestCompletedWorkout = workouts[0] || null;
  const targetPtExportWorkout = exportWorkout || latestCompletedWorkout;

  return (
    <div className="min-h-screen bg-[#0c0a09] text-[#f7f3ee] flex flex-col max-w-md mx-auto shadow-2xl relative border-x border-[#2b241f]">
      <IOSHeader
        title={profile.appTitle || 'Workout Studio'}
        isTimerRunning={!!activeWorkout}
        timerSeconds={0}
        unit={unit}
        onUnitToggle={handleUnitToggle}
        clientName={profile.clientName}
        ptName={profile.ptName}
        onOpenProfileModal={() => setIsProfileModalOpen(true)}
      />

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
                unit={unit}
                machines={machines}
                onUpdateWorkout={handleUpdateActiveWorkout}
                onFinishWorkout={handleFinishWorkout}
                onOpenExportModal={handleOpenExportForWorkout}
                onDiscardWorkout={handleDiscardActiveWorkout}
                driveAccessToken={driveConnection.accessToken}
                videos={videos.filter((video) => video.workoutId === activeWorkout.id)}
                onVideoUploaded={handleVideoUploaded}
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

        {/* Tab 2: History */}
        {activeTab === 'history' && (
          <WorkoutHistory
            workouts={workouts}
            unit={unit}
            onOpenExportModal={handleOpenExportForWorkout}
            onDeleteWorkout={handleDeleteWorkout}
            onRepeatWorkout={handleRepeatWorkout}
            onStartNewWorkout={handleStartNewWorkoutFromScratch}
            onUpdateWorkoutTitle={handleUpdateWorkoutTitle}
            onUpdateWorkoutDate={handleUpdateWorkoutDate}
          />
        )}

        {/* Tab 3: PT Export */}
        {activeTab === 'pt-export' && (
          <div className="space-y-3">
            {targetPtExportWorkout ? (
              <PTSummaryStudio workout={targetPtExportWorkout} unit={unit} />
            ) : (
              <div className="bg-[#181412] border border-[#382f29] rounded-3xl p-6 text-center text-xs text-[#a39588]">
                No completed workouts found. Finish a workout first to generate a PT report card!
              </div>
            )}
          </div>
        )}

        {/* Tab 4: Machines */}
        {activeTab === 'machines' && (
          <MachineLibrary
            machines={machines}
            onUpdateMachines={handleSaveMachines}
            onSelectMachineToLog={handleSelectMachineToLog}
          />
        )}

        {/* Tab 5: Analytics */}
        {activeTab === 'analytics' && (
          <AnalyticsView workouts={workouts} unit={unit} />
        )}
      </main>

      <IOSTabBar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        hasActiveWorkout={!!activeWorkout}
      />

      {/* Modals */}
      {exportWorkout && (
        <ExportPNGModal
          workout={exportWorkout}
          unit={unit}
          isOpen={isExportModalOpen}
          onClose={() => setIsExportModalOpen(false)}
        />
      )}

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
  );
}
