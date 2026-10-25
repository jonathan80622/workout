'use client';

import React from 'react';
import { Maximize2, MessageSquareText } from 'lucide-react';
import { ExerciseLog, Workout, WorkoutVideo } from '../types';
import { formatWorkoutDate } from '../utils/formatters';
import { WorkoutVideoRecorder } from './WorkoutVideoRecorder';

export type WorkoutReviewMode = 'pt' | 'trainee';

interface WorkoutReviewCardProps {
  workout: Workout;
  mode: WorkoutReviewMode;
  workoutComment: string;
  exerciseComments: Record<string, string>;
  onWorkoutCommentChange: (comment: string) => void;
  onExerciseCommentChange: (exerciseId: string, comment: string) => void;
  onCommentBlur?: (text: string, exerciseId?: string) => void;
  onCommentFocus?: (exerciseId?: string) => void;
  onVideoUploaded?: (exerciseId: string, video: WorkoutVideo) => void;
  onVideoOpen?: (video: WorkoutVideo) => void;
}

/**
 * The workout detail surface is shared by the coach portal and a trainee's
 * History tab. The wrapper decides whose workouts are supplied; this card
 * deliberately has no client-selection concern.
 */
export const WorkoutReviewCard: React.FC<WorkoutReviewCardProps> = ({
  workout,
  mode,
  workoutComment,
  exerciseComments,
  onWorkoutCommentChange,
  onExerciseCommentChange,
  onCommentBlur,
  onCommentFocus,
  onVideoUploaded,
  onVideoOpen,
}) => {
  const completedSetCount = workout.exercises.reduce((sum, exercise) => sum + exercise.sets.filter((set) => set.completed).length, 0);
  const videoCount = workout.exercises.reduce((sum, exercise) => sum + (exercise.videos?.length || 0), 0);
  const actor = mode === 'pt' ? 'PT' : 'Your';

  return (
    <section
      data-pt-exposure={mode === 'pt' ? 'workout' : undefined}
      data-workout-id={workout.id}
      data-exercise-count={workout.exercises.length}
      data-completed-set-count={completedSetCount}
      data-video-count={videoCount}
      className="bg-[#181412] border border-[#382f29] rounded-3xl p-4 space-y-4"
    >
      <div>
        <p className="text-xs text-[#e6a15c] font-syne font-bold">{formatWorkoutDate(workout.date)}</p>
        <h2 className="text-xl font-serif font-bold">{workout.title}</h2>
        <p className="text-xs text-[#a39588]">{workout.durationMinutes} min · {workout.exercises.length} exercises</p>
      </div>

      {workout.ptNotes && (
        <p className="bg-[#100d0b] border border-[#2b241f] rounded-2xl p-3 text-sm text-[#f7f3ee] font-serif italic">{workout.ptNotes}</p>
      )}

      <CommentBox
        id={`workout-comment-${mode}-${workout.id}`}
        label={`${actor} workout comments`}
        value={workoutComment}
        rows={3}
        placeholder="Add overall feedback, progression notes, form priorities, or questions for this workout."
        onChange={onWorkoutCommentChange}
        onFocus={() => onCommentFocus?.()}
        onBlur={(text) => onCommentBlur?.(text)}
      />

      <div className="space-y-3">
        {workout.exercises.map((exercise) => (
          <ExerciseReview
            key={exercise.id}
            workout={workout}
            exercise={exercise}
            mode={mode}
            comment={exerciseComments[exercise.id] || ''}
            onCommentChange={(comment) => onExerciseCommentChange(exercise.id, comment)}
            onCommentFocus={() => onCommentFocus?.(exercise.id)}
            onCommentBlur={(comment) => onCommentBlur?.(comment, exercise.id)}
            onVideoUploaded={onVideoUploaded ? (video) => onVideoUploaded(exercise.id, video) : undefined}
            onVideoOpen={onVideoOpen}
          />
        ))}
      </div>
    </section>
  );
};

function ExerciseReview({ workout, exercise, mode, comment, onCommentChange, onCommentFocus, onCommentBlur, onVideoUploaded, onVideoOpen }: {
  workout: Workout;
  exercise: ExerciseLog;
  mode: WorkoutReviewMode;
  comment: string;
  onCommentChange: (comment: string) => void;
  onCommentFocus: () => void;
  onCommentBlur: (comment: string) => void;
  onVideoUploaded?: (video: WorkoutVideo) => void;
  onVideoOpen?: (video: WorkoutVideo) => void;
}) {
  const videos = exercise.videos || [];
  const completedSets = exercise.sets.filter((set) => set.completed);
  const visibleSets = completedSets.length > 0 ? completedSets : exercise.sets;
  const actor = mode === 'pt' ? 'PT' : 'Your';

  return (
    <div
      data-pt-exposure={mode === 'pt' ? 'exercise' : undefined}
      data-workout-id={workout.id}
      data-exercise-id={exercise.id}
      data-category={exercise.category}
      data-completed-set-count={completedSets.length}
      data-video-count={videos.length}
      className="bg-[#100d0b] border border-[#2b241f] rounded-2xl p-3"
    >
      <div className={`grid gap-4 ${videos.length > 0 ? 'lg:grid-cols-[minmax(0,1.25fr)_minmax(300px,0.75fr)]' : ''}`}>
        {videos.length > 0 && <VideoGallery videos={videos} onVideoOpen={onVideoOpen} />}
        <div className="space-y-3">
          <div>
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-bold">{exercise.exerciseName}</h3>
              <span className="text-[10px] text-[#e6a15c]">{exercise.category}</span>
            </div>
            <p className="text-xs text-[#a39588] mt-1">{completedSets.length} completed sets{exercise.seatSettings ? ` · Setup: ${exercise.seatSettings}` : ''}</p>
          </div>
          <SetTable exercise={exercise} sets={visibleSets} />
          {exercise.notes && <div className="bg-[#181412] border border-[#382f29] rounded-xl p-3 text-xs text-[#c8b8a8]">{exercise.notes}</div>}
          <CommentBox
            id={`exercise-comment-${mode}-${workout.id}-${exercise.id}`}
            label={`${actor} comments for this exercise`}
            value={comment}
            rows={4}
            placeholder="Comment on load, reps, range of motion, tempo, setup, discomfort, or next-session changes."
            onChange={onCommentChange}
            onFocus={onCommentFocus}
            onBlur={onCommentBlur}
          />
          {mode === 'trainee' && onVideoUploaded && (
            <WorkoutVideoRecorder workout={workout} exercise={exercise} videos={videos} showVideos={false} onVideoUploaded={onVideoUploaded} />
          )}
        </div>
      </div>
    </div>
  );
}

function CommentBox({ id, label, value, rows, placeholder, onChange, onFocus, onBlur }: { id: string; label: string; value: string; rows: number; placeholder: string; onChange: (value: string) => void; onFocus: () => void; onBlur: (value: string) => void }) {
  return <div className="space-y-2">
    <label htmlFor={id} className="text-xs font-bold text-[#f7f3ee] flex items-center gap-2"><MessageSquareText className="w-4 h-4 text-[#e6a15c]" />{label}</label>
    <textarea id={id} rows={rows} value={value} onChange={(event) => onChange(event.target.value)} onFocus={onFocus} onBlur={(event) => onBlur(event.target.value)} placeholder={placeholder} className="w-full bg-[#181412] border border-[#382f29] rounded-xl p-3 text-xs text-[#f7f3ee] placeholder-[#6b5e54] outline-none focus:ring-1 focus:ring-[#d97724] resize-y min-h-24" />
  </div>;
}

function VideoGallery({ videos, onVideoOpen }: { videos: WorkoutVideo[]; onVideoOpen?: (video: WorkoutVideo) => void }) {
  return <div className="space-y-3">{videos.map((video) => <div key={video.id} className="bg-[#181412] border border-[#382f29] rounded-2xl overflow-hidden"><button type="button" onClick={() => onVideoOpen ? onVideoOpen(video) : window.open(video.webViewLink || `https://drive.google.com/file/d/${video.driveFileId}/view`, '_blank', 'noopener,noreferrer')} className="relative block w-full aspect-video overflow-hidden bg-black text-left group" title="Watch video"><img src={`https://drive.google.com/thumbnail?id=${video.driveFileId}&sz=w1200`} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" onError={(event) => event.currentTarget.remove()} /><div className="absolute inset-0 bg-black/30 flex items-center justify-center"><span className="rounded-full bg-[#0c0a09]/85 border border-[#382f29] px-4 py-2 text-xs font-bold text-[#f7f3ee] flex items-center gap-2"><Maximize2 className="w-4 h-4" />Watch video</span></div></button><div className="p-3"><p className="truncate text-xs font-bold text-[#f7f3ee]">{video.name || `Video ${new Date(video.createdAt).toLocaleDateString()}`}</p><p className="text-[10px] text-[#8c7e72]">Uploaded {new Date(video.createdAt).toLocaleDateString()}</p></div></div>)}</div>;
}

function SetTable({ exercise, sets }: { exercise: ExerciseLog; sets: ExerciseLog['sets'] }) {
  return <div className="bg-[#181412] border border-[#382f29] rounded-xl overflow-hidden"><div className="grid grid-cols-[44px_1fr_1fr_1fr] gap-2 px-3 py-2 text-[10px] font-bold uppercase text-[#8c7e72] border-b border-[#2b241f]"><span>Set</span><span>Type</span><span>Load</span><span>Reps</span></div><div className="divide-y divide-[#2b241f]">{sets.map((set) => <div key={set.id} className="grid grid-cols-[44px_1fr_1fr_1fr] gap-2 px-3 py-2 text-xs text-[#f7f3ee]"><span className="font-mono text-[#e6a15c]">#{set.setNumber}</span><span className="capitalize text-[#c8b8a8]">{set.type}</span><span className="font-mono">{exercise.category === 'Cardio & Running' ? (set.distance ? `${set.distance} mi` : '-') : `${set.weight} ${set.weightUnit}`}</span><span className="font-mono">{exercise.category === 'Cardio & Running' ? (set.runningTimeMinutes ? `${set.runningTimeMinutes}m` : '-') : set.reps}{set.rpe ? ` · RPE ${set.rpe}` : ''}</span></div>)}</div></div>;
}
