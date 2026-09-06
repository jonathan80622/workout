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

  if (failed) {
    return (
      <div className={`flex items-center justify-center bg-black p-4 text-center ${className || ''}`}>
        <div className="space-y-2">
          <p className="text-xs text-[#c8b8a8]">Unable to load this video.</p>
          <p className="text-[10px] text-[#8c7e72]">The workout owner may need to re-authorize Drive playback.</p>
        </div>
      </div>
    );
  }

  return (
    <video
      src={mediaUrl}
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
