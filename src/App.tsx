import React, { useState, useEffect } from 'react';
import { Workout, MachinePreset, WeightUnit, ActiveTab } from './types';
import {
  loadWorkouts,
  saveWorkouts,
  loadMachines,
  saveMachines,
  loadActiveWorkout,
  saveActiveWorkout,
  loadUserProfile,
  saveUserProfile,
  UserProfile
} from './utils/storage';
import { loadScheduledSession, saveScheduledSession, ScheduledSession } from './utils/calendar';
import { SAMPLE_WORKOUTS } from './data/sampleWorkouts';
import { DEFAULT_MACHINES } from './data/defaultMachines';
import { IOSHeader } from './components/IOSHeader';
import { IOSTabBar } from './components/IOSTabBar';
import { ActiveWorkout } from './components/ActiveWorkout';
import { WorkoutHistory } from './components/WorkoutHistory';
import { MachineLibrary } from './components/MachineLibrary';
import { AnalyticsView } from './components/AnalyticsView';
import { ExportPNGModal } from './components/ExportPNGModal';
import { ProfileModal } from './components/ProfileModal';
import { ScheduleCalendarModal } from './components/ScheduleCalendarModal';
import { NextSessionBanner } from './components/NextSessionBanner';
import { PTSummaryCard } from './components/PTSummaryCard';
import { Compass, Share2, Plus, Sparkles, Feather, Calendar } from 'lucide-react';

export default function App() {
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [machines, setMachines] = useState<MachinePreset[]>([]);
  const [activeWorkout, setActiveWorkout] = useState<Workout | null>(null);
  const [profile, setProfile] = useState<UserProfile>(loadUserProfile());
  const [unit, setUnit] = useState<WeightUnit>('lbs');
  const [activeTab, setActiveTab] = useState<ActiveTab>('workout');
  const [scheduledSession, setScheduledSession] = useState<ScheduledSession | null>(loadScheduledSession());

  // Modals state
  const [exportModalWorkout, setExportModalWorkout] = useState<Workout | null>(null);
  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState<boolean>(false);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState<boolean>(false);

  // Initialize data from localStorage
  useEffect(() => {
    const loadedWorkouts = loadWorkouts();
    const loadedMachines = loadMachines();
    const loadedActive = loadActiveWorkout();
    const loadedProfile = loadUserProfile();

    setWorkouts(loadedWorkouts);
    setMachines(loadedMachines);
    setActiveWorkout(loadedActive);
    setProfile(loadedProfile);
    setUnit(loadedProfile.preferredUnit || 'lbs');
  }, []);

  // Save changes to storage
  const handleUpdateWorkouts = (newWorkouts: Workout[]) => {
    setWorkouts(newWorkouts);
    saveWorkouts(newWorkouts);
  };

  const handleUpdateWorkoutTitle = (workoutId: string, newTitle: string) => {
    const updated = workouts.map((w) => (w.id === workoutId ? { ...w, title: newTitle } : w));
    handleUpdateWorkouts(updated);
    if (activeWorkout && activeWorkout.id === workoutId) {
      handleUpdateActiveWorkout({ ...activeWorkout, title: newTitle });
    }
  };

  const handleUpdateWorkoutDate = (workoutId: string, newDateIso: string) => {
    const updated = workouts.map((w) => (w.id === workoutId ? { ...w, date: newDateIso } : w));
    handleUpdateWorkouts(updated);
    if (activeWorkout && activeWorkout.id === workoutId) {
      handleUpdateActiveWorkout({ ...activeWorkout, date: newDateIso });
    }
  };

  const handleUpdateMachines = (newMachines: MachinePreset[]) => {
    setMachines(newMachines);
    saveMachines(newMachines);
  };

  const handleUpdateActiveWorkout = (updated: Workout | null) => {
    setActiveWorkout(updated);
    saveActiveWorkout(updated);
  };

  const handleUnitToggle = () => {
    const nextUnit = unit === 'lbs' ? 'kg' : 'lbs';
    setUnit(nextUnit);
    const updatedProfile = { ...profile, preferredUnit: nextUnit };
    setProfile(updatedProfile);
    saveUserProfile(updatedProfile);
  };

  // Start new empty workout
  const handleStartNewWorkout = () => {
    const newWorkout: Workout = {
      id: 'w-' + Date.now(),
      title: 'Leg Day & Quad Focus',
      date: new Date().toISOString(),
      durationMinutes: 0,
      unit: unit,
      clientName: profile.clientName,
      ptName: profile.ptName,
      exercises: [
        {
          id: 'ex-init-1',
          machineName: 'Leg Press Machine',
          category: 'Quads',
          seatSettings: 'Seat Angle: 3, Notch: 2',
          sets: [
            { id: 's1', setNumber: 1, type: 'warmup', weight: 140, reps: 15, completed: false },
            { id: 's2', setNumber: 2, type: 'working', weight: 220, reps: 10, completed: false },
            { id: 's3', setNumber: 3, type: 'working', weight: 240, reps: 10, completed: false }
          ],
          muscleFeeling: {
            targetMuscles: ['Quads'],
            sorenessLevel: 'none',
            pumpQuality: 4,
            jointComfort: 'great',
            notes: 'Felt strong quad contraction with zero joint tension.',
            quickTags: ['👁️ Mind-Muscle Connection', '🛡️ Knee Protection']
          }
        }
      ],
      isCompleted: false
    };

    handleUpdateActiveWorkout(newWorkout);
    setActiveTab('workout');
  };

  // Repeat a past workout
  const handleRepeatWorkout = (workoutToRepeat: Workout) => {
    const cloned: Workout = {
      ...workoutToRepeat,
      id: 'w-' + Date.now(),
      date: new Date().toISOString(),
      durationMinutes: 0,
      isCompleted: false,
      exercises: workoutToRepeat.exercises.map((ex) => ({
        ...ex,
        id: 'ex-' + Date.now() + Math.random().toString(36).substr(2, 4),
        sets: ex.sets.map((s) => ({
          ...s,
          id: 's-' + Date.now() + Math.random().toString(36).substr(2, 4),
          completed: false
        }))
      }))
    };

    handleUpdateActiveWorkout(cloned);
    setActiveTab('workout');
  };

  const handleFinishActiveWorkout = (finished: Workout) => {
    const updatedWorkouts = [finished, ...workouts.filter((w) => w.id !== finished.id)];
    handleUpdateWorkouts(updatedWorkouts);
    handleUpdateActiveWorkout(null);
  };

  const handleDeleteWorkout = (workoutId: string) => {
    if (window.confirm('Delete this session log?')) {
      const updated = workouts.filter((w) => w.id !== workoutId);
      handleUpdateWorkouts(updated);
    }
  };

  const handleOpenExportModal = (workout: Workout) => {
    setExportModalWorkout(workout);
    setIsExportModalOpen(true);
  };

  const handleResetData = () => {
    localStorage.removeItem('ios_workout_tracker_workouts_v1');
    localStorage.removeItem('ios_workout_tracker_machines_v1');
    localStorage.removeItem('ios_workout_tracker_active_session_v1');

    setWorkouts(SAMPLE_WORKOUTS);
    setMachines(DEFAULT_MACHINES);
    setActiveWorkout(null);
    saveWorkouts(SAMPLE_WORKOUTS);
    saveMachines(DEFAULT_MACHINES);
  };

  // Select machine from Library to create or add to workout
  const handleSelectMachineToLog = (machine: MachinePreset) => {
    if (activeWorkout) {
      const newEx = {
        id: 'ex-' + Date.now(),
        machineName: machine.name,
        category: machine.category,
        seatSettings: machine.defaultSeatSettings || '',
        sets: [
          { id: 's1', setNumber: 1, type: 'working' as const, weight: 100, reps: 10, completed: false }
        ],
        muscleFeeling: {
          targetMuscles: [machine.category],
          sorenessLevel: 'none' as const,
          pumpQuality: 4,
          jointComfort: 'great' as const,
          notes: '',
          quickTags: []
        }
      };
      handleUpdateActiveWorkout({
        ...activeWorkout,
        exercises: [...activeWorkout.exercises, newEx]
      });
      setActiveTab('workout');
    } else {
      // Start new workout with this machine
      const newWorkout: Workout = {
        id: 'w-' + Date.now(),
        title: `${machine.category} Workout`,
        date: new Date().toISOString(),
        durationMinutes: 0,
        unit: unit,
        clientName: profile.clientName,
        ptName: profile.ptName,
        exercises: [
          {
            id: 'ex-1',
            machineName: machine.name,
            category: machine.category,
            seatSettings: machine.defaultSeatSettings || '',
            sets: [
              { id: 's1', setNumber: 1, type: 'warmup', weight: 80, reps: 12, completed: false },
              { id: 's2', setNumber: 2, type: 'working', weight: 120, reps: 10, completed: false }
            ],
            muscleFeeling: {
              targetMuscles: [machine.category],
              sorenessLevel: 'none',
              pumpQuality: 4,
              jointComfort: 'great',
              notes: '',
              quickTags: []
            }
          }
        ],
        isCompleted: false
      };
      handleUpdateActiveWorkout(newWorkout);
      setActiveTab('workout');
    }
  };

  // Workout to display in PT Export tab preview
  const workoutForPtTab = activeWorkout || workouts.find((w) => w.isCompleted) || SAMPLE_WORKOUTS[0];

  return (
    <div className="min-h-screen bg-[#0c0a09] text-[#f7f3ee] font-sans antialiased selection:bg-[#d97724] selection:text-[#0c0a09] flex justify-center">
      {/* Mobile-centric iOS viewport frame */}
      <div className="w-full max-w-md bg-[#0c0a09] min-h-screen relative flex flex-col border-x border-[#231b16] shadow-2xl">
        {/* iOS Glass Top Header */}
        <IOSHeader
          title={profile.appTitle || 'Workout Studio'}
          isTimerRunning={!!activeWorkout}
          timerSeconds={activeWorkout ? activeWorkout.durationMinutes * 60 : 0}
          unit={unit}
          onUnitToggle={handleUnitToggle}
          clientName={profile.clientName}
          ptName={profile.ptName}
          onOpenProfileModal={() => setIsProfileModalOpen(true)}
        />

        {/* Tab Content Container */}
        <main className="flex-1 p-4 overflow-y-auto">
          {activeTab === 'workout' && (
            <>
              {activeWorkout ? (
                <ActiveWorkout
                  workout={activeWorkout}
                  unit={unit}
                  machines={machines}
                  onUpdateWorkout={handleUpdateActiveWorkout}
                  onFinishWorkout={handleFinishActiveWorkout}
                  onOpenExportModal={handleOpenExportModal}
                  onDiscardWorkout={() => handleUpdateActiveWorkout(null)}
                />
              ) : (
                /* No Active Session Dashboard view */
                <div className="space-y-5 py-4 pb-28">
                  {/* Scheduled Next Session Banner */}
                  <NextSessionBanner
                    scheduledSession={scheduledSession}
                    onOpenScheduleModal={() => setIsScheduleModalOpen(true)}
                    onClearSession={() => {
                      saveScheduledSession(null);
                      setScheduledSession(null);
                    }}
                    onStartSessionNow={handleStartNewWorkout}
                  />

                  {/* Hero Start Workout Card */}
                  <div className="bg-gradient-to-br from-[#231b16] via-[#181412] to-[#100d0b] border border-[#382f29] rounded-3xl p-5 shadow-2xl space-y-4 relative overflow-hidden">
                    <div className="absolute -top-12 -right-12 w-32 h-32 bg-[#d97724]/10 rounded-full blur-2xl pointer-events-none" />

                    <div className="flex items-center gap-3">
                      <div className="p-3 rounded-2xl bg-[#d97724] text-[#0c0a09] shadow-lg shadow-[#d97724]/20">
                        <Compass className="w-6 h-6" />
                      </div>
                      <div>
                        <span className="text-[10px] font-syne font-bold uppercase text-[#e6a15c] tracking-wider block">
                          Ready for Training
                        </span>
                        <h2 className="text-lg font-serif font-bold text-[#f7f3ee]">Begin New Workout</h2>
                      </div>
                    </div>

                    <p className="text-xs text-[#a39588] font-light leading-relaxed">
                      Log machine seat height, weights, reps, and muscle feel notes to export a warm, clean PNG report card for your Personal Trainer or Coach.
                    </p>

                    <button
                      onClick={handleStartNewWorkout}
                      className="w-full py-3.5 bg-gradient-to-r from-[#d97724] to-[#e6a15c] hover:opacity-95 text-[#0c0a09] font-syne font-extrabold text-xs rounded-2xl flex items-center justify-center gap-2 shadow-xl shadow-[#d97724]/20 transition-all scale-102"
                    >
                      <Plus className="w-4 h-4 text-[#0c0a09]" /> Begin Empty Workout
                    </button>
                  </div>

                  {/* Quick Preset Workouts Launchers */}
                  <div className="space-y-2">
                    <h3 className="text-xs font-syne font-bold text-[#a39588] uppercase tracking-wider px-1">
                      Preset Workout Routines
                    </h3>

                    <div className="grid grid-cols-1 gap-2">
                      {SAMPLE_WORKOUTS.map((sample) => (
                        <button
                          key={sample.id}
                          onClick={() => handleRepeatWorkout(sample)}
                          className="bg-[#181412]/90 hover:bg-[#211b18] border border-[#382f29] hover:border-[#d97724]/50 p-3.5 rounded-2xl text-left flex items-center justify-between transition-all group"
                        >
                          <div>
                            <span className="text-xs font-serif font-bold text-[#f7f3ee] group-hover:text-[#e6a15c] transition-colors block">
                              {sample.title}
                            </span>
                            <span className="text-[10px] text-[#8c7e72]">
                              {sample.exercises.length} Machines • Muscle Sensation Tracking
                            </span>
                          </div>
                          <span className="text-xs font-syne font-bold text-[#e6a15c] bg-[#d97724]/20 px-3 py-1 rounded-xl border border-[#d97724]/30 group-hover:bg-[#d97724] group-hover:text-[#0c0a09] transition-all">
                            Begin
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {activeTab === 'history' && (
            <WorkoutHistory
              workouts={workouts}
              unit={unit}
              onOpenExportModal={handleOpenExportModal}
              onRepeatWorkout={handleRepeatWorkout}
              onDeleteWorkout={handleDeleteWorkout}
              onStartNewWorkout={handleStartNewWorkout}
              onUpdateWorkoutTitle={handleUpdateWorkoutTitle}
              onUpdateWorkoutDate={handleUpdateWorkoutDate}
            />
          )}

          {activeTab === 'pt-export' && (
            <div className="space-y-4 pb-28">
              {/* Top Title */}
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-serif font-bold text-[#f7f3ee] flex items-center gap-2">
                    <Feather className="w-5 h-5 text-[#e6a15c]" /> PT Export Studio
                  </h2>
                  <p className="text-xs text-[#a39588] font-light">
                    Preview your workout card & export a high-res PNG for your Personal Trainer
                  </p>
                </div>

                <button
                  onClick={() => workoutForPtTab && handleOpenExportModal(workoutForPtTab)}
                  className="px-3.5 py-2 bg-gradient-to-r from-[#d97724] to-[#e6a15c] text-[#0c0a09] font-syne font-bold text-xs rounded-2xl shadow-lg shadow-[#d97724]/20 flex items-center gap-1 transition-all"
                >
                  <Sparkles className="w-3.5 h-3.5" /> Export PNG
                </button>
              </div>

              {/* Card Preview */}
              {workoutForPtTab ? (
                <div className="bg-[#100d0b] p-2.5 rounded-3xl border border-[#382f29] shadow-2xl">
                  <PTSummaryCard workout={workoutForPtTab} unit={unit} />
                </div>
              ) : (
                <div className="text-center py-10 text-[#8c7e72] text-xs font-serif italic">
                  No session logs available to export yet.
                </div>
              )}
            </div>
          )}

          {activeTab === 'machines' && (
            <MachineLibrary
              machines={machines}
              onUpdateMachines={handleUpdateMachines}
              onSelectMachineToLog={handleSelectMachineToLog}
            />
          )}

          {activeTab === 'analytics' && (
            <AnalyticsView workouts={workouts} unit={unit} />
          )}
        </main>

        {/* iOS Bottom Glass Dock Navigation */}
        <IOSTabBar
          activeTab={activeTab}
          onTabChange={setActiveTab}
          hasActiveWorkout={!!activeWorkout}
        />

        {/* PNG Export Modal */}
        {exportModalWorkout && (
          <ExportPNGModal
            workout={exportModalWorkout}
            unit={unit}
            isOpen={isExportModalOpen}
            onClose={() => setIsExportModalOpen(false)}
          />
        )}

        {/* Profile / PT Config Modal */}
        <ProfileModal
          profile={profile}
          isOpen={isProfileModalOpen}
          onClose={() => setIsProfileModalOpen(false)}
          onSaveProfile={(updatedProfile) => {
            setProfile(updatedProfile);
            saveUserProfile(updatedProfile);
            setUnit(updatedProfile.preferredUnit);
          }}
          onResetData={handleResetData}
        />

        {/* Schedule Next Session Device Calendar Modal */}
        <ScheduleCalendarModal
          isOpen={isScheduleModalOpen}
          onClose={() => setIsScheduleModalOpen(false)}
          onSessionSaved={(session) => setScheduledSession(session)}
        />
      </div>
    </div>
  );
}

