'use client';

import React, { useEffect, useState } from 'react';
import { Compass, Edit2, Search, Trash2, Repeat, Check } from 'lucide-react';
import { Workout, WorkoutVideo } from '../types';
import { WorkoutReviewCard } from './WorkoutReviewCard';
import { ExpandedVideoPlayer } from './ExpandedVideoPlayer';
import type { AnalyticsTrack } from '../analytics/events';

interface WorkoutHistoryProps {
  workouts: Workout[];
  onRepeatWorkout: (workout: Workout) => void;
  onDeleteWorkout: (workoutId: string) => void;
  onStartNewWorkout: () => void;
  onUpdateWorkoutTitle?: (workoutId: string, newTitle: string) => void;
  onUpdateWorkoutDate?: (workoutId: string, newDateIso: string) => void;
  onUpdateWorkoutPtComment?: (workoutId: string, ptComment: string) => void;
  onUpdateExercisePtComment?: (workoutId: string, exerciseId: string, ptComment: string) => void;
  onVideoUploaded?: (workoutId: string, exerciseId: string, video: WorkoutVideo) => void;
  onTrack?: AnalyticsTrack;
}

/** Trainee-only wrapper for the shared coach/trainee workout review module. */
export const WorkoutHistory: React.FC<WorkoutHistoryProps> = ({
  workouts, onRepeatWorkout, onDeleteWorkout, onStartNewWorkout, onUpdateWorkoutTitle,
  onUpdateWorkoutDate, onUpdateWorkoutPtComment, onUpdateExercisePtComment, onVideoUploaded, onTrack,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitleText, setEditTitleText] = useState('');
  const [expandedVideo, setExpandedVideo] = useState<WorkoutVideo | null>(null);
  const completedWorkouts = workouts.filter((workout) => workout.isCompleted).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const filteredWorkouts = completedWorkouts.filter((workout) => {
    const query = searchQuery.trim().toLowerCase();
    return !query || workout.title.toLowerCase().includes(query) || workout.exercises.some((exercise) =>
      exercise.exerciseName.toLowerCase().includes(query) || exercise.notes?.toLowerCase().includes(query) || exercise.ptComment?.toLowerCase().includes(query)
    ) || workout.ptNotes?.toLowerCase().includes(query) || workout.ptComment?.toLowerCase().includes(query);
  });

  useEffect(() => {
    const query = searchQuery.trim();
    if (!query || !onTrack) return;
    const timer = window.setTimeout(() => onTrack('history_searched', { query_length: query.length, result_count: filteredWorkouts.length, total_count: completedWorkouts.length }), 600);
    return () => window.clearTimeout(timer);
  }, [completedWorkouts.length, filteredWorkouts.length, onTrack, searchQuery]);

  return <div className="space-y-4 pb-28">
    <div className="flex items-center justify-between">
      <div><h2 className="text-lg font-serif font-bold text-[#f7f3ee]">Workout History</h2><p className="text-xs text-[#a39588] font-light">Review, discuss, and add form video to completed sessions.</p></div>
      <button onClick={onStartNewWorkout} className="px-3.5 py-2 bg-gradient-to-r from-[#d97724] to-[#e6a15c] text-[#0c0a09] font-syne font-bold text-xs rounded-2xl">+ New Workout</button>
    </div>
    <div className="relative"><Search className="w-4 h-4 text-[#8c7e72] absolute left-3.5 top-3" /><input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search by workout, exercise, note, or feedback..." className="w-full bg-[#181412] border border-[#382f29] rounded-2xl pl-10 pr-4 py-2.5 text-xs text-[#f7f3ee] placeholder-[#6b5e54] focus:outline-none focus:ring-1 focus:ring-[#d97724]" /></div>
    {filteredWorkouts.length === 0 ? <div className="bg-[#181412]/60 border border-[#382f29] rounded-3xl p-8 text-center space-y-3"><Compass className="w-10 h-10 text-[#6b5e54] mx-auto" /><h3 className="text-sm font-serif font-semibold text-[#f7f3ee]">No workout logs found</h3><p className="text-xs text-[#a39588]">{searchQuery ? 'No workout matches your search.' : 'You have not completed any workouts yet.'}</p><button onClick={onStartNewWorkout} className="px-4 py-2 bg-[#d97724] text-[#0c0a09] font-syne font-bold text-xs rounded-xl">Start Session Now</button></div> : <div className="space-y-4">{filteredWorkouts.map((workout) => <div key={workout.id} className="space-y-2">
      <div className="flex items-center justify-between gap-2 px-1">
        {editingId === workout.id ? <div className="flex flex-1 items-center gap-1.5 bg-[#100d0b] border border-[#d97724] rounded-xl px-2.5 py-1"><input value={editTitleText} onChange={(event) => setEditTitleText(event.target.value)} className="bg-transparent text-sm font-serif font-bold text-[#f7f3ee] outline-none w-full" autoFocus /><button onClick={() => { if (editTitleText.trim()) onUpdateWorkoutTitle?.(workout.id, editTitleText.trim()); setEditingId(null); }} className="p-1 bg-[#d97724] text-[#0c0a09] rounded-lg"><Check className="w-3.5 h-3.5" /></button></div> : <div className="flex items-center gap-1.5 min-w-0"><span className="text-xs text-[#a39588]">{workout.date.split('T')[0]}</span>{onUpdateWorkoutTitle && <button onClick={() => { setEditingId(workout.id); setEditTitleText(workout.title); }} className="p-1 text-[#8c7e72] hover:text-[#e6a15c]" title="Rename workout"><Edit2 className="w-3.5 h-3.5" /></button>}</div>}
        <div className="flex items-center gap-1"><input type="date" value={workout.date.split('T')[0]} onChange={(event) => event.target.value && onUpdateWorkoutDate?.(workout.id, `${event.target.value}T12:00:00.000Z`)} className="bg-[#100d0b] border border-[#382f29] rounded-lg px-2 py-1 text-[10px] text-[#f7f3ee]" /><button onClick={() => onRepeatWorkout(workout)} className="p-1.5 text-[#8c7e72] hover:text-[#f7f3ee]" title="Repeat session"><Repeat className="w-4 h-4" /></button><button onClick={() => onDeleteWorkout(workout.id)} className="p-1.5 text-[#6b5e54] hover:text-[#c86d51]" title="Delete log"><Trash2 className="w-4 h-4" /></button></div>
      </div>
      <WorkoutReviewCard workout={workout} mode="trainee" workoutComment={workout.ptComment || ''} exerciseComments={Object.fromEntries(workout.exercises.map((exercise) => [exercise.id, exercise.ptComment || '']))} onWorkoutCommentChange={(ptComment) => onUpdateWorkoutPtComment?.(workout.id, ptComment)} onExerciseCommentChange={(exerciseId, ptComment) => onUpdateExercisePtComment?.(workout.id, exerciseId, ptComment)} onVideoUploaded={(exerciseId, video) => onVideoUploaded?.(workout.id, exerciseId, video)} onVideoOpen={setExpandedVideo} />
    </div>)}</div>}
    <ExpandedVideoPlayer video={expandedVideo} onClose={() => setExpandedVideo(null)} />
  </div>;
};
