'use client';

import React from 'react';
import { CheckCircle2, Circle, Dumbbell, Flame, ListChecks, RotateCcw, Timer } from 'lucide-react';
import { TrainingPlan, WarmupCheckins } from '../types';

interface TrainingPlanViewProps {
  trainingPlan: TrainingPlan;
  warmupCheckins: WarmupCheckins;
  onWarmupCheckinsChange: (checkins: WarmupCheckins) => void;
}

const getTodayKey = () => {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
};

export const TrainingPlanView: React.FC<TrainingPlanViewProps> = ({
  trainingPlan,
  warmupCheckins,
  onWarmupCheckinsChange,
}) => {
  const todayKey = getTodayKey();
  const todayCheckins = warmupCheckins[todayKey] || {};
  const completedWarmups = trainingPlan.warmupMoves.filter((move) => todayCheckins[move.id]).length;

  const toggleWarmup = (moveId: string) => {
    onWarmupCheckinsChange({
      ...warmupCheckins,
      [todayKey]: {
        ...todayCheckins,
        [moveId]: !todayCheckins[moveId],
      },
    });
  };

  const resetToday = () => {
    const next = { ...warmupCheckins };
    delete next[todayKey];
    onWarmupCheckinsChange(next);
  };

  return (
    <div className="space-y-6 pb-28">
      <header className="border-b border-[#2b241f] pb-5">
        <div className="flex flex-col gap-4">
          <div>
            <p className="font-syne text-xs font-bold uppercase tracking-wider text-[#e6a15c]">Training Plan</p>
            <h2 className="mt-1 font-serif text-3xl font-bold text-[#f7f3ee]">{trainingPlan.title}</h2>
            <p className="mt-2 text-sm text-[#a39588]">
              Synced with workout-data.json for the main app and PT portal.
            </p>
          </div>

          <div className="rounded-2xl border border-[#382f29] bg-[#181412] p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-syne text-[10px] font-bold uppercase tracking-wider text-[#8c7e72]">Today warmup</p>
                <p className="font-mono text-2xl font-bold text-[#e6a15c]">
                  {completedWarmups}/{trainingPlan.warmupMoves.length}
                </p>
              </div>
              <Flame className="h-8 w-8 text-[#d97724]" />
            </div>
          </div>
        </div>
      </header>

      <section className="space-y-4">
        <aside className="rounded-2xl border border-[#382f29] bg-[#181412] p-4 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-syne text-[10px] font-bold uppercase tracking-wider text-[#e6a15c]">Daily check-in</p>
              <h3 className="font-serif text-2xl font-bold">Warmup</h3>
            </div>
            <ListChecks className="h-5 w-5 text-[#849a88]" />
          </div>

          <div className="space-y-2">
            {trainingPlan.warmupMoves.map((move) => {
              const isChecked = !!todayCheckins[move.id];
              return (
                <button
                  key={move.id}
                  type="button"
                  onClick={() => toggleWarmup(move.id)}
                  className={`w-full rounded-xl border p-3 text-left transition-colors ${
                    isChecked
                      ? 'border-[#849a88]/70 bg-[#849a88]/15'
                      : 'border-[#2b241f] bg-[#100d0b] hover:border-[#d97724]/50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {isChecked ? (
                      <CheckCircle2 className="h-5 w-5 shrink-0 text-[#849a88]" />
                    ) : (
                      <Circle className="h-5 w-5 shrink-0 text-[#8c7e72]" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-[#f7f3ee]">{move.name}</p>
                      <p className="text-xs text-[#a39588]">{move.target}</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={resetToday}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#382f29] bg-[#100d0b] px-3 py-2 text-xs font-bold text-[#c8b8a8] hover:border-[#d97724]/50 hover:text-[#f5c999]"
          >
            <RotateCcw className="h-4 w-4" />
            Reset today
          </button>
        </aside>

        <div className="grid gap-4">
          {trainingPlan.blocks.map((block) => (
            <section key={block.id} className="overflow-hidden rounded-2xl border border-[#382f29] bg-[#181412] shadow-2xl">
              <div className="border-b border-[#2b241f] p-4" style={{ borderTop: `4px solid ${block.accent}` }}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-syne text-[10px] font-bold uppercase tracking-wider text-[#8c7e72]">
                      {block.subtitle}
                    </p>
                    <h3 className="font-serif text-3xl font-bold">{block.title}</h3>
                  </div>
                  <Dumbbell className="h-6 w-6 shrink-0" style={{ color: block.accent }} />
                </div>
              </div>

              <div className="divide-y divide-[#2b241f]">
                {block.exercises.map((exercise, index) => (
                  <div key={exercise.id} className="grid grid-cols-[34px_1fr] gap-3 p-3 sm:grid-cols-[34px_1fr_72px_78px_72px] sm:items-center">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full border border-[#382f29] bg-[#100d0b] font-mono text-[11px] font-bold text-[#e6a15c]">
                      {index + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-[#f7f3ee]">{exercise.name}</p>
                      <div className="mt-1 grid grid-cols-3 gap-2 text-[11px] text-[#a39588] sm:hidden">
                        <span>{exercise.sets}</span>
                        <span>{exercise.reps}</span>
                        <span>{exercise.rest}</span>
                      </div>
                    </div>
                    <Metric label="Sets" value={exercise.sets} />
                    <Metric label="Reps" value={exercise.reps} />
                    <Metric label="Rest" value={exercise.rest} icon={<Timer className="h-3 w-3" />} />
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </section>
    </div>
  );
};

function Metric({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="hidden sm:block">
      <p className="font-syne text-[9px] font-bold uppercase tracking-wider text-[#6b5e54]">{label}</p>
      <p className="mt-0.5 flex items-center gap-1 font-mono text-xs font-bold text-[#c8b8a8]">
        {icon}
        {value}
      </p>
    </div>
  );
}
