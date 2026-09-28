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
  averageWeight: number;
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
          const averageWeight = sets.length
            ? Math.round((sets.reduce((total, set) => total + set.weight, 0) / sets.length) * 10) / 10
            : 0;
          return averageWeight > 0 ? {
            id: `${workout.id}-${pastExercise.id}`,
            date: workout.date,
            sets,
            averageWeight,
          } : null;
        }))
      .filter((session): session is HistorySession => session !== null)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [displayUnit, exercise.category, exercise.machineName, workouts]);

  if (sessions.length === 0) return null;

  const chartSessions = sessions.slice(-8);
  const minWeight = Math.min(...chartSessions.map((session) => session.averageWeight));
  const maxWeight = Math.max(...chartSessions.map((session) => session.averageWeight));
  const chartWidth = 280;
  const chartHeight = 88;
  const axisWidth = 42;
  const padX = axisWidth + 8;
  const plotRight = chartWidth - 8;
  const padY = 10;
  const usableWidth = plotRight - padX;
  const usableHeight = chartHeight - padY * 2;
  const chartMin = minWeight === maxWeight ? Math.max(0, minWeight - 5) : minWeight;
  const chartMax = minWeight === maxWeight ? maxWeight + 5 : maxWeight;
  const weightRange = chartMax - chartMin;
  const pointFor = (session: HistorySession, index: number) => ({
    x: padX + (chartSessions.length === 1 ? usableWidth / 2 : (index / (chartSessions.length - 1)) * usableWidth),
    y: padY + (chartMax - session.averageWeight) / weightRange * usableHeight,
  });
  const points = chartSessions.map(pointFor);
  const path = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
  const axisValues = [chartMax, Math.round(((chartMin + chartMax) / 2) * 10) / 10, chartMin];

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
            <p className="text-[10px] text-[#8c7e72]">{sessions.length} logged session{sessions.length === 1 ? '' : 's'} · average load per session</p>
          </div>
        </div>
        <ChevronDown className={`w-4 h-4 text-[#a39588] shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
      </button>

      {isExpanded && (
        <div className="border-t border-[#2b241f] p-3 space-y-3">
          <div className="bg-[#181412] border border-[#2b241f] rounded-xl p-2.5">
            <div className="flex items-baseline justify-between gap-2 mb-1">
              <p className="text-[10px] font-syne font-bold uppercase tracking-wider text-[#a39588]">Average load by session</p>
              <p className="text-[10px] font-mono text-[#e6a15c]">{minWeight}–{maxWeight} {displayUnit}</p>
            </div>
            <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full h-24" role="img" aria-label={`Average load trend from ${minWeight} to ${maxWeight} ${displayUnit}`}>
              {axisValues.map((value, index) => {
                const y = padY + usableHeight * (index / (axisValues.length - 1));
                return (
                  <g key={`${value}-${index}`}>
                    <text x={axisWidth} y={y + 3} textAnchor="end" fill="#8c7e72" fontSize="9">{value}</text>
                    <line x1={padX} x2={chartWidth - 8} y1={y} y2={y} stroke="#382f29" strokeWidth="1" />
                  </g>
                );
              })}
              <path d={path} fill="none" stroke="#e6a15c" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              {points.map((point, index) => (
                <g key={chartSessions[index].id}>
                  <title>{`${formatWorkoutDate(chartSessions[index].date)}: average ${chartSessions[index].averageWeight} ${displayUnit}`}</title>
                  <circle cx={point.x} cy={point.y} r="3.5" fill="#0c0a09" stroke="#f5c999" strokeWidth="2" />
                </g>
              ))}
            </svg>
            <div className="flex justify-between text-[10px] text-[#8c7e72]">
              <span>{formatWorkoutDate(chartSessions[0].date)}</span>
              {chartSessions.length > 1 && <span>{formatWorkoutDate(chartSessions[chartSessions.length - 1].date)}</span>}
            </div>
          </div>

        </div>
      )}
    </section>
  );
};
