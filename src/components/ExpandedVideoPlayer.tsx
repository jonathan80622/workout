'use client';

import React from 'react';
import { Minimize2, X } from 'lucide-react';
import { WorkoutVideo } from '../types';

export function ExpandedVideoPlayer({ video, onClose }: { video: WorkoutVideo | null; onClose: () => void }) {
  if (!video) return null;
  return <div className="fixed inset-0 z-50 bg-[#0c0a09] p-3 sm:p-5 flex flex-col">
    <div className="max-w-6xl w-full mx-auto flex items-center justify-between gap-3 pb-3">
      <div className="min-w-0"><p className="truncate text-sm font-bold text-[#f7f3ee]">{video.name || 'Workout video'}</p><p className="text-[10px] text-[#8c7e72]">Expanded player</p></div>
      <button type="button" onClick={onClose} className="h-10 px-3 rounded-full bg-[#181412] border border-[#382f29] text-[#f7f3ee] flex items-center gap-2 hover:bg-[#211b18]" title="Close expanded player"><Minimize2 className="w-4 h-4" /><X className="w-4 h-4" /></button>
    </div>
    <div className="max-w-6xl w-full mx-auto flex-1 min-h-0 bg-black border border-[#382f29] rounded-2xl overflow-hidden">
      <iframe src={`https://drive.google.com/file/d/${video.driveFileId}/preview`} allow="autoplay; fullscreen; encrypted-media; picture-in-picture" allowFullScreen sandbox="allow-scripts allow-same-origin allow-presentation" className="w-full h-full border-0 bg-black" title={video.name || video.id} />
    </div>
  </div>;
}
