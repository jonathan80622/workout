'use client';

import React, { useState } from 'react';
import { WorkoutVideo } from '../types';

interface NativeDriveVideoProps {
  video: WorkoutVideo;
  className?: string;
}

export const NativeDriveVideo: React.FC<NativeDriveVideoProps> = ({ video, className }) => {
  const [failed, setFailed] = useState(false);
  const mediaUrl = `/api/pt-video/${encodeURIComponent(video.driveFileId)}`;
  const thumbnailUrl = `/api/pt-video/${encodeURIComponent(video.driveFileId)}/thumbnail`;

  if (failed) {
    return (
      <div className={`flex items-center justify-center bg-black p-4 text-center ${className || ''}`}>
        <div className="space-y-2">
          <p className="text-xs text-[#c8b8a8]">Unable to load this video.</p>
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
    <video
      src={mediaUrl}
      poster={thumbnailUrl}
      controls
      playsInline
      preload="metadata"
      className={`bg-black object-contain ${className || ''}`}
      onError={() => setFailed(true)}
    >
      Your browser does not support HTML video.
    </video>
  );
};
