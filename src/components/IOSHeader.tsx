'use client';

import React, { useState, useEffect } from 'react';
import { Sparkles, Timer, User, Compass } from 'lucide-react';

interface IOSHeaderProps {
  title: string;
  isTimerRunning?: boolean;
  timerSeconds?: number;
  clientName: string;
  ptName: string;
  onOpenProfileModal?: () => void;
}

export const IOSHeader: React.FC<IOSHeaderProps> = ({
  title,
  isTimerRunning = false,
  timerSeconds = 0,
  clientName,
  ptName,
  onOpenProfileModal
}) => {
  const [currentTime, setCurrentTime] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }));
    };
    updateTime();
    const interval = setInterval(updateTime, 10000);
    return () => clearInterval(interval);
  }, []);

  const formatTimer = (totalSecs: number) => {
    const hrs = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <header className="sticky top-0 z-40 bg-[#120f0d]/90 backdrop-blur-xl border-b border-[#2b241f] text-[#f7f3ee] select-none">
      {/* Top Bar with Time & App Title */}
      <div className="flex items-center justify-between px-5 pt-2 pb-1 text-[11px] text-[#a39588] font-medium tracking-wide">
        <span className="font-syne font-semibold text-[#c8b8a8]">{currentTime || '9:41'}</span>
        <div className="flex items-center gap-1.5 text-[#d97724] font-serif italic text-xs">
          <Sparkles className="w-3 h-3 text-[#e6a15c] animate-pulse" />
          <span>Workout & PT Studio</span>
        </div>
      </div>

      {/* Main Bar */}
      <div className="flex items-center justify-between px-4 py-2.5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-[#d97724] via-[#c86d51] to-[#e6a15c] p-0.5 shadow-lg shadow-[#d97724]/20 flex items-center justify-center">
            <div className="w-full h-full rounded-full bg-[#181412] flex items-center justify-center">
              <Compass className="w-4 h-4 text-[#e6a15c]" />
            </div>
          </div>
          <div>
            <h1 className="text-lg font-serif tracking-tight text-[#f7f3ee] font-semibold leading-tight">
              {title || 'Workout Tracker'}
            </h1>
            <p className="text-[11px] text-[#a8998c] flex items-center gap-1.5 font-light">
              <span>Athlete: <strong className="text-[#e8e0d5] font-medium">{clientName || 'Me'}</strong></span>
              <span className="text-[#4a3f36]">•</span>
              <span>Coach/PT: <strong className="text-[#e6a15c] font-medium">{ptName || 'Coach'}</strong></span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Active Workout Timer Badge if running */}
          {isTimerRunning && (
            <div className="flex items-center gap-1.5 bg-[#d97724]/15 border border-[#d97724]/40 text-[#f5c999] px-2.5 py-1 rounded-full text-xs font-mono font-semibold animate-pulse">
              <Timer className="w-3.5 h-3.5 text-[#e6a15c]" />
              <span>{formatTimer(timerSeconds)}</span>
            </div>
          )}

          {/* Profile / Guide config button */}
          <button
            onClick={onOpenProfileModal}
            className="p-2 rounded-full bg-[#1c1815] hover:bg-[#28221d] text-[#c8b8a8] hover:text-[#f7f3ee] transition-colors border border-[#382f29]"
            title="Edit Coach & Client Settings"
          >
            <User className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
