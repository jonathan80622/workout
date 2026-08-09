import React from 'react';
import { Calendar, Clock, Download, ExternalLink, Sparkles, Feather, ArrowRight, X } from 'lucide-react';
import { ScheduledSession, formatFriendlyDateTime, downloadICSFile, getGoogleCalendarUrl, saveScheduledSession } from '../utils/calendar';

interface NextSessionBannerProps {
  scheduledSession: ScheduledSession | null;
  onOpenScheduleModal: () => void;
  onClearSession: () => void;
  onStartSessionNow: () => void;
}

export const NextSessionBanner: React.FC<NextSessionBannerProps> = ({
  scheduledSession,
  onOpenScheduleModal,
  onClearSession,
  onStartSessionNow
}) => {
  if (!scheduledSession) {
    return (
      <div className="bg-[#181412]/80 border border-[#382f29] rounded-3xl p-4 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-full bg-[#d97724]/15 text-[#e6a15c] border border-[#d97724]/30">
            <Calendar className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[10px] font-syne font-bold uppercase text-[#a39588] tracking-wider block">
              Movement Consistency
            </span>
            <span className="text-xs font-serif font-semibold text-[#f7f3ee] block">
              No upcoming session scheduled
            </span>
          </div>
        </div>

        <button
          onClick={onOpenScheduleModal}
          className="px-3 py-1.5 bg-[#211b18] hover:bg-[#2c2420] text-[#e6a15c] border border-[#d97724]/40 rounded-2xl text-xs font-syne font-semibold flex items-center gap-1 transition-all"
        >
          <Calendar className="w-3.5 h-3.5" /> Schedule
        </button>
      </div>
    );
  }

  const sessionDate = new Date(scheduledSession.dateIso);
  const isToday = new Date().toDateString() === sessionDate.toDateString();

  const handleDownloadICS = () => {
    downloadICSFile({
      title: `🏋️ ${scheduledSession.title}`,
      description: `Workout Session Intention:\n"${scheduledSession.notes || ''}"\n\nExported from Workout Tracker.`,
      startDate: sessionDate,
      durationMinutes: scheduledSession.durationMinutes || 45
    });
  };

  const handleGoogleCalendar = () => {
    const url = getGoogleCalendarUrl({
      title: `🏋️ ${scheduledSession.title}`,
      description: `Workout Session Intention:\n"${scheduledSession.notes || ''}"\n\nExported from Workout Tracker.`,
      startDate: sessionDate,
      durationMinutes: scheduledSession.durationMinutes || 45
    });
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="bg-gradient-to-br from-[#211b18] via-[#181412] to-[#100d0b] border border-[#d97724]/40 rounded-3xl p-4 shadow-xl space-y-3 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-28 h-28 bg-[#d97724]/10 rounded-full blur-2xl pointer-events-none" />

      {/* Top row */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-2xl bg-[#d97724] text-[#0c0a09] shadow-md">
            <Calendar className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-syne font-bold uppercase text-[#e6a15c] tracking-wider">
                Next Scheduled Session
              </span>
              {isToday && (
                <span className="text-[9px] bg-[#d97724] text-[#0c0a09] font-bold px-2 py-0.2 rounded-full uppercase">
                  Today
                </span>
              )}
            </div>
            <h4 className="text-sm font-serif font-bold text-[#f7f3ee]">
              {scheduledSession.title}
            </h4>
          </div>
        </div>

        <button
          onClick={onClearSession}
          className="p-1 text-[#8c7e72] hover:text-[#c86d51] rounded-lg transition-colors"
          title="Clear scheduled session"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Date & Time info */}
      <div className="bg-[#100d0b] border border-[#2b241f] p-2.5 rounded-2xl flex items-center justify-between text-xs font-mono">
        <div className="flex items-center gap-1.5 text-[#e6a15c]">
          <Clock className="w-3.5 h-3.5" />
          <span className="font-sans text-xs font-medium text-[#f7f3ee]">
            {formatFriendlyDateTime(sessionDate)}
          </span>
        </div>
        <span className="text-[11px] text-[#849a88] font-sans font-semibold">
          {scheduledSession.durationMinutes} mins
        </span>
      </div>

      {/* Note if present */}
      {scheduledSession.notes && (
        <p className="text-[11px] text-[#a39588] font-serif italic line-clamp-1 px-1">
          "{scheduledSession.notes}"
        </p>
      )}

      {/* Quick Action buttons */}
      <div className="flex items-center gap-2 pt-1 border-t border-[#2b241f]">
        <button
          onClick={handleDownloadICS}
          className="flex-1 py-2 px-3 bg-[#d97724]/20 hover:bg-[#d97724]/30 text-[#f5c999] border border-[#d97724]/40 rounded-xl text-xs font-syne font-semibold flex items-center justify-center gap-1 transition-all"
        >
          <Download className="w-3.5 h-3.5 text-[#e6a15c]" /> Save .ics to Calendar
        </button>

        <button
          onClick={onStartSessionNow}
          className="py-2 px-3 bg-[#849a88] hover:bg-[#a3b8a7] text-[#0c0a09] rounded-xl text-xs font-syne font-bold flex items-center justify-center gap-1 transition-all shrink-0"
        >
          Begin Now <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
