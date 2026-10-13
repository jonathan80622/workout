'use client';

import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Circle, Dumbbell, Lock, Maximize2, MessageSquareText, Minimize2, RefreshCw, X } from 'lucide-react';
import { MuscleGroup, WorkoutAppState, WorkoutVideo } from '../types';
import { formatWorkoutDate } from '../utils/formatters';
import { track } from '../analytics/client';

type PtClient = { id: string; label: string; workoutCount: number };

type PTCommentState = Record<
  string,
  {
    workoutComment: string;
    exerciseComments: Record<string, string>;
  }
>;

export const PTPortal: React.FC = () => {
  const [password, setPassword] = useState('');
  const [state, setState] = useState<WorkoutAppState | null>(null);
  const [clients, setClients] = useState<PtClient[]>([]);
  const [clientId, setClientId] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [comments, setComments] = useState<PTCommentState>({});
  const [expandedVideo, setExpandedVideo] = useState<WorkoutVideo | null>(null);

  const portalRef = useRef<HTMLElement | null>(null);
  const saveQueue = useRef(Promise.resolve());
  const exposedItems = useRef(new Set<string>());

  useEffect(() => {
    if (!state || !portalRef.current || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const element = entry.target as HTMLElement;
        const exposureType = element.dataset.ptExposure;
        const workoutId = element.dataset.workoutId;
        if (!exposureType || !workoutId) continue;

        const key = `${clientId || 'unknown'}:${exposureType}:${workoutId}:${element.dataset.exerciseId || ''}`;
        if (exposedItems.current.has(key)) {
          observer.unobserve(element);
          continue;
        }
        exposedItems.current.add(key);
        observer.unobserve(element);

        if (exposureType === 'workout') {
          track('pt_workout_exposed', {
            client_id: clientId || undefined,
            workout_id: workoutId,
            exercise_count: Number(element.dataset.exerciseCount || 0),
            completed_set_count: Number(element.dataset.completedSetCount || 0),
            video_count: Number(element.dataset.videoCount || 0),
          });
        }

        if (exposureType === 'exercise' && element.dataset.exerciseId && element.dataset.category) {
          track('pt_exercise_exposed', {
            client_id: clientId || undefined,
            workout_id: workoutId,
            exercise_id: element.dataset.exerciseId,
            category: element.dataset.category as MuscleGroup,
            completed_set_count: Number(element.dataset.completedSetCount || 0),
            video_count: Number(element.dataset.videoCount || 0),
          });
        }
      }
    }, { threshold: 0.35 });

    portalRef.current.querySelectorAll<HTMLElement>('[data-pt-exposure]').forEach((element) => {
      observer.observe(element);
    });

    return () => observer.disconnect();
  }, [clientId, state]);

  const saveComment = (workoutId: string, text: string, exerciseId?: string) => {
    // Captured now, so a comment queued before switching clients still saves to the client it was written for.
    const commentClientId = clientId;
    const comment_scope = exerciseId ? 'exercise' : 'workout';
    setStatus('Saving comment...');
    saveQueue.current = saveQueue.current.then(async () => {
      try {
        const response = await fetch('/api/pt-state', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password, clientId: commentClientId, workoutId, exerciseId, text }),
        });
        if (!response.ok) throw new Error((await response.json()).error || 'Comment not saved.');
        setStatus('Comment saved.');
        track('pt_comment_saved', {
          client_id: commentClientId || undefined,
          workout_id: workoutId,
          exercise_id: exerciseId,
          comment_scope,
          comment_length: text.trim().length,
        });
      } catch (error) {
        setStatus(error instanceof Error ? error.message : 'Comment not saved.');
        track('pt_comment_save_failed', {
          client_id: commentClientId || undefined,
          workout_id: workoutId,
          exercise_id: exerciseId,
          comment_scope,
          comment_length: text.trim().length,
        });
      }
    });
  };

  // Loads one client's data. Without a client ID the server picks the client with the most workouts.
  const loadPortal = async (requestedClientId?: string, previousClientId?: string | null) => {
    setIsLoading(true);
    setStatus(requestedClientId ? 'Loading client...' : 'Checking password...');

    try {
      const response = await fetch('/api/pt-state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, clientId: requestedClientId }),
      });
      const data = await response.json();

      if (!response.ok) {
        setStatus(data.error || 'Unable to load workout portal.');
        track('pt_portal_loaded', { status: 'failure' });
        return;
      }

      const loaded = data.state as WorkoutAppState;
      const loadedClientId = data.clientId as string | null;
      const loadedClients = data.clients as PtClient[];
      setClients(data.clients);
      setClientId(loadedClientId);
      setState(loaded);
      setComments(Object.fromEntries(loaded.workouts.map((workout) => [workout.id, {
        workoutComment: workout.ptComment || '',
        exerciseComments: Object.fromEntries(workout.exercises.map((exercise) => [exercise.id, exercise.ptComment || ''])),
      }])));
      setStatus('Loaded.');
      track('pt_portal_loaded', {
        status: 'success',
        client_id: loadedClientId || undefined,
        client_count: loadedClients.length,
        workout_count: loaded.workouts.filter((workout) => workout.isCompleted).length,
      });
      if (requestedClientId) {
        track('pt_client_selected', {
          client_id: loadedClientId || requestedClientId,
          previous_client_id: previousClientId || undefined,
          workout_count: loaded.workouts.filter((workout) => workout.isCompleted).length,
        });
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Unable to load workout portal.');
      track('pt_portal_loaded', { status: 'failure' });
    } finally {
      setIsLoading(false);
    }
  };

  const openVideo = (video: WorkoutVideo) => {
    setExpandedVideo(video);
    track('pt_video_opened', {
      client_id: clientId || undefined,
      workout_id: video.workoutId,
      exercise_id: video.exerciseId,
      video_id: video.id,
    });
  };

  const closeVideo = () => {
    if (expandedVideo) {
      track('pt_video_closed', {
        client_id: clientId || undefined,
        workout_id: expandedVideo.workoutId,
        exercise_id: expandedVideo.exerciseId,
        video_id: expandedVideo.id,
      });
    }
    setExpandedVideo(null);
  };

  const trackCommentFocus = (workoutId: string, exerciseId?: string) => {
    track('pt_comment_focused', {
      client_id: clientId || undefined,
      workout_id: workoutId,
      exercise_id: exerciseId,
      comment_scope: exerciseId ? 'exercise' : 'workout',
    });
  };

  const handleWorkoutCommentChange = (workoutId: string, comment: string) => {
    setComments((previous) => ({
      ...previous,
      [workoutId]: {
        workoutComment: comment,
        exerciseComments: previous[workoutId]?.exerciseComments || {},
      },
    }));
  };

  const handleExerciseCommentChange = (workoutId: string, exerciseId: string, comment: string) => {
    setComments((previous) => ({
      ...previous,
      [workoutId]: {
        workoutComment: previous[workoutId]?.workoutComment || '',
        exerciseComments: {
          ...(previous[workoutId]?.exerciseComments || {}),
          [exerciseId]: comment,
        },
      },
    }));
  };

  if (!state) {
    return (
      <main className="min-h-screen bg-[#0c0a09] text-[#f7f3ee] flex items-center justify-center px-4">
        <div className="w-full max-w-sm bg-[#181412] border border-[#382f29] rounded-3xl p-5 space-y-4 shadow-2xl">
          <div className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-[#e6a15c]" />
            <h1 className="text-lg font-serif font-bold">PT Workout Portal</h1>
          </div>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') void loadPortal();
            }}
            placeholder="Password"
            className="w-full bg-[#100d0b] border border-[#2b241f] rounded-xl p-3 text-sm text-[#f7f3ee] outline-none focus:ring-1 focus:ring-[#d97724]"
          />
          <button
            type="button"
            onClick={() => loadPortal()}
            disabled={!password || isLoading}
            className="w-full py-3 bg-[#d97724] disabled:opacity-50 text-[#0c0a09] font-syne font-bold text-xs rounded-xl flex items-center justify-center gap-2"
          >
            {isLoading && <RefreshCw className="w-4 h-4 animate-spin" />}
            Open Portal
          </button>
          {status && <p className="text-xs text-[#a39588]">{status}</p>}
        </div>
      </main>
    );
  }

  const completedWorkouts = state.workouts.filter((workout) => workout.isCompleted);
  const todayKey = getTodayKey();
  const todayWarmups = state.warmupCheckins?.[todayKey] || {};
  const warmupsDone = state.trainingPlan.warmupMoves.filter((move) => todayWarmups[move.id]).length;

  return (
    <main ref={portalRef} className="min-h-screen bg-[#0c0a09] text-[#f7f3ee] px-4 py-5">
      <div className="max-w-6xl mx-auto space-y-5">
        <p role="status" className="text-xs text-[#a39588]">{status}</p>
        <header className="border-b border-[#2b241f] pb-4">
          <p className="text-xs text-[#e6a15c] font-syne font-bold uppercase tracking-wider">Workout Recorder</p>
          <h1 className="text-2xl font-serif font-bold">{state.profile.clientName || 'Athlete'} Training Log</h1>
          {state.profile.ptName && <p className="text-sm text-[#a39588]">For {state.profile.ptName}</p>}
          {clients.length > 1 && (
            <label className="mt-3 flex items-center gap-2 text-xs text-[#a39588]">
              Client
              <select
                value={clientId ?? ''}
                disabled={isLoading}
                onChange={(event) => loadPortal(event.target.value, clientId)}
                className="bg-[#100d0b] border border-[#2b241f] rounded-xl px-2 py-1.5 font-mono text-[#f7f3ee] outline-none focus:ring-1 focus:ring-[#d97724]"
              >
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.label} · {client.workoutCount} workouts
                  </option>
                ))}
              </select>
            </label>
          )}
        </header>

        <section className="grid gap-4 lg:grid-cols-[320px_1fr]">
          <div className="bg-[#181412] border border-[#382f29] rounded-3xl p-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs text-[#e6a15c] font-syne font-bold uppercase tracking-wider">Today Warmup</p>
                <h2 className="text-2xl font-serif font-bold">{warmupsDone}/{state.trainingPlan.warmupMoves.length}</h2>
              </div>
              <CheckCircle2 className="w-6 h-6 text-[#849a88]" />
            </div>
            <div className="space-y-2">
              {state.trainingPlan.warmupMoves.map((move) => {
                const isChecked = !!todayWarmups[move.id];
                return (
                  <div key={move.id} className="flex items-center gap-2 text-xs text-[#c8b8a8]">
                    {isChecked ? (
                      <CheckCircle2 className="w-4 h-4 text-[#849a88]" />
                    ) : (
                      <Circle className="w-4 h-4 text-[#6b5e54]" />
                    )}
                    <span className="flex-1">{move.name}</span>
                    <span className="font-mono text-[#8c7e72]">{move.target}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-[#181412] border border-[#382f29] rounded-3xl p-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs text-[#e6a15c] font-syne font-bold uppercase tracking-wider">Training Plan</p>
                <h2 className="text-2xl font-serif font-bold">{state.trainingPlan.title}</h2>
              </div>
              <Dumbbell className="w-6 h-6 text-[#e6a15c]" />
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              {state.trainingPlan.blocks.map((block) => (
                <div key={block.id} className="bg-[#100d0b] border border-[#2b241f] rounded-2xl p-3">
                  <h3 className="text-sm font-bold text-[#f7f3ee]">{block.title}</h3>
                  <p className="text-[10px] text-[#8c7e72]">{block.subtitle}</p>
                  <p className="mt-2 text-xs text-[#c8b8a8]">
                    {block.exercises.map((exercise) => exercise.name).join(' · ')}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {completedWorkouts.length === 0 ? (
          <div className="bg-[#181412] border border-[#382f29] rounded-3xl p-6 text-sm text-[#a39588]">
            No completed workouts have been shared yet.
          </div>
        ) : (
          completedWorkouts.map((workout) => {
            const workoutComments = comments[workout.id] || { workoutComment: '', exerciseComments: {} };
            const completedSetCount = workout.exercises.reduce((sum, exercise) => sum + exercise.sets.filter((set) => set.completed).length, 0);
            const videoCount = workout.exercises.reduce((sum, exercise) => sum + (exercise.videos?.length || 0), 0);
            return (
              <section
                key={workout.id}
                data-pt-exposure="workout"
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
                  <p className="bg-[#100d0b] border border-[#2b241f] rounded-2xl p-3 text-sm text-[#f7f3ee] font-serif italic">
                    {workout.ptNotes}
                  </p>
                )}

                <div className="bg-[#100d0b] border border-[#2b241f] rounded-2xl p-3 space-y-2">
                  <label htmlFor={`pt-workout-comment-${workout.id}`} className="text-xs font-bold text-[#f7f3ee] flex items-center gap-2">
                    <MessageSquareText className="w-4 h-4 text-[#e6a15c]" />
                    PT workout comments
                  </label>
                  <textarea
                    id={`pt-workout-comment-${workout.id}`}
                    rows={3}
                    value={workoutComments.workoutComment}
                    onChange={(event) => handleWorkoutCommentChange(workout.id, event.target.value)}
                    onFocus={() => trackCommentFocus(workout.id)}
                    onBlur={(event) => saveComment(workout.id, event.target.value)}
                    placeholder="Add overall feedback, progression notes, form priorities, or questions for this workout."
                    className="w-full bg-[#181412] border border-[#382f29] rounded-xl p-3 text-sm text-[#f7f3ee] placeholder-[#6b5e54] outline-none focus:ring-1 focus:ring-[#d97724] resize-y min-h-24"
                  />
                </div>

                <div className="space-y-3">
                  {workout.exercises.map((exercise) => {
                    const exerciseVideos = exercise.videos || [];
                    const completedSets = exercise.sets.filter((set) => set.completed);
                    const visibleSets = completedSets.length > 0 ? completedSets : exercise.sets;
                    return (
                      <div
                        key={exercise.id}
                        data-pt-exposure="exercise"
                        data-workout-id={workout.id}
                        data-exercise-id={exercise.id}
                        data-category={exercise.category}
                        data-completed-set-count={completedSets.length}
                        data-video-count={exerciseVideos.length}
                        className="bg-[#100d0b] border border-[#2b241f] rounded-2xl p-3"
                      >
                        <div className={`grid gap-4 ${exerciseVideos.length > 0 ? 'lg:grid-cols-[minmax(0,1.25fr)_minmax(300px,0.75fr)]' : ''}`}>
                          {exerciseVideos.length > 0 && (
                            <div className="space-y-3">
                              {exerciseVideos.map((video) => (
                                <div key={video.id} className="bg-[#181412] border border-[#382f29] rounded-2xl overflow-hidden">
                                  <button
                                    type="button"
                                    onClick={() => openVideo(video)}
                                    className="relative block w-full aspect-video overflow-hidden bg-black text-left group"
                                    title="Watch video"
                                  >
                                    <div className="absolute inset-0 flex items-center justify-center text-[#8c7e72]">
                                      <span className="text-xs">Video preview unavailable</span>
                                    </div>
                                    <img
                                      src={`https://drive.google.com/thumbnail?id=${video.driveFileId}&sz=w1200`}
                                      alt=""
                                      loading="lazy"
                                      className="absolute inset-0 h-full w-full object-cover"
                                      onError={(event) => event.currentTarget.remove()}
                                    />
                                    <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10" />
                                    <div className="absolute inset-0 flex items-center justify-center">
                                      <span className="rounded-full bg-[#0c0a09]/85 border border-[#382f29] px-4 py-2 text-xs font-bold text-[#f7f3ee] flex items-center gap-2">
                                        <Maximize2 className="w-4 h-4" />
                                        Watch video
                                      </span>
                                    </div>
                                  </button>
                                  <div className="p-3">
                                    <p className="truncate text-xs font-bold text-[#f7f3ee]">
                                      {video.name || `Video ${new Date(video.createdAt).toLocaleDateString()}`}
                                    </p>
                                    <p className="text-[10px] text-[#8c7e72]">
                                      Uploaded {new Date(video.createdAt).toLocaleDateString()}
                                    </p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          <div className="space-y-3">
                            <div>
                              <div className="flex items-center justify-between gap-3">
                                <h3 className="text-sm font-bold">{exercise.exerciseName}</h3>
                                <span className="text-[10px] text-[#e6a15c]">{exercise.category}</span>
                              </div>
                              <p className="text-xs text-[#a39588] mt-1">
                                {completedSets.length} completed sets
                                {exercise.seatSettings ? ` · Setup: ${exercise.seatSettings}` : ''}
                              </p>
                            </div>

                            <div className="bg-[#181412] border border-[#382f29] rounded-xl overflow-hidden">
                              <div className="grid grid-cols-[44px_1fr_1fr_1fr] gap-2 px-3 py-2 text-[10px] font-bold uppercase text-[#8c7e72] border-b border-[#2b241f]">
                                <span>Set</span>
                                <span>Type</span>
                                <span>Load</span>
                                <span>Reps</span>
                              </div>
                              <div className="divide-y divide-[#2b241f]">
                                {visibleSets.map((set) => (
                                  <div key={set.id} className="grid grid-cols-[44px_1fr_1fr_1fr] gap-2 px-3 py-2 text-xs text-[#f7f3ee]">
                                    <span className="font-mono text-[#e6a15c]">#{set.setNumber}</span>
                                    <span className="capitalize text-[#c8b8a8]">{set.type}</span>
                                    <span className="font-mono">
                                      {exercise.category === 'Cardio & Running'
                                        ? set.distance
                                          ? `${set.distance} mi`
                                          : '-'
                                        : `${set.weight} ${set.weightUnit}`}
                                    </span>
                                    <span className="font-mono">
                                      {exercise.category === 'Cardio & Running'
                                        ? set.runningTimeMinutes
                                          ? `${set.runningTimeMinutes}m`
                                          : '-'
                                        : set.reps}
                                      {set.rpe ? ` · RPE ${set.rpe}` : ''}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>

                            {exercise.notes && (
                              <div className="bg-[#181412] border border-[#382f29] rounded-xl p-3 text-xs">
                                <p className="text-[#c8b8a8]">{exercise.notes}</p>
                              </div>
                            )}

                            {exercise.ptComment?.trim() && (
                              <div className="bg-[#d97724]/10 border border-[#d97724]/25 rounded-xl p-3 text-xs space-y-1">
                                <p className="font-syne font-bold text-[#f5c999]">PT Feedback Note</p>
                                <p className="text-[#f7f3ee] leading-relaxed">{exercise.ptComment}</p>
                              </div>
                            )}

                            <div className="space-y-2">
                              <label htmlFor={`pt-exercise-comment-${workout.id}-${exercise.id}`} className="text-xs font-bold text-[#f7f3ee] flex items-center gap-2">
                                <MessageSquareText className="w-4 h-4 text-[#e6a15c]" />
                                PT comments for this exercise
                              </label>
                              <textarea
                                id={`pt-exercise-comment-${workout.id}-${exercise.id}`}
                                rows={4}
                                value={workoutComments.exerciseComments[exercise.id] || ''}
                                onChange={(event) => handleExerciseCommentChange(workout.id, exercise.id, event.target.value)}
                                onFocus={() => trackCommentFocus(workout.id, exercise.id)}
                                onBlur={(event) => saveComment(workout.id, event.target.value, exercise.id)}
                                placeholder="Comment on load, reps, range of motion, tempo, setup, discomfort, or next-session changes."
                                className="w-full bg-[#181412] border border-[#382f29] rounded-xl p-3 text-xs text-[#f7f3ee] placeholder-[#6b5e54] outline-none focus:ring-1 focus:ring-[#d97724] resize-y min-h-28"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })
        )}
      </div>

      {expandedVideo && (
        <div className="fixed inset-0 z-50 bg-[#0c0a09] p-3 sm:p-5 flex flex-col">
          <div className="max-w-6xl w-full mx-auto flex items-center justify-between gap-3 pb-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-[#f7f3ee]">{expandedVideo.name || 'Workout video'}</p>
              <p className="text-[10px] text-[#8c7e72]">Expanded player</p>
            </div>
            <button
              type="button"
              onClick={closeVideo}
              className="h-10 px-3 rounded-full bg-[#181412] border border-[#382f29] text-[#f7f3ee] flex items-center gap-2 hover:bg-[#211b18]"
              title="Close expanded player"
            >
              <Minimize2 className="w-4 h-4" />
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="max-w-6xl w-full mx-auto flex-1 min-h-0 bg-black border border-[#382f29] rounded-2xl overflow-hidden">
            <iframe
              src={`https://drive.google.com/file/d/${expandedVideo.driveFileId}/preview`}
              allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
              allowFullScreen
              sandbox="allow-scripts allow-same-origin allow-presentation"
              className="w-full h-full border-0 bg-black"
              title={expandedVideo.name || expandedVideo.id}
            />
          </div>
        </div>
      )}
    </main>
  );
};

function getTodayKey() {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
}
