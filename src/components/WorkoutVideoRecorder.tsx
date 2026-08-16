'use client';

import React, { useRef, useState } from 'react';
import { PlayCircle, UploadCloud, Video } from 'lucide-react';
import { Workout, WorkoutVideo } from '../types';
import { uploadWorkoutVideo } from '../utils/driveStorage';

interface WorkoutVideoRecorderProps {
  workout: Workout;
  accessToken: string | null;
  videos: WorkoutVideo[];
  onVideoUploaded: (video: WorkoutVideo) => void;
}

export const WorkoutVideoRecorder: React.FC<WorkoutVideoRecorderProps> = ({
  workout,
  accessToken,
  videos,
  onVideoUploaded,
}) => {
  const [status, setStatus] = useState<string>('');
  const [isUploading, setIsUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const openVideoPicker = () => {
    if (!accessToken) {
      setStatus('Connect Google Drive before uploading a video.');
      return;
    }

    inputRef.current?.click();
  };

  const handleVideoSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !accessToken) return;

    try {
      setIsUploading(true);
      setStatus('Reading video details...');
      const durationSeconds = await getVideoDurationSeconds(file);
      setStatus('Uploading to Drive...');
      const video = await uploadWorkoutVideo({ accessToken, workout, file, durationSeconds });
      onVideoUploaded(video);
      setStatus('Saved to Drive.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Upload failed.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="bg-[#181412]/90 border border-[#382f29] rounded-3xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Video className="w-4 h-4 text-[#e6a15c]" />
          <span className="text-xs font-serif italic font-bold text-[#f7f3ee]">Workout Videos</span>
        </div>
        <span className="text-[10px] text-[#8c7e72]">{videos.length} saved</span>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="video/*"
        onChange={handleVideoSelected}
        className="hidden"
      />

      <div className="flex gap-2">
        <button
          type="button"
          onClick={openVideoPicker}
          disabled={isUploading}
          className="flex-1 py-3 rounded-2xl text-xs font-syne font-bold flex items-center justify-center gap-2 bg-[#211b18] text-[#e6a15c] border border-[#382f29] disabled:opacity-50"
        >
          <UploadCloud className="w-4 h-4" />
          {isUploading ? 'Uploading Video...' : 'Upload Video from Album'}
        </button>
        <div className="px-3 py-3 rounded-2xl bg-[#100d0b] border border-[#2b241f] text-[#8c7e72]">
          <Video className="w-4 h-4" />
        </div>
      </div>

      {status && <p className="text-[11px] text-[#a39588]">{status}</p>}

      {videos.length > 0 && (
        <div className="space-y-3">
          {videos.slice(0, 3).map((video) => (
            <div key={video.id} className="bg-[#100d0b] border border-[#2b241f] rounded-2xl overflow-hidden">
              <iframe
                src={`https://drive.google.com/file/d/${video.driveFileId}/preview`}
                allow="autoplay; fullscreen"
                className="w-full aspect-video border-0 bg-black"
                title={video.name || video.id}
              />
              <a
                href={video.webViewLink || `https://drive.google.com/file/d/${video.driveFileId}/view`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 px-3 py-2 text-[11px] text-[#c8b8a8] min-w-0"
              >
                <PlayCircle className="w-4 h-4 text-[#e6a15c] shrink-0" />
                <span className="truncate">
                  {video.name || `Video ${new Date(video.createdAt).toLocaleDateString()}`} · {formatDuration(video.durationSeconds)}
                </span>
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

function getVideoDurationSeconds(file: File): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(Number.isFinite(video.duration) ? Math.max(1, Math.round(video.duration)) : 0);
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(0);
    };
    video.src = url;
  });
}

function formatDuration(seconds: number): string {
  if (!seconds) return 'duration pending';
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}:${remainder.toString().padStart(2, '0')}`;
}
