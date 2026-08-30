'use client';

import React, { useState } from 'react';
import { Calendar, Search, Trash2, Repeat, Compass, Activity, Edit2, Check } from 'lucide-react';
import { Workout, WeightUnit } from '../types';
import { calculateWorkoutVolume, calculateCompletedSets, formatWorkoutDate, calculateTotalDistance } from '../utils/formatters';

interface WorkoutHistoryProps {
  workouts: Workout[];
  unit: WeightUnit;
  onRepeatWorkout: (workout: Workout) => void;
  onDeleteWorkout: (workoutId: string) => void;
  onStartNewWorkout: () => void;
  onUpdateWorkoutTitle?: (workoutId: string, newTitle: string) => void;
  onUpdateWorkoutDate?: (workoutId: string, newDateIso: string) => void;
}

export const WorkoutHistory: React.FC<WorkoutHistoryProps> = ({
  workouts,
  unit,
  onRepeatWorkout,
  onDeleteWorkout,
  onStartNewWorkout,
  onUpdateWorkoutTitle,
  onUpdateWorkoutDate
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitleText, setEditTitleText] = useState<string>('');

  const completedWorkouts = workouts
    .filter((w) => w.isCompleted)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const filteredWorkouts = completedWorkouts.filter((w) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    const matchesTitle = w.title.toLowerCase().includes(query);
    const matchesMachine = w.exercises.some((e) =>
      e.machineName.toLowerCase().includes(query)
    );
    const matchesNotes = w.exercises.some((e) =>
      e.muscleFeeling?.notes?.toLowerCase().includes(query)
    );
    return matchesTitle || matchesMachine || matchesNotes;
  });

  const handleStartEditing = (workout: Workout) => {
    setEditingId(workout.id);
    setEditTitleText(workout.title);
  };

  const handleSaveTitle = (workoutId: string) => {
    if (editTitleText.trim() && onUpdateWorkoutTitle) {
      onUpdateWorkoutTitle(workoutId, editTitleText.trim());
    }
    setEditingId(null);
  };

  return (
    <div className="space-y-4 pb-28">
      {/* Header Banner */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-serif font-bold text-[#f7f3ee]">Workout History</h2>
          <p className="text-xs text-[#a39588] font-light">
            Review completed sessions and repeat past training plans.
          </p>
        </div>

        <button
          onClick={onStartNewWorkout}
          className="px-3.5 py-2 bg-gradient-to-r from-[#d97724] to-[#e6a15c] text-[#0c0a09] font-syne font-bold text-xs rounded-2xl shadow-lg shadow-[#d97724]/20 transition-all flex items-center gap-1"
        >
          + New Workout
        </button>
      </div>

      {/* Search Input Bar */}
      <div className="relative">
        <Search className="w-4 h-4 text-[#8c7e72] absolute left-3.5 top-3" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by title, machine name, or muscle note..."
          className="w-full bg-[#181412] border border-[#382f29] rounded-2xl pl-10 pr-4 py-2.5 text-xs text-[#f7f3ee] placeholder-[#6b5e54] focus:outline-none focus:ring-1 focus:ring-[#d97724]"
        />
      </div>

      {/* History Cards List */}
      {filteredWorkouts.length === 0 ? (
        <div className="bg-[#181412]/60 border border-[#382f29] rounded-3xl p-8 text-center space-y-3">
          <Compass className="w-10 h-10 text-[#6b5e54] mx-auto" />
          <h3 className="text-sm font-serif font-semibold text-[#f7f3ee]">No workout logs found</h3>
          <p className="text-xs text-[#a39588] font-light max-w-xs mx-auto">
            {searchQuery
              ? 'No workout matching your search query.'
              : 'You have not completed any workouts yet. Begin a session now!'}
          </p>
          <button
            onClick={onStartNewWorkout}
            className="px-4 py-2 bg-[#d97724] text-[#0c0a09] font-syne font-bold text-xs rounded-xl"
          >
            Start Session Now
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredWorkouts.map((workout) => {
            const volume = calculateWorkoutVolume(workout);
            const sets = calculateCompletedSets(workout);

            return (
              <div
                key={workout.id}
                className="bg-[#181412]/90 border border-[#382f29] hover:border-[#4a3f36] rounded-3xl p-4 shadow-xl space-y-3 transition-all"
              >
                {/* Top Row: Title, Date & Action Buttons */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap text-[10px] font-syne font-semibold text-[#e6a15c] uppercase tracking-wider mb-1">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" /> {formatWorkoutDate(workout.date)}
                      </span>
                      {onUpdateWorkoutDate && (
                        <div className="flex items-center gap-1 lowercase font-normal">
                          <input
                            type="date"
                            value={workout.date ? workout.date.split('T')[0] : new Date().toISOString().split('T')[0]}
                            onChange={(e) => {
                              if (e.target.value) {
                                onUpdateWorkoutDate(workout.id, e.target.value + 'T12:00:00.000Z');
                              }
                            }}
                            className="bg-[#100d0b] border border-[#382f29] rounded-lg px-2 py-0.5 text-[11px] text-[#f7f3ee] outline-none focus:ring-1 focus:ring-[#d97724] font-mono"
                          />
                          <button
                            type="button"
                            onClick={() => onUpdateWorkoutDate(workout.id, new Date().toISOString())}
                            className="px-1.5 py-0.5 bg-[#d97724]/20 hover:bg-[#d97724]/40 text-[#f5c999] border border-[#d97724]/30 rounded-lg text-[10px] font-syne font-bold capitalize"
                            title="Set date to today"
                          >
                            Set Today
                          </button>
                        </div>
                      )}
                    </div>

                    {editingId === workout.id ? (
                      <div className="flex items-center gap-1.5 mt-1 bg-[#100d0b] border border-[#d97724] rounded-xl px-2.5 py-1">
                        <input
                          type="text"
                          value={editTitleText}
                          onChange={(e) => setEditTitleText(e.target.value)}
                          className="bg-transparent text-sm font-serif font-bold text-[#f7f3ee] outline-none w-full"
                          autoFocus
                        />
                        <button
                          onClick={() => handleSaveTitle(workout.id)}
                          className="p-1 bg-[#d97724] text-[#0c0a09] rounded-lg font-bold text-xs"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <h3 className="text-base font-serif font-bold text-[#f7f3ee]">
                          {workout.title}
                        </h3>
                        {onUpdateWorkoutTitle && (
                          <button
                            onClick={() => handleStartEditing(workout)}
                            className="p-1 text-[#8c7e72] hover:text-[#e6a15c] transition-colors"
                            title="Rename workout"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => onDeleteWorkout(workout.id)}
                      className="p-1.5 text-[#6b5e54] hover:text-[#c86d51] hover:bg-[#c86d51]/10 rounded-lg transition-colors"
                      title="Delete log"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Metrics Pill Grid */}
                {(() => {
                  const dist = calculateTotalDistance(workout);
                  return (
                    <div className={`grid ${dist > 0 ? 'grid-cols-4' : 'grid-cols-3'} gap-2 text-xs font-mono`}>
                      <div className="bg-[#100d0b] p-2 rounded-2xl border border-[#2b241f] text-center">
                        <span className="text-[9px] text-[#8c7e72] font-syne uppercase font-semibold block">Volume</span>
                        <span className="font-bold text-[#e6a15c]">{volume.toLocaleString()} {unit}</span>
                      </div>
                      <div className="bg-[#100d0b] p-2 rounded-2xl border border-[#2b241f] text-center">
                        <span className="text-[9px] text-[#8c7e72] font-syne uppercase font-semibold block">Sets</span>
                        <span className="font-bold text-[#849a88]">{sets} sets</span>
                      </div>
                      <div className="bg-[#100d0b] p-2 rounded-2xl border border-[#2b241f] text-center">
                        <span className="text-[9px] text-[#8c7e72] font-syne uppercase font-semibold block">Duration</span>
                        <span className="font-bold text-[#f7f3ee]">{workout.durationMinutes || 40} mins</span>
                      </div>
                      {dist > 0 && (
                        <div className="bg-[#100d0b] p-2 rounded-2xl border border-[#2b241f] text-center">
                          <span className="text-[9px] text-[#8c7e72] font-syne uppercase font-semibold block">Run Dist</span>
                          <span className="font-bold text-[#d97724]">{dist} mi</span>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Machines Summaries */}
                <div className="space-y-1.5 pt-1">
                  <span className="text-[10px] font-syne font-bold text-[#a39588] uppercase tracking-wider block">
                    Exercises & Machines
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {workout.exercises.map((ex, exIdx) => (
                      <span
                        key={ex.id || exIdx}
                        className="bg-[#100d0b] text-[#c8b8a8] border border-[#2b241f] px-2.5 py-1 rounded-xl text-xs font-medium flex items-center gap-1"
                      >
                        <Compass className="w-3 h-3 text-[#e6a15c]" />
                        {ex.machineName} ({ex.sets.filter(s => s.completed).length} sets)
                      </span>
                    ))}
                  </div>
                </div>

                {/* Muscle Sensation Highlight Preview */}
                {workout.exercises.some((e) => e.muscleFeeling?.notes) && (
                  <div className="bg-[#d97724]/10 border border-[#d97724]/20 p-2.5 rounded-2xl text-xs space-y-1">
                    <span className="text-[10px] font-syne font-bold text-[#e6a15c] uppercase tracking-wider flex items-center gap-1">
                      <Activity className="w-3 h-3 text-[#d97724]" /> Muscle Feedback Note
                    </span>
                    <p className="text-[#f7f3ee] text-[11px] font-serif italic line-clamp-2">
                      "{workout.exercises.find((e) => e.muscleFeeling?.notes)?.muscleFeeling.notes}"
                    </p>
                  </div>
                )}

                {/* Action Bar */}
                <div className="flex items-center justify-between pt-2 border-t border-[#2b241f] text-xs">
                  <button
                    onClick={() => onRepeatWorkout(workout)}
                    className="text-[#8c7e72] hover:text-[#f7f3ee] font-syne font-medium flex items-center gap-1 transition-colors"
                  >
                    <Repeat className="w-3.5 h-3.5 text-[#e6a15c]" /> Repeat Session
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
