'use client';

import React, { useMemo, useState } from 'react';
import { Lock, PlayCircle, RefreshCw } from 'lucide-react';
import { WorkoutAppState, WorkoutVideo } from '../types';
import { formatWorkoutDate } from '../utils/formatters';

export const PTPortal: React.FC = () => {
  const [password, setPassword] = useState('');
  const [state, setState] = useState<WorkoutAppState | null>(null);
  const [status, setStatus] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const dataFileId = useMemo(() => {
    if (typeof window === 'undefined') return '';
    return new URLSearchParams(window.location.search).get('dataFileId') || process.env.NEXT_PUBLIC_WORKOUT_DATA_FILE_ID || '';
  }, []);

  const videosByWorkout = useMemo(() => {
    const map = new Map<string, WorkoutVideo[]>();
    for (const video of state?.videos || []) {
      map.set(video.workoutId, [...(map.get(video.workoutId) || []), video]);
    }
    return map;
  }, [state]);

  const loadPortal = async () => {
    if (!dataFileId) {
      setStatus('Missing dataFileId in the portal URL.');
      return;
    }

    setIsLoading(true);
    setStatus('Checking password...');

    try {
      const response = await fetch('/api/pt-state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, dataFileId }),
      });
      const data = await response.json();

      if (!response.ok) {
        setStatus(data.error || 'Unable to load workout portal.');
        return;
      }

      setState(data);
      setStatus('Loaded.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Unable to load workout portal.');
    } finally {
      setIsLoading(false);
    }
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
            onClick={loadPortal}
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

  return (
    <main className="min-h-screen bg-[#0c0a09] text-[#f7f3ee] px-4 py-5">
      <div className="max-w-3xl mx-auto space-y-5">
        <header className="border-b border-[#2b241f] pb-4">
          <p className="text-xs text-[#e6a15c] font-syne font-bold uppercase tracking-wider">Workout Recorder</p>
          <h1 className="text-2xl font-serif font-bold">{state.profile.clientName || 'Athlete'} Training Log</h1>
          {state.profile.ptName && <p className="text-sm text-[#a39588]">For {state.profile.ptName}</p>}
        </header>

        {completedWorkouts.length === 0 ? (
          <div className="bg-[#181412] border border-[#382f29] rounded-3xl p-6 text-sm text-[#a39588]">
            No completed workouts have been shared yet.
          </div>
        ) : (
          completedWorkouts.map((workout) => {
            const workoutVideos = videosByWorkout.get(workout.id) || [];
            return (
              <section key={workout.id} className="bg-[#181412] border border-[#382f29] rounded-3xl p-4 space-y-4">
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

                <div className="space-y-2">
                  {workout.exercises.map((exercise) => (
                    <div key={exercise.id} className="bg-[#100d0b] border border-[#2b241f] rounded-2xl p-3">
                      <div className="flex items-center justify-between gap-3">
                        <h3 className="text-sm font-bold">{exercise.machineName}</h3>
                        <span className="text-[10px] text-[#e6a15c]">{exercise.category}</span>
                      </div>
                      <p className="text-xs text-[#a39588] mt-1">
                        {exercise.sets.filter((set) => set.completed).length} completed sets
                      </p>
                      {exercise.muscleFeeling?.notes && (
                        <p className="text-xs text-[#c8b8a8] mt-2">{exercise.muscleFeeling.notes}</p>
                      )}
                    </div>
                  ))}
                </div>

                {workoutVideos.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-xs font-syne font-bold text-[#e6a15c] uppercase tracking-wider">Videos</h3>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {workoutVideos.map((video) => (
                        <div key={video.id} className="bg-[#100d0b] border border-[#2b241f] rounded-2xl overflow-hidden">
                          <iframe
                            src={`https://drive.google.com/file/d/${video.driveFileId}/preview`}
                            allow="autoplay"
                            className="w-full aspect-video border-0"
                            title={video.name || video.id}
                          />
                          <a
                            href={video.webViewLink || `https://drive.google.com/file/d/${video.driveFileId}/view`}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-2 p-3 text-xs text-[#c8b8a8]"
                          >
                            <PlayCircle className="w-4 h-4 text-[#e6a15c]" />
                            {video.name || `Video ${new Date(video.createdAt).toLocaleDateString()}`}
                          </a>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </section>
            );
          })
        )}
      </div>
    </main>
  );
};
