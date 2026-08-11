'use client';

import React, { useState } from 'react';
import { Calendar, Check, Download, ExternalLink, X, Sparkles, Feather, Bell } from 'lucide-react';
import { downloadICSFile, getGoogleCalendarUrl, ScheduledSession, formatFriendlyDateTime } from '../utils/calendar';

interface ScheduleCalendarModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTitle?: string;
  onSessionSaved?: (session: ScheduledSession) => void;
}

export const ScheduleCalendarModal: React.FC<ScheduleCalendarModalProps> = ({
  isOpen,
  onClose,
  defaultTitle = 'Workout Session',
  onSessionSaved
}) => {
  // Default to 2 days from now at 09:00 AM
  const getDefaultTargetDate = () => {
    const d = new Date();
    d.setDate(d.getDate() + 2);
    d.setHours(9, 0, 0, 0);
    return d;
  };

  const initialDate = getDefaultTargetDate();
  const [sessionTitle, setSessionTitle] = useState<string>(defaultTitle);
  const [dateString, setDateString] = useState<string>(initialDate.toISOString().split('T')[0]);
  const [timeString, setTimeString] = useState<string>('09:00');
  const [durationMinutes, setDurationMinutes] = useState<number>(45);
  const [intentionNote, setIntentionNote] = useState<string>('Focus on slow eccentrics, core bracing, and controlled form.');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const getConstructedStartDate = (): Date => {
    const [year, month, day] = dateString.split('-').map(Number);
    const [hours, minutes] = timeString.split(':').map(Number);
    return new Date(year, month - 1, day, hours, minutes, 0);
  };

  const handleSaveToDeviceCalendar = () => {
    const startDate = getConstructedStartDate();
    const session: ScheduledSession = {
      title: sessionTitle || 'Workout Session',
      scheduledDate: startDate.toISOString(),
      notes: intentionNote,
    };

    if (onSessionSaved) onSessionSaved(session);

    // Download .ics file for iOS Calendar / macOS / Android / Windows
    downloadICSFile({
      title: `🏋️ ${session.title}`,
      description: `Workout Intention:\n"${intentionNote}"\n\nExported from Workout Tracker.`,
      startDate,
      durationMinutes
    });

    setToastMessage('📅 Downloaded .ics file! Open it to add to iOS/Android Calendar.');
    setTimeout(() => {
      onClose();
    }, 1800);
  };

  const handleOpenGoogleCalendar = () => {
    const startDate = getConstructedStartDate();
    const session: ScheduledSession = {
      title: sessionTitle || 'Workout Session',
      scheduledDate: startDate.toISOString(),
      notes: intentionNote,
    };

    if (onSessionSaved) onSessionSaved(session);

    const googleUrl = getGoogleCalendarUrl({
      title: `🏋️ ${session.title}`,
      description: `Workout Intention:\n"${intentionNote}"\n\nExported from Workout Tracker.`,
      startDate,
      durationMinutes
    });

    window.open(googleUrl, '_blank', 'noopener,noreferrer');
    setToastMessage('Opening Google Calendar...');
    setTimeout(() => {
      onClose();
    }, 1500);
  };

  const handleSaveAppOnly = () => {
    const startDate = getConstructedStartDate();
    const session: ScheduledSession = {
      title: sessionTitle || 'Workout Session',
      scheduledDate: startDate.toISOString(),
      notes: intentionNote,
    };

    if (onSessionSaved) onSessionSaved(session);

    setToastMessage('✨ Next workout saved!');
    setTimeout(() => {
      onClose();
    }, 1200);
  };

  const startDatePreview = getConstructedStartDate();

  return (
    <div className="fixed inset-0 z-50 bg-[#0c0a09]/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="relative w-full max-w-md bg-[#181412] border border-[#382f29] rounded-3xl shadow-2xl p-5 my-auto max-h-[92vh] overflow-y-auto space-y-4">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full bg-[#211b18] text-[#8c7e72] hover:text-[#f7f3ee] transition-colors border border-[#382f29]"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-full bg-[#d97724]/20 text-[#e6a15c] border border-[#d97724]/40 shrink-0">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-serif font-bold text-[#f7f3ee] flex items-center gap-2">
              Schedule Next Session
            </h3>
            <p className="text-xs text-[#a39588] font-light">
              Save your upcoming movement practice directly to your device calendar to build consistency.
            </p>
          </div>
        </div>

        {/* Toast Alert Banner */}
        {toastMessage && (
          <div className="bg-[#849a88]/20 border border-[#849a88]/40 text-[#e8f0e9] text-xs font-medium px-4 py-2.5 rounded-2xl flex items-center justify-between animate-fade-in">
            <span>{toastMessage}</span>
            <Check className="w-4 h-4 text-[#849a88]" />
          </div>
        )}

        {/* Inputs */}
        <div className="bg-[#100d0b] border border-[#2b241f] rounded-2xl p-4 space-y-3.5 text-xs">
          {/* Title Input */}
          <div>
            <label className="font-syne font-semibold text-[#c8b8a8] block mb-1">
              Session Focus / Title
            </label>
            <input
              type="text"
              value={sessionTitle}
              onChange={(e) => setSessionTitle(e.target.value)}
              placeholder="e.g. Leg Day & Upper Body Focus"
              className="w-full bg-[#181412] border border-[#2b241f] rounded-xl px-3 py-2.5 text-xs text-[#f7f3ee] placeholder-[#6b5e54] focus:outline-none focus:ring-1 focus:ring-[#d97724]"
            />
          </div>

          {/* Date & Time Selection */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="font-syne font-semibold text-[#c8b8a8] block mb-1">
                Target Date
              </label>
              <input
                type="date"
                value={dateString}
                onChange={(e) => setDateString(e.target.value)}
                className="w-full bg-[#181412] border border-[#2b241f] rounded-xl px-3 py-2 text-xs text-[#f7f3ee] focus:outline-none focus:ring-1 focus:ring-[#d97724]"
              />
            </div>

            <div>
              <label className="font-syne font-semibold text-[#c8b8a8] block mb-1">
                Start Time
              </label>
              <input
                type="time"
                value={timeString}
                onChange={(e) => setTimeString(e.target.value)}
                className="w-full bg-[#181412] border border-[#2b241f] rounded-xl px-3 py-2 text-xs text-[#f7f3ee] focus:outline-none focus:ring-1 focus:ring-[#d97724]"
              />
            </div>
          </div>

          {/* Duration Selector */}
          <div>
            <label className="font-syne font-semibold text-[#c8b8a8] block mb-1">
              Target Duration
            </label>
            <div className="grid grid-cols-4 gap-1.5">
              {[30, 45, 60, 90].map((mins) => (
                <button
                  key={mins}
                  type="button"
                  onClick={() => setDurationMinutes(mins)}
                  className={`py-1.5 rounded-xl font-syne text-[11px] font-bold border transition-all ${
                    durationMinutes === mins
                      ? 'bg-[#d97724] text-[#0c0a09] border-[#e6a15c]'
                      : 'bg-[#181412] text-[#8c7e72] border-[#2b241f]'
                  }`}
                >
                  {mins} mins
                </button>
              ))}
            </div>
          </div>

          {/* Practice Intention Note */}
          <div>
            <label className="font-serif italic text-[#c8b8a8] flex items-center gap-1 mb-1">
              <Feather className="w-3.5 h-3.5 text-[#d97724]" /> Intention / Focus Note
            </label>
            <textarea
              rows={2}
              value={intentionNote}
              onChange={(e) => setIntentionNote(e.target.value)}
              placeholder="e.g. Focus on deep diaphragmatic breathing and mind-muscle connection."
              className="w-full bg-[#181412] border border-[#2b241f] rounded-xl p-2.5 text-xs text-[#f7f3ee] placeholder-[#6b5e54] focus:outline-none focus:ring-1 focus:ring-[#d97724] resize-none"
            />
          </div>

          {/* Formatted Date Preview Banner */}
          <div className="bg-[#181412] border border-[#2b241f] p-3 rounded-xl flex items-center gap-2 text-[11px] text-[#e6a15c]">
            <Bell className="w-4 h-4 shrink-0 text-[#d97724]" />
            <div>
              <span className="font-semibold text-[#f7f3ee] block">Scheduled Target:</span>
              <span>{formatFriendlyDateTime(startDatePreview)} ({durationMinutes} mins)</span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2">
          <button
            onClick={handleSaveToDeviceCalendar}
            className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-[#d97724] via-[#c86d51] to-[#e6a15c] hover:opacity-95 text-[#0c0a09] font-syne font-bold text-xs flex items-center justify-center gap-2 shadow-xl shadow-[#d97724]/20 transition-all"
          >
            <Download className="w-4 h-4 text-[#0c0a09]" /> Add to Device Calendar (.ics file)
          </button>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handleOpenGoogleCalendar}
              className="py-2.5 px-3 rounded-2xl bg-[#211b18] hover:bg-[#2c2420] text-[#f7f3ee] font-syne font-semibold text-[11px] flex items-center justify-center gap-1.5 border border-[#382f29] transition-all"
            >
              <ExternalLink className="w-3.5 h-3.5 text-[#e6a15c]" /> Google Calendar
            </button>

            <button
              onClick={handleSaveAppOnly}
              className="py-2.5 px-3 rounded-2xl bg-[#181412] hover:bg-[#211b18] text-[#8c7e72] hover:text-[#f7f3ee] font-syne font-semibold text-[11px] flex items-center justify-center gap-1 border border-[#2b241f] transition-all"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#849a88]" /> Save App Reminder
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
