export interface ScheduledSession {
  title: string;
  dateIso: string; // ISO string representing target start time
  durationMinutes: number;
  notes?: string;
  createdAtIso: string;
}

const SCHEDULED_SESSION_KEY = 'ios_workout_tracker_next_session_v1';

export function loadScheduledSession(): ScheduledSession | null {
  try {
    const raw = localStorage.getItem(SCHEDULED_SESSION_KEY);
    if (!raw) return null;
    const session: ScheduledSession = JSON.parse(raw);
    // If date is in the past, return null
    if (new Date(session.dateIso).getTime() < Date.now() - 3600 * 1000) {
      return null;
    }
    return session;
  } catch (err) {
    console.error('Failed to load scheduled session:', err);
    return null;
  }
}

export function saveScheduledSession(session: ScheduledSession | null): void {
  try {
    if (session) {
      localStorage.setItem(SCHEDULED_SESSION_KEY, JSON.stringify(session));
    } else {
      localStorage.removeItem(SCHEDULED_SESSION_KEY);
    }
  } catch (err) {
    console.error('Failed to save scheduled session:', err);
  }
}

/**
 * Format a Date object to ICS UTC timestamp: YYYYMMDDTHHMMSSZ
 */
function toICSDateString(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

/**
 * Generate and download an iCalendar (.ics) file for iOS/Android/macOS/Windows calendar apps.
 */
export function downloadICSFile(params: {
  title: string;
  description: string;
  startDate: Date;
  durationMinutes: number;
}) {
  const { title, description, startDate, durationMinutes } = params;
  const endDate = new Date(startDate.getTime() + durationMinutes * 60 * 1000);

  const startICS = toICSDateString(startDate);
  const endICS = toICSDateString(endDate);
  const nowICS = toICSDateString(new Date());

  const cleanTitle = title.replace(/\n/g, ' ');
  const cleanDesc = description.replace(/\n/g, '\\n');

  const icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Workout Tracker//Session Log//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:workout-session-${Date.now()}@workouttracker.app`,
    `DTSTAMP:${nowICS}`,
    `DTSTART:${startICS}`,
    `DTEND:${endICS}`,
    `SUMMARY:${cleanTitle}`,
    `DESCRIPTION:${cleanDesc}`,
    'STATUS:CONFIRMED',
    'SEQUENCE:0',
    'BEGIN:VALARM',
    'TRIGGER:-PT30M',
    'ACTION:DISPLAY',
    `DESCRIPTION:Reminder: ${cleanTitle} in 30 minutes`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n');

  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const safeFilename = title.toLowerCase().replace(/[^a-z0-9]/g, '_');
  link.download = `workout_session_${safeFilename}.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Generate Google Calendar Web URL
 */
export function getGoogleCalendarUrl(params: {
  title: string;
  description: string;
  startDate: Date;
  durationMinutes: number;
}): string {
  const { title, description, startDate, durationMinutes } = params;
  const endDate = new Date(startDate.getTime() + durationMinutes * 60 * 1000);

  const startICS = toICSDateString(startDate);
  const endICS = toICSDateString(endDate);

  const baseUrl = 'https://calendar.google.com/calendar/render';
  const queryParams = new URLSearchParams({
    action: 'TEMPLATE',
    text: title,
    dates: `${startICS}/${endICS}`,
    details: description
  });

  return `${baseUrl}?${queryParams.toString()}`;
}

/**
 * Format a Date for human readable display
 */
export function formatFriendlyDateTime(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  }).format(date);
}
