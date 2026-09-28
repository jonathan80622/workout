'use client';

import React, { useMemo, useState } from 'react';
import { ChevronDown, TrendingUp } from 'lucide-react';
import { ExerciseLog, SetType, WeightUnit, Workout } from '../types';
import { convertWeight, formatWorkoutDate } from '../utils/formatters';

interface ExerciseLoadHistoryProps {
  exercise: ExerciseLog;
  workouts: Workout[];
}

type HistorySession = {
  id: string;
  date: string;
  sets: Array<{ type: SetType; weight: number; reps: number; unit: WeightUnit }>;
  topWeight: number;
  topReps: number;
};

/** A compact, in-context progression view for an exercise being logged. */
export const ExerciseLoadHistory: React.FC<ExerciseLoadHistoryProps> = ({ exercise, workouts }) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const displayUnit = exercise.sets.find((set) => set.weight > 0)?.weightUnit || 'lbs';

  const sessions = useMemo<HistorySession[]>(() => {
    const normalizedName = exercise.machineName.trim().toLocaleLowerCase();
    if (!normalizedName || exercise.category === 'Cardio & Running') return [];

    return workouts
      .filter((workout) => workout.isCompleted)
      .flatMap((workout) => workout.exercises
        .filter((pastExercise) => pastExercise.machineName.trim().toLocaleLowerCase() === normalizedName)
        .map((pastExercise) => {
          const sets = pastExercise.sets
            .filter((set) => set.completed && set.weight > 0 && set.reps > 0)
            .map((set) => ({
              type: set.type,
              weight: convertWeight(set.weight, set.weightUnit, displayUnit),
              reps: set.reps,
              unit: displayUnit,
            }));
          const topSet = sets.reduce<(typeof sets)[number] | null>(
            (best, set) => !best || set.weight > best.weight || (set.weight === best.weight && set.reps > best.reps) ? set : best,
            null,
          );
          return topSet ? {
            id: `${workout.id}-${pastExercise.id}`,
            date: workout.date,
            sets,
            topWeight: topSet.weight,
            topReps: topSet.reps,
          } : null;
        }))
      .filter((session): session is HistorySession => session !== null)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [displayUnit, exercise.category, exercise.machineName, workouts]);

  if (sessions.length === 0) return null;

  const recentSessions = [...sessions].reverse().slice(0, 6);
  const chartSessions = sessions.slice(-8);
  const minWeight = Math.min(...chartSessions.map((session) => session.topWeight));
  const maxWeight = Math.max(...chartSessions.map((session) => session.topWeight));
  const chartWidth = 280;
  const chartHeight = 88;
  const padX = 8;
  const padY = 10;
  const usableWidth = chartWidth - padX * 2;
  const usableHeight = chartHeight - padY * 2;
  const weightRange = maxWeight - minWeight || 1;
  const pointFor = (session: HistorySession, index: number) => ({
    x: padX + (chartSessions.length === 1 ? usableWidth / 2 : (index / (chartSessions.length - 1)) * usableWidth),
    y: padY + (maxWeight - session.topWeight) / weightRange * usableHeight,
  });
  const points = chartSessions.map(pointFor);
  const path = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
  const latest = sessions[sessions.length - 1];
  const previous = sessions[sessions.length - 2];
  const loadChange = previous ? latest.topWeight - previous.topWeight : null;

  return (
    <section className="bg-[#100d0b] border border-[#d97724]/30 rounded-2xl overflow-hidden" aria-label={`${exercise.machineName} load history`}>
      <button
        type="button"
        onClick={() => setIsExpanded((expanded) => !expanded)}
        className="w-full flex items-center justify-between gap-3 p-3 text-left hover:bg-[#211b18] transition-colors"
        aria-expanded={isExpanded}
      >
        <div className="flex items-center gap-2 min-w-0">
          <TrendingUp className="w-4 h-4 text-[#e6a15c] shrink-0" />
          <div>
            <p className="text-xs font-syne font-bold text-[#f5c999]">Load history</p>
            <p className="text-[10px] text-[#8c7e72]">{sessions.length} logged session{sessions.length === 1 ? '' : 's'} · top working load</p>
          </div>
        </div>
        <ChevronDown className={`w-4 h-4 text-[#a39588] shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
      </button>

      {isExpanded && (
        <div className="border-t border-[#2b241f] p-3 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-[#181412] border border-[#2b241f] rounded-xl p-2.5">
              <p className="text-[10px] uppercase tracking-wider text-[#8c7e72]">Last session</p>
              <p className="mt-0.5 text-sm font-mono font-bold text-[#f7f3ee]">{latest.topWeight} {displayUnit} × {latest.topReps}</p>
              <p className="text-[10px] text-[#a39588]">{formatWorkoutDate(latest.date)}</p>
            </div>
            <div className="bg-[#181412] border border-[#2b241f] rounded-xl p-2.5">
              <p className="text-[10px] uppercase tracking-wider text-[#8c7e72]">Since previous</p>
              <p className={`mt-0.5 text-sm font-mono font-bold ${loadChange && loadChange > 0 ? 'text-[#849a88]' : loadChange && loadChange < 0 ? 'text-[#c86d51]' : 'text-[#f7f3ee]'}`}>
                {loadChange === null ? '—' : `${loadChange > 0 ? '+' : ''}${loadChange} ${displayUnit}`}
              </p>
              <p className="text-[10px] text-[#a39588]">compared by top set</p>
            </div>
          </div>

          <div className="bg-[#181412] border border-[#2b241f] rounded-xl p-2.5">
            <div className="flex items-baseline justify-between gap-2 mb-1">
              <p className="text-[10px] font-syne font-bold uppercase tracking-wider text-[#a39588]">Top load trend</p>
              <p className="text-[10px] font-mono text-[#e6a15c]">{minWeight}–{maxWeight} {displayUnit}</p>
            </div>
            <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full h-24" role="img" aria-label={`Top load trend from ${minWeight} to ${maxWeight} ${displayUnit}`}>
              {[0.25, 0.5, 0.75].map((ratio) => <line key={ratio} x1={padX} x2={chartWidth - padX} y1={padY + usableHeight * ratio} y2={padY + usableHeight * ratio} stroke="#382f29" strokeWidth="1" />)}
              <path d={path} fill="none" stroke="#e6a15c" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              {points.map((point, index) => (
                <g key={chartSessions[index].id}>
                  <title>{`${formatWorkoutDate(chartSessions[index].date)}: ${chartSessions[index].topWeight} ${displayUnit} × ${chartSessions[index].topReps}`}</title>
                  <circle cx={point.x} cy={point.y} r="3.5" fill="#0c0a09" stroke="#f5c999" strokeWidth="2" />
                </g>
              ))}
            </svg>
            <div className="flex justify-between text-[10px] text-[#8c7e72]">
              <span>{formatWorkoutDate(chartSessions[0].date)}</span>
              {chartSessions.length > 1 && <span>{formatWorkoutDate(chartSessions[chartSessions.length - 1].date)}</span>}
            </div>
          </div>

          <div className="space-y-1.5">
            <p className="px-1 text-[10px] font-syne font-bold uppercase tracking-wider text-[#a39588]">Recent sessions</p>
            {recentSessions.map((session) => (
              <div key={session.id} className="bg-[#181412] border border-[#2b241f] rounded-xl px-2.5 py-2 flex gap-3 items-start">
                <span className="shrink-0 w-[72px] text-[10px] text-[#e6a15c] font-mono pt-0.5">{formatWorkoutDate(session.date)}</span>
                <div className="min-w-0 flex-1 flex flex-wrap gap-x-2 gap-y-1">
                  {session.sets.map((set, index) => (
                    <span key={`${session.id}-${index}`} className="text-[11px] font-mono text-[#f7f3ee] whitespace-nowrap">
                      <span className="text-[#8c7e72] capitalize">{set.type}</span> {set.weight} {displayUnit} × {set.reps}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
};
