'use client';

import React, { useRef, useState } from 'react';
import { Maximize2, Pause, Play, RotateCcw } from 'lucide-react';
import { WorkoutVideo } from '../types';

interface NativeDriveVideoProps {
  video: WorkoutVideo;
  className?: string;
}

type WebkitVideoElement = HTMLVideoElement & {
  webkitEnterFullscreen?: () => void;
};

export const NativeDriveVideo: React.FC<NativeDriveVideoProps> = ({ video, className }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const pinchStartDistanceRef = useRef<number | null>(null);
  const pinchStartScaleRef = useRef(1);
  const [failed, setFailed] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(video.durationSeconds || 0);
  const [scale, setScale] = useState(1);

  const mediaUrl = `https://drive.google.com/uc?export=download&id=${encodeURIComponent(video.driveFileId)}`;

  const togglePlayback = async () => {
    const element = videoRef.current;
    if (!element) return;
    if (element.paused) {
      await element.play();
    } else {
      element.pause();
    }
  };

  const seek = (nextTime: number) => {
    const element = videoRef.current;
    if (!element) return;
    element.currentTime = nextTime;
    setCurrentTime(nextTime);
  };

  const enterFullscreen = async () => {
    const wrapper = wrapperRef.current;
    const videoElement = videoRef.current as WebkitVideoElement | null;
    if (wrapper?.requestFullscreen) {
      await wrapper.requestFullscreen();
      return;
    }
    videoElement?.webkitEnterFullscreen?.();
  };

  const handleTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    if (event.touches.length !== 2) return;
    const [first, second] = [event.touches[0], event.touches[1]];
    pinchStartDistanceRef.current = Math.hypot(second.clientX - first.clientX, second.clientY - first.clientY);
    pinchStartScaleRef.current = scale;
  };

  const handleTouchMove = (event: React.TouchEvent<HTMLDivElement>) => {
    if (event.touches.length !== 2 || !pinchStartDistanceRef.current) return;
    const [first, second] = [event.touches[0], event.touches[1]];
    const distance = Math.hypot(second.clientX - first.clientX, second.clientY - first.clientY);
    const nextScale = Math.min(4, Math.max(1, pinchStartScaleRef.current * (distance / pinchStartDistanceRef.current)));
    setScale(nextScale);
  };

  const handleTouchEnd = (event: React.TouchEvent<HTMLDivElement>) => {
    if (event.touches.length < 2) pinchStartDistanceRef.current = null;
  };

  if (failed) {
    return (
      <div className={`flex items-center justify-center bg-black p-4 text-center ${className || ''}`}>
        <div className="space-y-2">
          <p className="text-xs text-[#c8b8a8]">Direct Drive playback failed on this browser.</p>
          <a
            href={video.webViewLink || `https://drive.google.com/file/d/${video.driveFileId}/view`}
            target="_blank"
            rel="noreferrer"
            className="text-xs font-bold text-[#e6a15c] underline"
          >
            Open the Drive copy
          </a>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={wrapperRef}
      className={`relative overflow-hidden bg-black ${className || ''}`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{ touchAction: scale > 1 ? 'none' : 'manipulation' }}
    >
      <video
        ref={videoRef}
        src={mediaUrl}
        playsInline
        preload="metadata"
        className="h-full w-full object-contain transition-transform duration-75"
        style={{ transform: `scale(${scale})` }}
        onClick={() => void togglePlayback()}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
        onLoadedMetadata={(event) => setDuration(event.currentTarget.duration || video.durationSeconds || 0)}
        onEnded={() => setIsPlaying(false)}
        onError={() => setFailed(true)}
      >
        Your browser does not support HTML video.
      </video>

      {!isPlaying && (
        <button
          type="button"
          onClick={() => void togglePlayback()}
          className="absolute inset-0 m-auto flex h-16 w-16 items-center justify-center rounded-full bg-black/65 text-white backdrop-blur-sm"
          aria-label="Play video"
        >
          <Play className="h-7 w-7 translate-x-0.5" />
        </button>
      )}

      <div className="absolute inset-x-0 bottom-0 flex items-center gap-2 bg-black/70 px-3 py-2 text-white backdrop-blur-sm">
        <button type="button" onClick={() => void togglePlayback()} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10" aria-label={isPlaying ? 'Pause' : 'Play'}>
          {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </button>
        <span className="w-10 shrink-0 text-right font-mono text-[10px]">{formatTime(currentTime)}</span>
        <input
          type="range"
          min={0}
          max={Math.max(duration, 0.1)}
          step={0.1}
          value={Math.min(currentTime, duration || currentTime)}
          onChange={(event) => seek(Number(event.target.value))}
          className="min-w-0 flex-1"
          aria-label="Video position"
        />
        <span className="w-10 shrink-0 font-mono text-[10px]">{formatTime(duration)}</span>
        {scale > 1 && (
          <button type="button" onClick={() => setScale(1)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10" aria-label="Reset zoom">
            <RotateCcw className="h-4 w-4" />
          </button>
        )}
        <button type="button" onClick={() => void enterFullscreen()} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10" aria-label="Fullscreen">
          <Maximize2 className="h-4 w-4" />
        </button>
      </div>

      {scale > 1 && (
        <div className="absolute right-3 top-3 rounded-full bg-black/65 px-2 py-1 font-mono text-[10px] text-white">
          {scale.toFixed(1)}×
        </div>
      )}
    </div>
  );
};

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const whole = Math.floor(seconds);
  const minutes = Math.floor(whole / 60);
  const remainder = whole % 60;
  return `${minutes}:${remainder.toString().padStart(2, '0')}`;
}
