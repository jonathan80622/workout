'use client';

import React, { useMemo, useState } from 'react';
import { NativeDriveVideo } from '../../components/NativeDriveVideo';
import { WorkoutAppState } from '../../types';

export default function PTNativeVideoTestPage() {
  const [password, setPassword] = useState('');
  const [state, setState] = useState<WorkoutAppState | null>(null);
  const [status, setStatus] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const dataFileId = useMemo(() => {
    if (typeof window === 'undefined') return '';
    return new URLSearchParams(window.location.search).get('dataFileId') || process.env.NEXT_PUBLIC_WORKOUT_DATA_FILE_ID || '';
  }, []);

  const load = async () => {
    if (!dataFileId) {
      setStatus('Missing dataFileId in the URL.');
      return;
    }

    setIsLoading(true);
    setStatus('Loading...');
    try {
      const response = await fetch('/api/pt-state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, dataFileId }),
      });
      const data = await response.json();
      if (!response.ok) {
        setStatus(data.error || 'Unable to load workout data.');
        return;
      }
      setState(data);
      setStatus('');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Unable to load workout data.');
    } finally {
      setIsLoading(false);
    }
  };

  const videos = state?.workouts.flatMap((workout) =>
    workout.exercises.flatMap((exercise) =>
      (exercise.videos || []).map((video) => ({ workout, exercise, video }))
    )
  ) || [];

  if (!state) {
    return (
      <main className="min-h-screen bg-[#0c0a09] text-[#f7f3ee] flex items-center justify-center px-4">
        <div className="w-full max-w-sm bg-[#181412] border border-[#382f29] rounded-3xl p-5 space-y-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-[#e6a15c]">Playback experiment</p>
            <h1 className="mt-1 text-xl font-serif font-bold">Native Drive video</h1>
            <p className="mt-2 text-xs text-[#a39588]">Uses the existing PT password. No Google sign-in.</p>
          </div>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            onKeyDown={(event) => { if (event.key === 'Enter') void load(); }}
            placeholder="PT portal password"
            className="w-full bg-[#100d0b] border border-[#2b241f] rounded-xl p-3 text-sm outline-none"
          />
          <button
            type="button"
            onClick={load}
            disabled={!password || isLoading}
            className="w-full rounded-xl bg-[#d97724] py-3 text-xs font-bold text-[#0c0a09] disabled:opacity-50"
          >
            {isLoading ? 'Loading...' : 'Open native-player test'}
          </button>
          {status && <p className="text-xs text-[#a39588]">{status}</p>}
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#0c0a09] text-[#f7f3ee] px-4 py-5">
      <div className="mx-auto max-w-3xl space-y-5">
        <header>
          <p className="text-xs font-bold uppercase tracking-wider text-[#e6a15c]">Playback experiment</p>
          <h1 className="text-2xl font-serif font-bold">Native Drive video</h1>
          <p className="mt-1 text-xs text-[#a39588]">
            Video bytes go from Google directly to this browser; Vercel only serves this page and the PT state request.
          </p>
        </header>

        {videos.length === 0 ? (
          <p className="rounded-2xl border border-[#382f29] bg-[#181412] p-4 text-sm text-[#a39588]">No workout videos found.</p>
        ) : (
          videos.map(({ workout, exercise, video }) => (
            <section key={video.id} className="overflow-hidden rounded-2xl border border-[#382f29] bg-[#181412]">
              <NativeDriveVideo video={video} className="w-full aspect-video" />
              <div className="p-3">
                <p className="text-sm font-bold">{exercise.machineName}</p>
                <p className="text-xs text-[#a39588]">{workout.title} · {new Date(workout.date).toLocaleDateString()}</p>
                <p className="mt-1 break-all font-mono text-[10px] text-[#6b5e54]">Drive file: {video.driveFileId}</p>
              </div>
            </section>
          ))
        )}
      </div>
    </main>
  );
}
