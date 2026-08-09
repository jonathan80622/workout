import { Workout, ExerciseLog, WeightUnit } from '../types';

export function calculateWorkoutVolume(workout: Workout): number {
  return workout.exercises.reduce((accEx, ex) => {
    const exVolume = ex.sets.reduce((accSet, set) => {
      if (set.completed && set.weight > 0 && set.reps > 0) {
        return accSet + (set.weight * set.reps);
      }
      return accSet;
    }, 0);
    return accEx + exVolume;
  }, 0);
}

export function calculateCompletedSets(workout: Workout): number {
  return workout.exercises.reduce((acc, ex) => {
    return acc + ex.sets.filter(s => s.completed).length;
  }, 0);
}

export function calculateCompletedReps(workout: Workout): number {
  return workout.exercises.reduce((accEx, ex) => {
    return accEx + ex.sets.reduce((accSet, set) => set.completed ? accSet + set.reps : accSet, 0);
  }, 0);
}

export function getHeaviestSet(workout: Workout): { weight: number; reps: number; machineName: string } | null {
  let maxWeight = 0;
  let best: { weight: number; reps: number; machineName: string } | null = null;

  workout.exercises.forEach(ex => {
    ex.sets.forEach(set => {
      if (set.completed && set.weight > maxWeight) {
        maxWeight = set.weight;
        best = { weight: set.weight, reps: set.reps, machineName: ex.machineName };
      }
    });
  });

  return best;
}

export interface DayOfWeekTheme {
  dayIndex: number; // 0=Sun, 1=Mon, ..., 6=Sat
  dayNameEn: string;
  dayNameZh: string;
  shortDayEn: string;
  shortDayZh: string;
  borderColor: string;
  glowColor: string;
  badgeBg: string;
  gradientHeader: string;
}

export const DAY_THEMES: Record<number, DayOfWeekTheme> = {
  0: {
    dayIndex: 0,
    dayNameEn: 'SUNDAY',
    dayNameZh: '星期日',
    shortDayEn: 'SUN',
    shortDayZh: '週日',
    borderColor: '#f43f5e', // Vibrant Rose/Crimson
    glowColor: 'rgba(244, 63, 94, 0.45)',
    badgeBg: 'bg-[#f43f5e]/20 text-[#fda4af] border-[#f43f5e]/50',
    gradientHeader: 'from-[#be123c] via-[#f43f5e] to-[#fb7185]'
  },
  1: {
    dayIndex: 1,
    dayNameEn: 'MONDAY',
    dayNameZh: '星期一',
    shortDayEn: 'MON',
    shortDayZh: '週一',
    borderColor: '#f59e0b', // Flame Amber
    glowColor: 'rgba(245, 158, 11, 0.45)',
    badgeBg: 'bg-[#f59e0b]/20 text-[#fde68a] border-[#f59e0b]/50',
    gradientHeader: 'from-[#b45309] via-[#d97724] to-[#f59e0b]'
  },
  2: {
    dayIndex: 2,
    dayNameEn: 'TUESDAY',
    dayNameZh: '星期二',
    shortDayEn: 'TUE',
    shortDayZh: '週二',
    borderColor: '#10b981', // Emerald Sage
    glowColor: 'rgba(16, 185, 129, 0.45)',
    badgeBg: 'bg-[#10b981]/20 text-[#a7f3d0] border-[#10b981]/50',
    gradientHeader: 'from-[#047857] via-[#10b981] to-[#34d399]'
  },
  3: {
    dayIndex: 3,
    dayNameEn: 'WEDNESDAY',
    dayNameZh: '星期三',
    shortDayEn: 'WED',
    shortDayZh: '週三',
    borderColor: '#06b6d4', // Cyan Teal
    glowColor: 'rgba(6, 182, 212, 0.45)',
    badgeBg: 'bg-[#06b6d4]/20 text-[#a5f3fc] border-[#06b6d4]/50',
    gradientHeader: 'from-[#0e7490] via-[#06b6d4] to-[#22d3ee]'
  },
  4: {
    dayIndex: 4,
    dayNameEn: 'THURSDAY',
    dayNameZh: '星期四',
    shortDayEn: 'THU',
    shortDayZh: '週四',
    borderColor: '#6366f1', // Royal Indigo
    glowColor: 'rgba(99, 102, 241, 0.45)',
    badgeBg: 'bg-[#6366f1]/20 text-[#c7d2fe] border-[#6366f1]/50',
    gradientHeader: 'from-[#3730a3] via-[#6366f1] to-[#818cf8]'
  },
  5: {
    dayIndex: 5,
    dayNameEn: 'FRIDAY',
    dayNameZh: '星期五',
    shortDayEn: 'FRI',
    shortDayZh: '週五',
    borderColor: '#8b5cf6', // Violet Amethyst
    glowColor: 'rgba(139, 92, 246, 0.45)',
    badgeBg: 'bg-[#8b5cf6]/20 text-[#ddd6fe] border-[#8b5cf6]/50',
    gradientHeader: 'from-[#5b21b6] via-[#8b5cf6] to-[#a78bfa]'
  },
  6: {
    dayIndex: 6,
    dayNameEn: 'SATURDAY',
    dayNameZh: '星期六',
    shortDayEn: 'SAT',
    shortDayZh: '週六',
    borderColor: '#eab308', // Sunlit Gold
    glowColor: 'rgba(234, 179, 8, 0.45)',
    badgeBg: 'bg-[#eab308]/20 text-[#fef08a] border-[#eab308]/50',
    gradientHeader: 'from-[#a16207] via-[#ca8a04] to-[#facc15]'
  }
};

export function parseDateSafely(dateInput?: string | Date): Date {
  if (!dateInput) return new Date();
  if (dateInput instanceof Date) {
    return isNaN(dateInput.getTime()) ? new Date() : dateInput;
  }
  const str = String(dateInput).trim();
  if (!str) return new Date();

  // If YYYY-MM-DD format, parse as local year, month, day to prevent UTC midnight offset shift
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const [y, m, d] = str.split('-').map(Number);
    return new Date(y, m - 1, d, 12, 0, 0);
  }

  const parsed = new Date(str);
  return isNaN(parsed.getTime()) ? new Date() : parsed;
}

export function getDayOfWeekTheme(dateString?: string): DayOfWeekTheme {
  const d = parseDateSafely(dateString);
  const day = d.getDay();
  return DAY_THEMES[day] || DAY_THEMES[0];
}

export function formatDateEn(dateString?: string): string {
  const d = parseDateSafely(dateString);
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  }).format(d);
}

export function formatDateZh(dateString?: string): string {
  const d = parseDateSafely(dateString);
  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  const day = d.getDate();
  return `${year} 年 ${month} 月 ${day} 日`;
}

export function formatWorkoutDate(dateString: string): string {
  try {
    const date = parseDateSafely(dateString);
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    }).format(date);
  } catch (e) {
    return dateString;
  }
}

export function formatShortDate(dateString: string): string {
  try {
    const date = parseDateSafely(dateString);
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric'
    }).format(date);
  } catch (e) {
    return dateString;
  }
}

export function calculateTotalDistance(workout: Workout): number {
  if (workout.runningDistance && workout.runningDistance > 0) {
    return workout.runningDistance;
  }
  let totalDist = 0;
  workout.exercises.forEach(ex => {
    if (ex.distance && ex.distance > 0) {
      totalDist += ex.distance;
    }
    ex.sets.forEach(set => {
      if (set.completed && set.distance && set.distance > 0) {
        totalDist += set.distance;
      }
    });
  });
  return Math.round(totalDist * 100) / 100;
}

export function calculateTotalRunningTime(workout: Workout): number {
  if (workout.runningTimeMinutes && workout.runningTimeMinutes > 0) {
    return workout.runningTimeMinutes;
  }
  let totalTime = 0;
  workout.exercises.forEach(ex => {
    if (ex.runningTimeMinutes && ex.runningTimeMinutes > 0) {
      totalTime += ex.runningTimeMinutes;
    }
    ex.sets.forEach(set => {
      if (set.completed && set.runningTimeMinutes && set.runningTimeMinutes > 0) {
        totalTime += set.runningTimeMinutes;
      }
    });
  });
  return Math.round(totalTime);
}

export function calculateAveragePace(distance: number, timeMinutes: number): string {
  if (!distance || distance <= 0 || !timeMinutes || timeMinutes <= 0) return 'N/A';
  const paceTotalMin = timeMinutes / distance;
  const paceMin = Math.floor(paceTotalMin);
  const paceSec = Math.round((paceTotalMin - paceMin) * 60);
  const paddedSec = paceSec < 10 ? `0${paceSec}` : `${paceSec}`;
  return `${paceMin}:${paddedSec}`;
}

export function convertWeight(value: number, from: WeightUnit, to: WeightUnit): number {
  if (from === to) return value;
  if (from === 'lbs' && to === 'kg') return Math.round(value * 0.453592 * 10) / 10;
  if (from === 'kg' && to === 'lbs') return Math.round(value * 2.20462);
  return value;
}

export function translateSeatSettings(seatSettings?: string, isZh: boolean = true): string {
  if (!seatSettings) return '';
  if (!isZh) return seatSettings;

  let translated = seatSettings;

  const termsMap: [RegExp, string][] = [
    [/Seat Angle/gi, '座椅角度'],
    [/Seat Height/gi, '座椅高度'],
    [/Seat Pin/gi, '座椅插銷'],
    [/Backrest Notch/gi, '靠背刻度'],
    [/Backrest/gi, '靠背刻度'],
    [/Notch/gi, '刻度'],
    [/Thigh Pad/gi, '大腿壓板'],
    [/Shin Pad/gi, '小腿擋板'],
    [/Shoulder Pad/gi, '肩部墊片'],
    [/Arm Pad Lock/gi, '手臂卡槽'],
    [/Arm Pad/gi, '手臂墊'],
    [/Foot Plate/gi, '腳踏板'],
    [/Foot placement/gi, '腳踏位置'],
    [/Handles at Mid-Chest/gi, '把手對齊胸中'],
    [/V-Bar Handle/gi, 'V型拉把'],
    [/Arm Arms Position/gi, '擺臂角度'],
    [/Arm Position/gi, '擺臂角度'],
    [/Safety Stoppers/gi, '安全卡扣'],
    [/High Cable Pulley/gi, '高位滑輪'],
    [/High Pulley/gi, '高位滑輪'],
    [/Low Pulley/gi, '低位滑輪'],
    [/Rope Attachment/gi, '繩索配件'],
    [/Single Handle Attachment/gi, '單手把手'],
    [/Single Handle/gi, '單手把手'],
    [/Lower middle/gi, '中下方'],
    [/GPS Tracked/gi, 'GPS 軌跡追蹤'],
    [/Speed/gi, '速度'],
    [/Incline/gi, '坡度'],
    [/Lock/gi, '卡槽'],
    [/Pin/gi, '插銷'],
    [/Alignment/gi, '姿態校準']
  ];

  for (const [regex, zh] of termsMap) {
    translated = translated.replace(regex, zh);
  }

  return translated;
}

