import React from 'react';
import { Compass, TrendingUp, Activity, Sparkles, Feather } from 'lucide-react';
import { Workout, WeightUnit } from '../types';
import { calculateWorkoutVolume, calculateCompletedSets, calculateTotalDistance, calculateTotalRunningTime } from '../utils/formatters';

interface AnalyticsViewProps {
  workouts: Workout[];
  unit: WeightUnit;
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({ workouts, unit }) => {
  const completed = workouts.filter((w) => w.isCompleted);

  const totalVolumeAllTime = completed.reduce((acc, w) => acc + calculateWorkoutVolume(w), 0);
  const totalSetsAllTime = completed.reduce((acc, w) => acc + calculateCompletedSets(w), 0);
  const totalDistanceAllTime = completed.reduce((acc, w) => acc + calculateTotalDistance(w), 0);
  const totalRunTimeAllTime = completed.reduce((acc, w) => acc + calculateTotalRunningTime(w), 0);
  const totalWorkouts = completed.length;

  // Muscle group frequency
  const muscleFrequency: Record<string, number> = {};
  completed.forEach((w) => {
    w.exercises.forEach((ex) => {
      muscleFrequency[ex.category] = (muscleFrequency[ex.category] || 0) + 1;
    });
  });

  const sortedMuscles = Object.entries(muscleFrequency).sort((a, b) => b[1] - a[1]);

  // Recent volume trend (last 5 workouts)
  const recentWorkouts = [...completed]
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(-5);

  const maxRecentVolume = Math.max(...recentWorkouts.map((w) => calculateWorkoutVolume(w)), 1);

  return (
    <div className="space-y-4 pb-28">
      {/* Top Banner */}
      <div>
        <h2 className="text-lg font-serif font-bold text-[#f7f3ee] flex items-center gap-2">
          <Compass className="w-5 h-5 text-[#e6a15c]" /> Workout Progression Analytics
        </h2>
        <p className="text-xs text-[#a39588] font-light">
          Observe training volume growth, muscle engagement & strength progression
        </p>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="bg-[#181412]/90 border border-[#382f29] p-3 rounded-2xl text-center space-y-1">
          <span className="text-[10px] text-[#8c7e72] font-syne uppercase font-semibold block">Total Volume</span>
          <span className="text-base font-bold font-mono text-[#e6a15c]">
            {totalVolumeAllTime.toLocaleString()} <span className="text-xs text-[#a39588] font-normal">{unit}</span>
          </span>
        </div>

        <div className="bg-[#181412]/90 border border-[#382f29] p-3 rounded-2xl text-center space-y-1">
          <span className="text-[10px] text-[#8c7e72] font-syne uppercase font-semibold block">Workouts</span>
          <span className="text-base font-bold font-mono text-[#849a88]">
            {totalWorkouts} <span className="text-xs text-[#a39588] font-normal">sessions</span>
          </span>
        </div>

        <div className="bg-[#181412]/90 border border-[#382f29] p-3 rounded-2xl text-center space-y-1">
          <span className="text-[10px] text-[#8c7e72] font-syne uppercase font-semibold block">Run Distance</span>
          <span className="text-base font-bold font-mono text-[#d97724]">
            {totalDistanceAllTime.toFixed(1)} <span className="text-xs text-[#a39588] font-normal">mi</span>
          </span>
        </div>

        <div className="bg-[#181412]/90 border border-[#382f29] p-3 rounded-2xl text-center space-y-1">
          <span className="text-[10px] text-[#8c7e72] font-syne uppercase font-semibold block">Run Time</span>
          <span className="text-base font-bold font-mono text-[#f5c999]">
            {totalRunTimeAllTime} <span className="text-xs text-[#a39588] font-normal">mins</span>
          </span>
        </div>
      </div>

      {/* Volume Progression Chart */}
      <div className="bg-[#181412]/90 border border-[#382f29] rounded-3xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs uppercase font-syne font-bold text-[#c8b8a8] tracking-wider flex items-center gap-1.5">
            <TrendingUp className="w-4 h-4 text-[#849a88]" /> Volume Progression
          </h3>
          <span className="text-[10px] text-[#8c7e72]">Last 5 Sessions</span>
        </div>

        {recentWorkouts.length === 0 ? (
          <p className="text-xs text-[#6b5e54] font-serif italic py-4 text-center">Complete workouts to view volume momentum</p>
        ) : (
          <div className="space-y-2 pt-2">
            {recentWorkouts.map((w) => {
              const vol = calculateWorkoutVolume(w);
              const pct = Math.round((vol / maxRecentVolume) * 100);

              return (
                <div key={w.id} className="space-y-1">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-[#f7f3ee] font-serif font-semibold text-[12px] truncate max-w-[180px]">
                      {w.title}
                    </span>
                    <span className="text-[#e6a15c] font-bold">
                      {vol.toLocaleString()} {unit}
                    </span>
                  </div>
                  <div className="h-2.5 w-full bg-[#100d0b] rounded-full overflow-hidden border border-[#2b241f]">
                    <div
                      className="h-full bg-gradient-to-r from-[#d97724] to-[#e6a15c] rounded-full transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Muscle Group Frequency Breakdown */}
      <div className="bg-[#181412]/90 border border-[#382f29] rounded-3xl p-4 space-y-3">
        <h3 className="text-xs uppercase font-syne font-bold text-[#c8b8a8] tracking-wider flex items-center gap-1.5">
          <Activity className="w-4 h-4 text-[#e6a15c]" /> Targeted Muscle Groups
        </h3>

        {sortedMuscles.length === 0 ? (
          <p className="text-xs text-[#6b5e54] font-serif italic text-center py-2">No muscle logs recorded yet</p>
        ) : (
          <div className="space-y-2">
            {sortedMuscles.map(([muscle, count]) => (
              <div key={muscle} className="flex items-center justify-between bg-[#100d0b] p-2.5 rounded-2xl border border-[#2b241f]">
                <span className="text-xs font-serif font-bold text-[#f7f3ee]">{muscle}</span>
                <span className="text-xs font-mono font-bold text-[#e6a15c] bg-[#d97724]/20 px-2.5 py-0.5 rounded-full border border-[#d97724]/30">
                  {count} exercises logged
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Personal Trainer Feedback Card */}
      <div className="bg-gradient-to-br from-[#231b16] via-[#181412] to-[#100d0b] border border-[#d97724]/30 rounded-3xl p-4 space-y-2">
        <div className="flex items-center gap-2">
          <Feather className="w-4 h-4 text-[#e6a15c]" />
          <h4 className="text-xs font-syne font-bold text-[#f5c999] uppercase tracking-wider">
            PT Share Ready
          </h4>
        </div>
        <p className="text-xs text-[#c8b8a8] font-light leading-relaxed">
          All workout logs include muscle feel notes, seat adjustments, and set records ready to export into PNG cards for your Personal Trainer or Coach.
        </p>
      </div>
    </div>
  );
};

