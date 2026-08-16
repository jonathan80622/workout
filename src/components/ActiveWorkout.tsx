'use client';

import React, { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { Plus, Play, Pause, CheckCircle2, Share2, Trash2, Compass, Clock, Settings, Sparkles, Feather, Flame, Calendar } from 'lucide-react';
import { Workout, ExerciseLog, WorkoutSet, MachinePreset, WeightUnit, MuscleGroup } from '../types';
import { SetRow } from './SetRow';
import { MuscleFeelInput } from './MuscleFeelInput';
import { WorkoutVideoRecorder } from './WorkoutVideoRecorder';
import { calculateWorkoutVolume, calculateCompletedSets, calculateTotalDistance, calculateTotalRunningTime, calculateAveragePace } from '../utils/formatters';

interface ActiveWorkoutProps {
  workout: Workout;
  unit: WeightUnit;
  machines: MachinePreset[];
  onUpdateWorkout: (updated: Workout) => void;
  onFinishWorkout: (completedWorkout: Workout) => void;
  onOpenExportModal: (workout: Workout) => void;
  onDiscardWorkout: () => void;
  driveAccessToken: string | null;
  videos: import('../types').WorkoutVideo[];
  onVideoUploaded: (video: import('../types').WorkoutVideo) => void;
}

export const ActiveWorkout: React.FC<ActiveWorkoutProps> = ({
  workout,
  unit,
  machines,
  onUpdateWorkout,
  onFinishWorkout,
  onOpenExportModal,
  onDiscardWorkout,
  driveAccessToken,
  videos,
  onVideoUploaded
}) => {
  const [isTimerRunning, setIsTimerRunning] = useState<boolean>(true);
  const [timerSeconds, setTimerSeconds] = useState<number>(workout.durationMinutes ? workout.durationMinutes * 60 : 0);
  const [isAddMachineModalOpen, setIsAddMachineModalOpen] = useState<boolean>(false);
  const [customMachineName, setCustomMachineName] = useState<string>('');
  const [customCategory, setCustomCategory] = useState<MuscleGroup>('Quads');

  // Live timer effect
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isTimerRunning) {
      interval = setInterval(() => {
        setTimerSeconds((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isTimerRunning]);

  const workoutRef = useRef(workout);
  workoutRef.current = workout;

  // Sync duration in minutes to workout when timer updates
  useEffect(() => {
    const minutes = Math.ceil(timerSeconds / 60);
    if (minutes !== workoutRef.current.durationMinutes) {
      onUpdateWorkout({ ...workoutRef.current, durationMinutes: minutes });
    }
  }, [timerSeconds, onUpdateWorkout]);

  const totalVolume = calculateWorkoutVolume(workout);
  const totalSets = calculateCompletedSets(workout);
  const totalDistance = calculateTotalDistance(workout);
  const totalRunningTime = calculateTotalRunningTime(workout);
  const avgPace = calculateAveragePace(totalDistance, totalRunningTime);

  const handleTitleChange = (newTitle: string) => {
    onUpdateWorkout({ ...workout, title: newTitle });
  };

  const handlePtNoteChange = (note: string) => {
    onUpdateWorkout({ ...workout, ptNotes: note });
  };

  const handleAddExerciseFromPreset = (preset: MachinePreset) => {
    const newExercise: ExerciseLog = {
      id: 'ex-' + Date.now() + Math.random().toString(36).substr(2, 4),
      machineName: preset.name,
      category: preset.category,
      seatSettings: preset.defaultSeatSettings || '',
      sets: [
        { id: 's-' + Date.now() + '-1', setNumber: 1, type: 'warmup', weight: 80, reps: 12, completed: false },
        { id: 's-' + Date.now() + '-2', setNumber: 2, type: 'working', weight: 120, reps: 10, completed: false },
        { id: 's-' + Date.now() + '-3', setNumber: 3, type: 'working', weight: 140, reps: 10, completed: false }
      ],
      muscleFeeling: {
        targetMuscles: [preset.category],
        sorenessLevel: 'none',
        pumpQuality: 4,
        jointComfort: 'great',
        notes: '',
        quickTags: ['👁️ Mind-Muscle Connection']
      }
    };

    onUpdateWorkout({
      ...workout,
      exercises: [...workout.exercises, newExercise]
    });
    setIsAddMachineModalOpen(false);
  };

  const handleAddCustomExercise = () => {
    if (!customMachineName.trim()) return;

    const newExercise: ExerciseLog = {
      id: 'ex-' + Date.now() + Math.random().toString(36).substr(2, 4),
      machineName: customMachineName.trim(),
      category: customCategory,
      seatSettings: '',
      sets: [
        { id: 's-' + Date.now() + '-1', setNumber: 1, type: 'working', weight: 100, reps: 10, completed: false }
      ],
      muscleFeeling: {
        targetMuscles: [customCategory],
        sorenessLevel: 'none',
        pumpQuality: 3,
        jointComfort: 'great',
        notes: '',
        quickTags: []
      }
    };

    onUpdateWorkout({
      ...workout,
      exercises: [...workout.exercises, newExercise]
    });
    setCustomMachineName('');
    setIsAddMachineModalOpen(false);
  };

  const handleRemoveExercise = (exId: string) => {
    onUpdateWorkout({
      ...workout,
      exercises: workout.exercises.filter((ex) => ex.id !== exId)
    });
  };

  const handleUpdateExercise = (updatedEx: ExerciseLog) => {
    onUpdateWorkout({
      ...workout,
      exercises: workout.exercises.map((ex) => (ex.id === updatedEx.id ? updatedEx : ex))
    });
  };

  const handleAddSetToExercise = (exId: string) => {
    const exercise = workout.exercises.find((ex) => ex.id === exId);
    if (!exercise) return;

    const lastSet = exercise.sets[exercise.sets.length - 1];
    const newSet: WorkoutSet = {
      id: 's-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
      setNumber: exercise.sets.length + 1,
      type: 'working',
      weight: lastSet ? lastSet.weight : 100,
      reps: lastSet ? lastSet.reps : 10,
      completed: false
    };

    const updated = {
      ...exercise,
      sets: [...exercise.sets, newSet]
    };
    handleUpdateExercise(updated);
  };

  const handleFinishSession = () => {
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#d97724', '#e6a15c', '#849a88', '#f7f3ee']
    });

    const finished: Workout = {
      ...workout,
      isCompleted: true,
      durationMinutes: Math.max(1, Math.ceil(timerSeconds / 60))
    };

    onFinishWorkout(finished);
    onOpenExportModal(finished);
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="space-y-4 pb-28">
      {/* Session Header Card */}
      <div className="bg-[#181412]/90 border border-[#382f29] rounded-3xl p-4 shadow-2xl space-y-3 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-36 h-36 bg-[#d97724]/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex items-center justify-between">
          <input
            type="text"
            value={workout.title}
            onChange={(e) => handleTitleChange(e.target.value)}
            placeholder="Workout Name (e.g. Leg Day & Quad Focus)"
            className="bg-transparent text-lg font-serif font-semibold text-[#f7f3ee] outline-none focus:border-b focus:border-[#d97724] w-full pr-2 placeholder-[#6b5e54]"
          />

          {/* Timer Toggle */}
          <button
            onClick={() => setIsTimerRunning(!isTimerRunning)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-mono font-bold transition-all border shrink-0 ${
              isTimerRunning
                ? 'bg-[#d97724]/20 text-[#f5c999] border-[#d97724]/40'
                : 'bg-[#211b18] text-[#8c7e72] border-[#382f29]'
            }`}
          >
            <Clock className="w-3.5 h-3.5 text-[#e6a15c]" />
            <span>{formatTime(timerSeconds)}</span>
            {isTimerRunning ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
          </button>
        </div>

        {/* Live Metrics Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
          <div className="bg-[#100d0b] p-2.5 rounded-2xl border border-[#2b241f] flex items-center justify-between">
            <span className="text-[#a39588] font-syne text-[11px]">Total Volume</span>
            <span className="font-bold text-[#e6a15c] text-sm">
              {totalVolume.toLocaleString()} {unit}
            </span>
          </div>
          <div className="bg-[#100d0b] p-2.5 rounded-2xl border border-[#2b241f] flex items-center justify-between">
            <span className="text-[#a39588] font-syne text-[11px]">Completed Sets</span>
            <span className="font-bold text-[#849a88] text-sm">{totalSets} sets</span>
          </div>
          <div className="bg-[#100d0b] p-2.5 rounded-2xl border border-[#2b241f] flex items-center justify-between">
            <span className="text-[#a39588] font-syne text-[11px]">Run Distance</span>
            <span className="font-bold text-[#d97724] text-sm">{totalDistance > 0 ? `${totalDistance} mi` : '0.0 mi'}</span>
          </div>
          <div className="bg-[#100d0b] p-2.5 rounded-2xl border border-[#2b241f] flex items-center justify-between">
            <span className="text-[#a39588] font-syne text-[11px]">Run Time / Pace</span>
            <span className="font-bold text-[#e6a15c] text-sm">
              {totalRunningTime > 0 ? `${totalRunningTime}m (${avgPace})` : '0m'}
            </span>
          </div>
        </div>

        {/* Workout Session Date Editor */}
        <div className="flex items-center justify-between gap-2 border-t border-[#2b241f] pt-2.5 text-xs">
          <div className="flex items-center gap-1.5 text-[#a39588]">
            <Calendar className="w-3.5 h-3.5 text-[#e6a15c]" />
            <span className="font-syne font-semibold">訓練日期 (Date):</span>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={workout.date ? workout.date.split('T')[0] : new Date().toISOString().split('T')[0]}
              onChange={(e) => {
                if (e.target.value) {
                  onUpdateWorkout({ ...workout, date: e.target.value + 'T12:00:00.000Z' });
                }
              }}
              className="bg-[#100d0b] border border-[#2b241f] rounded-xl px-2.5 py-1 text-xs text-[#f7f3ee] outline-none focus:ring-1 focus:ring-[#d97724]"
            />
            <button
              type="button"
              onClick={() => onUpdateWorkout({ ...workout, date: new Date().toISOString() })}
              className="px-2.5 py-1 bg-[#d97724]/20 hover:bg-[#d97724]/30 text-[#e6a15c] border border-[#d97724]/30 rounded-xl text-[11px] font-syne font-semibold transition-all"
            >
              設為今天
            </button>
          </div>
        </div>
      </div>

      <WorkoutVideoRecorder
        workout={workout}
        accessToken={driveAccessToken}
        videos={videos}
        onVideoUploaded={onVideoUploaded}
      />

      {/* Exercises List */}
      <div className="space-y-4">
        {workout.exercises.map((exercise, exIndex) => (
          <div
            key={exercise.id}
            className="bg-[#181412]/90 border border-[#382f29] rounded-3xl p-4 shadow-xl space-y-4"
          >
            {/* Machine Name & Seat Settings Header */}
            <div className="flex items-start justify-between border-b border-[#2b241f] pb-3">
              <div className="flex items-start gap-2.5">
                <span className="w-7 h-7 rounded-full bg-[#d97724]/20 text-[#e6a15c] border border-[#d97724]/30 font-mono font-bold text-xs flex items-center justify-center shrink-0">
                  {exIndex + 1}
                </span>
                <div className="flex-1">
                  <input
                    type="text"
                    value={exercise.machineName}
                    onChange={(e) =>
                      handleUpdateExercise({ ...exercise, machineName: e.target.value })
                    }
                    className="text-base font-serif font-bold text-[#f7f3ee] bg-transparent outline-none focus:border-b focus:border-[#d97724] w-full"
                    placeholder="Machine Name..."
                  />
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] font-syne font-semibold bg-[#211b18] text-[#c8b8a8] px-2.5 py-0.5 rounded-full border border-[#382f29]">
                      {exercise.category}
                    </span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => handleRemoveExercise(exercise.id)}
                className="p-1.5 rounded-lg text-[#6b5e54] hover:text-[#c86d51] hover:bg-[#c86d51]/10 transition-colors"
                title="Remove machine"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            {/* Alignment Adjustments Input */}
            <div className="bg-[#100d0b] border border-[#2b241f] p-2.5 rounded-2xl flex items-center gap-2 text-xs">
              <Settings className="w-4 h-4 text-[#8c7e72] shrink-0" />
              <input
                type="text"
                value={exercise.seatSettings || ''}
                onChange={(e) =>
                  handleUpdateExercise({ ...exercise, seatSettings: e.target.value })
                }
                placeholder="座椅角度、高度與卡槽刻度 (例：座椅角度 #3, 刻度 Notch #2 / Seat #4, Pin #6)"
                className="bg-transparent text-[#f7f3ee] placeholder-[#6b5e54] w-full outline-none"
              />
            </div>

            {/* Set Table Rows */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[11px] font-syne font-bold text-[#a39588] uppercase tracking-wider px-1">
                <span>Set Type</span>
                <span>Weight ({unit})</span>
                <span>Reps</span>
                <span>Done</span>
                <span className="w-6" />
              </div>

              {exercise.sets.map((set, sIdx) => (
                <SetRow
                  key={set.id}
                  set={set}
                  index={sIdx}
                  unit={unit}
                  isCardio={exercise.category === 'Cardio & Running'}
                  onUpdate={(updatedSet) => {
                    const newSets = exercise.sets.map((s) => (s.id === updatedSet.id ? updatedSet : s));
                    handleUpdateExercise({ ...exercise, sets: newSets });
                  }}
                  onDelete={() => {
                    const newSets = exercise.sets.filter((s) => s.id !== set.id);
                    handleUpdateExercise({ ...exercise, sets: newSets });
                  }}
                />
              ))}

              <button
                onClick={() => handleAddSetToExercise(exercise.id)}
                className="w-full py-2 bg-[#211b18] hover:bg-[#2e2622] text-[#e6a15c] border border-[#382f29] rounded-2xl text-xs font-syne font-semibold flex items-center justify-center gap-1.5 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Add Set
              </button>
            </div>

            {/* Muscle Feel Feedback Input per machine */}
            <MuscleFeelInput
              machineName={exercise.machineName}
              value={exercise.muscleFeeling}
              onChange={(updatedFeeling) =>
                handleUpdateExercise({ ...exercise, muscleFeeling: updatedFeeling })
              }
            />
          </div>
        ))}
      </div>

      {/* Add Machine Button */}
      <button
        onClick={() => setIsAddMachineModalOpen(true)}
        className="w-full py-3.5 bg-[#181412] hover:bg-[#211b18] border border-dashed border-[#d97724]/50 hover:border-[#d97724] text-[#f5c999] font-syne font-bold text-xs rounded-2xl flex items-center justify-center gap-2 shadow-lg transition-all"
      >
        <Plus className="w-4 h-4 text-[#e6a15c]" />
        Add Exercise Machine
      </button>

      {/* Direct Trainer Note Box */}
      <div className="bg-[#181412]/90 border border-[#382f29] rounded-3xl p-4 space-y-2">
        <label className="text-xs font-serif italic font-bold text-[#f7f3ee] flex items-center gap-1.5">
          <Feather className="w-4 h-4 text-[#e6a15c]" />
          Direct Note for Personal Trainer / Coach (Included in PNG)
        </label>
        <textarea
          rows={2}
          value={workout.ptNotes || ''}
          onChange={(e) => handlePtNoteChange(e.target.value)}
          placeholder="e.g. Coach Marcus, felt very strong today on the leg press! Slow eccentrics felt smooth."
          className="w-full bg-[#100d0b] border border-[#2b241f] rounded-xl p-3 text-xs text-[#f7f3ee] placeholder-[#6b5e54] focus:outline-none focus:ring-1 focus:ring-[#d97724] resize-none"
        />
      </div>

      {/* Primary Finish & Export Button Bar */}
      <div className="sticky bottom-20 z-30 pt-2">
        <div className="flex gap-2">
          <button
            onClick={handleFinishSession}
            className="flex-1 py-4 bg-gradient-to-r from-[#d97724] via-[#c86d51] to-[#e6a15c] hover:opacity-95 text-[#0c0a09] font-syne font-extrabold text-xs rounded-2xl flex items-center justify-center gap-2 shadow-2xl shadow-[#d97724]/20 transition-all scale-102"
          >
            <CheckCircle2 className="w-5 h-5 text-[#0c0a09]" />
            Complete Workout & Export to PT (PNG)
          </button>
          
          <button
            onClick={onDiscardWorkout}
            className="px-4 py-4 bg-[#181412] border border-[#382f29] hover:bg-[#211b18] text-[#8c7e72] hover:text-[#c86d51] rounded-2xl text-xs font-syne font-semibold transition-colors"
            title="Discard session"
          >
            Cancel
          </button>
        </div>
      </div>

      {/* Add Machine Modal Overlay */}
      {isAddMachineModalOpen && (
        <div className="fixed inset-0 z-50 bg-[#0c0a09]/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#181412] border border-[#382f29] rounded-3xl p-5 w-full max-w-md max-h-[85vh] overflow-y-auto space-y-4">
            <div className="flex items-center justify-between border-b border-[#2b241f] pb-3">
              <h3 className="text-base font-serif font-bold text-[#f7f3ee] flex items-center gap-2">
                <Compass className="w-5 h-5 text-[#e6a15c]" /> Select Exercise Machine
              </h3>
              <button
                onClick={() => setIsAddMachineModalOpen(false)}
                className="text-[#8c7e72] hover:text-[#f7f3ee]"
              >
                ✕
              </button>
            </div>

            {/* Quick Presets List */}
            <div>
              <span className="text-xs font-serif italic text-[#c8b8a8] block mb-2">Preset Exercise Machines</span>
              <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                {machines.map((machine) => (
                  <button
                    key={machine.id}
                    onClick={() => handleAddExerciseFromPreset(machine)}
                    className="w-full text-left p-2.5 rounded-2xl bg-[#100d0b] hover:bg-[#211b18] border border-[#2b241f] hover:border-[#d97724]/50 flex items-center justify-between transition-all"
                  >
                    <div>
                      <span className="text-xs font-bold text-[#f7f3ee] block">{machine.name}</span>
                      <span className="text-[10px] text-[#8c7e72]">{machine.category} • {machine.equipmentType}</span>
                    </div>
                    <Plus className="w-4 h-4 text-[#e6a15c]" />
                  </button>
                ))}
              </div>
            </div>

            {/* Add Custom Machine */}
            <div className="pt-3 border-t border-[#2b241f] space-y-2">
              <span className="text-xs font-serif italic text-[#c8b8a8] block">Or Type Custom Machine / Exercise</span>
              <input
                type="text"
                value={customMachineName}
                onChange={(e) => setCustomMachineName(e.target.value)}
                placeholder="e.g. Incline Iso-Lateral Chest Press"
                className="w-full bg-[#100d0b] border border-[#2b241f] rounded-xl p-2.5 text-xs text-[#f7f3ee] placeholder-[#6b5e54] outline-none focus:ring-1 focus:ring-[#d97724]"
              />

              <div className="flex gap-2">
                <select
                  value={customCategory}
                  onChange={(e) => setCustomCategory(e.target.value as MuscleGroup)}
                  className="bg-[#100d0b] border border-[#2b241f] text-[#f7f3ee] text-xs rounded-xl p-2.5 outline-none flex-1"
                >
                  <option value="Quads">Quads</option>
                  <option value="Chest">Chest</option>
                  <option value="Lats & Back">Lats & Back</option>
                  <option value="Hamstrings">Hamstrings</option>
                  <option value="Glutes">Glutes</option>
                  <option value="Shoulders">Shoulders</option>
                  <option value="Biceps">Biceps</option>
                  <option value="Triceps">Triceps</option>
                  <option value="Abs & Core">Abs & Core</option>
                  <option value="Calves">Calves</option>
                </select>

                <button
                  onClick={handleAddCustomExercise}
                  disabled={!customMachineName.trim()}
                  className="px-4 py-2.5 bg-[#d97724] hover:bg-[#e6a15c] disabled:opacity-50 text-[#0c0a09] text-xs font-bold rounded-xl"
                >
                  Add Custom
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
