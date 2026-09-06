'use client';

import React from 'react';
import { WorkoutVideo } from '../types';

interface NativeDriveVideoProps {
  video: WorkoutVideo;
  className?: string;
}

export const NativeDriveVideo: React.FC<NativeDriveVideoProps> = ({ video, className }) => (
  <iframe
    src={`https://drive.google.com/file/d/${encodeURIComponent(video.driveFileId)}/preview`}
    allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
    allowFullScreen
    className={`border-0 bg-black ${className || ''}`}
    title={video.name || video.id}
  />
);
