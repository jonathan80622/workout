'use client';

import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Circle, Dumbbell, Lock, Minimize2, RefreshCw, X } from 'lucide-react';
import { MuscleGroup, WorkoutAppState, WorkoutVideo } from '../types';
import { track } from '../analytics/client';
import { WorkoutReviewCard } from './WorkoutReviewCard';

type PtClient = { id: string; label: string; workoutCount: number };
type PTCommentState = Record<string, { workoutComment: string; exerciseComments: Record<string, string> }>;

/** Coach-only wrapper around the shared workout review surface. */
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
        if (exposedItems.current.has(key)) { observer.unobserve(element); continue; }
        exposedItems.current.add(key); observer.unobserve(element);
        if (exposureType === 'workout') track('pt_workout_exposed', { client_id: clientId || undefined, workout_id: workoutId, exercise_count: Number(element.dataset.exerciseCount || 0), completed_set_count: Number(element.dataset.completedSetCount || 0), video_count: Number(element.dataset.videoCount || 0) });
        if (exposureType === 'exercise' && element.dataset.exerciseId && element.dataset.category) track('pt_exercise_exposed', { client_id: clientId || undefined, workout_id: workoutId, exercise_id: element.dataset.exerciseId, category: element.dataset.category as MuscleGroup, completed_set_count: Number(element.dataset.completedSetCount || 0), video_count: Number(element.dataset.videoCount || 0) });
      }
    }, { threshold: 0.35 });
    portalRef.current.querySelectorAll<HTMLElement>('[data-pt-exposure]').forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [clientId, state]);

  const saveComment = (workoutId: string, text: string, exerciseId?: string) => {
    const commentClientId = clientId;
    const comment_scope = exerciseId ? 'exercise' : 'workout';
    setStatus('Saving comment...');
    saveQueue.current = saveQueue.current.then(async () => {
      try {
        const response = await fetch('/api/pt-state', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password, clientId: commentClientId, workoutId, exerciseId, text }) });
        if (!response.ok) throw new Error((await response.json()).error || 'Comment not saved.');
        setStatus('Comment saved.');
        track('pt_comment_saved', { client_id: commentClientId || undefined, workout_id: workoutId, exercise_id: exerciseId, comment_scope, comment_length: text.trim().length });
      } catch (error) {
        setStatus(error instanceof Error ? error.message : 'Comment not saved.');
        track('pt_comment_save_failed', { client_id: commentClientId || undefined, workout_id: workoutId, exercise_id: exerciseId, comment_scope, comment_length: text.trim().length });
      }
    });
  };

  const loadPortal = async (requestedClientId?: string, previousClientId?: string | null) => {
    setIsLoading(true); setStatus(requestedClientId ? 'Loading client...' : 'Checking password...');
    try {
      const response = await fetch('/api/pt-state', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password, clientId: requestedClientId }) });
      const data = await response.json();
      if (!response.ok) { setStatus(data.error || 'Unable to load workout portal.'); track('pt_portal_loaded', { status: 'failure' }); return; }
      const loaded = data.state as WorkoutAppState;
      const loadedClientId = data.clientId as string | null;
      const loadedClients = data.clients as PtClient[];
      setClients(loadedClients); setClientId(loadedClientId); setState(loaded);
      setComments(Object.fromEntries(loaded.workouts.map((workout) => [workout.id, { workoutComment: workout.ptComment || '', exerciseComments: Object.fromEntries(workout.exercises.map((exercise) => [exercise.id, exercise.ptComment || ''])) }])));
      setStatus('Loaded.');
      track('pt_portal_loaded', { status: 'success', client_id: loadedClientId || undefined, client_count: loadedClients.length, workout_count: loaded.workouts.filter((workout) => workout.isCompleted).length });
      if (requestedClientId) track('pt_client_selected', { client_id: loadedClientId || requestedClientId, previous_client_id: previousClientId || undefined, workout_count: loaded.workouts.filter((workout) => workout.isCompleted).length });
    } catch (error) { setStatus(error instanceof Error ? error.message : 'Unable to load workout portal.'); track('pt_portal_loaded', { status: 'failure' }); }
    finally { setIsLoading(false); }
  };

  const updateWorkoutComment = (workoutId: string, workoutComment: string) => setComments((previous) => ({ ...previous, [workoutId]: { workoutComment, exerciseComments: previous[workoutId]?.exerciseComments || {} } }));
  const updateExerciseComment = (workoutId: string, exerciseId: string, comment: string) => setComments((previous) => ({ ...previous, [workoutId]: { workoutComment: previous[workoutId]?.workoutComment || '', exerciseComments: { ...(previous[workoutId]?.exerciseComments || {}), [exerciseId]: comment } } }));
  const focusComment = (workoutId: string, exerciseId?: string) => track('pt_comment_focused', { client_id: clientId || undefined, workout_id: workoutId, exercise_id: exerciseId, comment_scope: exerciseId ? 'exercise' : 'workout' });
  const openVideo = (video: WorkoutVideo) => { setExpandedVideo(video); track('pt_video_opened', { client_id: clientId || undefined, workout_id: video.workoutId, exercise_id: video.exerciseId, video_id: video.id }); };
  const closeVideo = () => { if (expandedVideo) track('pt_video_closed', { client_id: clientId || undefined, workout_id: expandedVideo.workoutId, exercise_id: expandedVideo.exerciseId, video_id: expandedVideo.id }); setExpandedVideo(null); };

  if (!state) return <main className="min-h-screen bg-[#0c0a09] text-[#f7f3ee] flex items-center justify-center px-4"><div className="w-full max-w-sm bg-[#181412] border border-[#382f29] rounded-3xl p-5 space-y-4 shadow-2xl"><div className="flex items-center gap-2"><Lock className="w-5 h-5 text-[#e6a15c]" /><h1 className="text-lg font-serif font-bold">PT Workout Portal</h1></div><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && void loadPortal()} placeholder="Password" className="w-full bg-[#100d0b] border border-[#2b241f] rounded-xl p-3 text-sm text-[#f7f3ee] outline-none focus:ring-1 focus:ring-[#d97724]" /><button type="button" onClick={() => loadPortal()} disabled={!password || isLoading} className="w-full py-3 bg-[#d97724] disabled:opacity-50 text-[#0c0a09] font-syne font-bold text-xs rounded-xl flex items-center justify-center gap-2">{isLoading && <RefreshCw className="w-4 h-4 animate-spin" />}Open Portal</button>{status && <p className="text-xs text-[#a39588]">{status}</p>}</div></main>;

  const completedWorkouts = state.workouts.filter((workout) => workout.isCompleted);
  const todayWarmups = state.warmupCheckins?.[new Date().toISOString().slice(0, 10)] || {};
  const warmupsDone = state.trainingPlan.warmupMoves.filter((move) => todayWarmups[move.id]).length;
  return <main ref={portalRef} className="min-h-screen bg-[#0c0a09] text-[#f7f3ee] px-4 py-5"><div className="max-w-6xl mx-auto space-y-5"><p role="status" className="text-xs text-[#a39588]">{status}</p><header className="border-b border-[#2b241f] pb-4"><p className="text-xs text-[#e6a15c] font-syne font-bold uppercase tracking-wider">Workout Recorder</p><h1 className="text-2xl font-serif font-bold">{state.profile.clientName || 'Athlete'} Training Log</h1>{state.profile.ptName && <p className="text-sm text-[#a39588]">For {state.profile.ptName}</p>}{clients.length > 1 && <label className="mt-3 flex items-center gap-2 text-xs text-[#a39588]">Client <select value={clientId ?? ''} disabled={isLoading} onChange={(event) => loadPortal(event.target.value, clientId)} className="bg-[#100d0b] border border-[#2b241f] rounded-xl px-2 py-1.5 font-mono text-[#f7f3ee] outline-none focus:ring-1 focus:ring-[#d97724]">{clients.map((client) => <option key={client.id} value={client.id}>{client.label} · {client.workoutCount} workouts</option>)}</select></label>}</header>
    <section className="grid gap-4 lg:grid-cols-[320px_1fr]"><div className="bg-[#181412] border border-[#382f29] rounded-3xl p-4 space-y-3"><div className="flex items-center justify-between gap-3"><div><p className="text-xs text-[#e6a15c] font-syne font-bold uppercase tracking-wider">Today Warmup</p><h2 className="text-2xl font-serif font-bold">{warmupsDone}/{state.trainingPlan.warmupMoves.length}</h2></div><CheckCircle2 className="w-6 h-6 text-[#849a88]" /></div>{state.trainingPlan.warmupMoves.map((move) => <div key={move.id} className="flex items-center gap-2 text-xs text-[#c8b8a8]">{todayWarmups[move.id] ? <CheckCircle2 className="w-4 h-4 text-[#849a88]" /> : <Circle className="w-4 h-4 text-[#6b5e54]" />}<span>{move.name}</span></div>)}</div><div className="bg-[#181412] border border-[#382f29] rounded-3xl p-4"><div className="flex items-center gap-3"><Dumbbell className="w-6 h-6 text-[#e6a15c]" /><div><p className="text-xs text-[#e6a15c] font-syne font-bold uppercase tracking-wider">Training Plan</p><h2 className="text-2xl font-serif font-bold">{state.trainingPlan.title}</h2></div></div></div></section>
    {completedWorkouts.length === 0 ? <div className="bg-[#181412] border border-[#382f29] rounded-3xl p-6 text-sm text-[#a39588]">No completed workouts have been shared yet.</div> : completedWorkouts.map((workout) => { const comment = comments[workout.id] || { workoutComment: '', exerciseComments: {} }; return <WorkoutReviewCard key={workout.id} workout={workout} mode="pt" workoutComment={comment.workoutComment} exerciseComments={comment.exerciseComments} onWorkoutCommentChange={(text) => updateWorkoutComment(workout.id, text)} onExerciseCommentChange={(exerciseId, text) => updateExerciseComment(workout.id, exerciseId, text)} onCommentFocus={(exerciseId) => focusComment(workout.id, exerciseId)} onCommentBlur={(text, exerciseId) => saveComment(workout.id, text, exerciseId)} onVideoOpen={openVideo} />; })}
  </div>{expandedVideo && <div className="fixed inset-0 z-50 bg-[#0c0a09] p-3 sm:p-5 flex flex-col"><div className="max-w-6xl w-full mx-auto flex items-center justify-between gap-3 pb-3"><p className="truncate text-sm font-bold text-[#f7f3ee]">{expandedVideo.name || 'Workout video'}</p><button type="button" onClick={closeVideo} className="h-10 px-3 rounded-full bg-[#181412] border border-[#382f29] text-[#f7f3ee] flex items-center gap-2"><Minimize2 className="w-4 h-4" /><X className="w-4 h-4" /></button></div><div className="max-w-6xl w-full mx-auto flex-1 min-h-0 bg-black border border-[#382f29] rounded-2xl overflow-hidden"><iframe src={`https://drive.google.com/file/d/${expandedVideo.driveFileId}/preview`} allow="autoplay; fullscreen; encrypted-media; picture-in-picture" allowFullScreen sandbox="allow-scripts allow-same-origin allow-presentation" className="w-full h-full border-0 bg-black" title={expandedVideo.name || expandedVideo.id} /></div></div>}</main>;
};
