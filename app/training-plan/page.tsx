'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Circle, Dumbbell, Flame, ListChecks, RotateCcw, Timer } from 'lucide-react';

type TrainingBlock = {
  id: string;
  title: string;
  subtitle: string;
  accent: string;
  exercises: {
    name: string;
    sets: string;
    reps: string;
    rest: string;
  }[];
};

type WarmupMove = {
  id: string;
  name: string;
  target: string;
};

const trainingBlocks: TrainingBlock[] = [
  {
    id: 'push-a',
    title: '推 A',
    subtitle: 'Chest, shoulders, triceps',
    accent: '#d97724',
    exercises: [
      { name: '啞鈴上胸臥推', sets: '3組', reps: '6-8下', rest: '2-3分' },
      { name: '機械平胸推', sets: '3組', reps: '8-10下', rest: '2-3分' },
      { name: '蝴蝶機夾胸', sets: '3組', reps: '10-12下', rest: '2分' },
      { name: 'Life 機械肩推', sets: '4組', reps: '8-10下', rest: '2-3分' },
      { name: '啞鈴側平舉', sets: '3組', reps: '12-15下', rest: '2分' },
      { name: 'Hammer tricep extension', sets: '3組', reps: '12下', rest: '2分' },
      { name: 'Cable 平握把 extension', sets: '2組', reps: '12-15下', rest: '2分' },
    ],
  },
  {
    id: 'pull-a',
    title: '拉 A',
    subtitle: 'Back, rear delts, biceps',
    accent: '#849a88',
    exercises: [
      { name: '對握輔助引體向上', sets: '3組', reps: '8-10下', rest: '2-3分' },
      { name: '啞鈴單臂划船', sets: '3組', reps: '8-10下', rest: '2-3分' },
      { name: 'Life 機械正手下拉', sets: '3組', reps: '10-12下', rest: '2-3分' },
      { name: 'Cable 正手划船', sets: '3組', reps: '10-12下', rest: '2-3分' },
      { name: '蝴蝶機反向飛鳥', sets: '3組', reps: '10-12下', rest: '2分' },
      { name: 'Hammer 二頭彎舉', sets: '3組', reps: '10-12下', rest: '2分' },
      { name: '啞鈴垂式彎舉', sets: '2組', reps: '12-15下', rest: '2分' },
    ],
  },
  {
    id: 'push-b',
    title: '推 B',
    subtitle: 'Pressing variation day',
    accent: '#c86d51',
    exercises: [
      { name: '史密斯上胸臥推', sets: '3組', reps: '6-8下', rest: '2-3分' },
      { name: '啞鈴平胸臥推', sets: '3組', reps: '8-10下', rest: '2-3分' },
      { name: 'Cable夾胸', sets: '3組', reps: '10-12下', rest: '2分' },
      { name: '啞鈴坐姿肩推', sets: '4組', reps: '8-10下', rest: '2-3分' },
      { name: '機械側平舉', sets: '3組', reps: '12-15下', rest: '2分' },
      { name: 'Cable 纜繩三頭下壓', sets: '3組', reps: '12-15下', rest: '2分' },
      { name: 'Cable 過頭extension', sets: '2組', reps: '12-15下', rest: '2分' },
    ],
  },
  {
    id: 'pull-b',
    title: '拉 B',
    subtitle: 'Vertical and row variation day',
    accent: '#f5c999',
    exercises: [
      { name: '正手滑輪下拉', sets: '3組', reps: '8-10下', rest: '2-3分' },
      { name: '機械反手划船', sets: '3組', reps: '8-10下', rest: '2-3分' },
      { name: 'Hoist 機械下拉', sets: '3組', reps: '10-12下', rest: '2-3分' },
      { name: 'Cable 對握與肩同寬划船', sets: '3組', reps: '10-12下', rest: '2-3分' },
      { name: 'Face pull', sets: '3組', reps: '10-12下', rest: '2分' },
      { name: '啞鈴斜板二頭彎舉', sets: '3組', reps: '10-12下', rest: '2分' },
      { name: 'Cable 垂式彎舉', sets: '2組', reps: '12-15下', rest: '2分' },
    ],
  },
];

const warmupMoves: WarmupMove[] = [
  { id: 'hooklying', name: 'Hooklying', target: '6-8' },
  { id: 'left-side-bend', name: '四足跪姿左側彎', target: '6-8' },
  { id: 'dead-bug', name: '死蟲式', target: '8下' },
];

const getTodayKey = () => {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
};

export default function TrainingPlanPage() {
  const todayKey = useMemo(() => getTodayKey(), []);
  const storageKey = `training-plan-warmup-${todayKey}`;
  const [checkedWarmups, setCheckedWarmups] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const stored = window.localStorage.getItem(storageKey);
    if (!stored) return;

    try {
      setCheckedWarmups(JSON.parse(stored));
    } catch {
      setCheckedWarmups({});
    }
  }, [storageKey]);

  useEffect(() => {
    window.localStorage.setItem(storageKey, JSON.stringify(checkedWarmups));
  }, [checkedWarmups, storageKey]);

  const completedWarmups = warmupMoves.filter((move) => checkedWarmups[move.id]).length;

  return (
    <main className="min-h-screen bg-[#0c0a09] text-[#f7f3ee] px-4 py-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="border-b border-[#2b241f] pb-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="font-syne text-xs font-bold uppercase tracking-wider text-[#e6a15c]">Training Plan</p>
              <h1 className="mt-1 font-serif text-4xl font-bold text-[#f7f3ee]">Push / Pull Program</h1>
              <p className="mt-2 max-w-2xl text-sm text-[#a39588]">
                Four focused upper-body sessions with daily warmup check-ins stored on this device.
              </p>
            </div>

            <div className="rounded-2xl border border-[#382f29] bg-[#181412] p-4 min-w-56">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-syne text-[10px] font-bold uppercase tracking-wider text-[#8c7e72]">Today warmup</p>
                  <p className="font-mono text-2xl font-bold text-[#e6a15c]">
                    {completedWarmups}/{warmupMoves.length}
                  </p>
                </div>
                <Flame className="h-8 w-8 text-[#d97724]" />
              </div>
            </div>
          </div>
        </header>

        <section className="grid gap-4 lg:grid-cols-[320px_1fr]">
          <aside className="h-fit rounded-2xl border border-[#382f29] bg-[#181412] p-4 space-y-4 lg:sticky lg:top-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-syne text-[10px] font-bold uppercase tracking-wider text-[#e6a15c]">Daily check-in</p>
                <h2 className="font-serif text-2xl font-bold">Warmup</h2>
              </div>
              <ListChecks className="h-5 w-5 text-[#849a88]" />
            </div>

            <div className="space-y-2">
              {warmupMoves.map((move) => {
                const isChecked = !!checkedWarmups[move.id];
                return (
                  <button
                    key={move.id}
                    type="button"
                    onClick={() =>
                      setCheckedWarmups((current) => ({
                        ...current,
                        [move.id]: !current[move.id],
                      }))
                    }
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
              onClick={() => setCheckedWarmups({})}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#382f29] bg-[#100d0b] px-3 py-2 text-xs font-bold text-[#c8b8a8] hover:border-[#d97724]/50 hover:text-[#f5c999]"
            >
              <RotateCcw className="h-4 w-4" />
              Reset today
            </button>
          </aside>

          <div className="grid gap-4 xl:grid-cols-2">
            {trainingBlocks.map((block) => (
              <section key={block.id} className="overflow-hidden rounded-2xl border border-[#382f29] bg-[#181412] shadow-2xl">
                <div className="border-b border-[#2b241f] p-4" style={{ borderTop: `4px solid ${block.accent}` }}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-syne text-[10px] font-bold uppercase tracking-wider text-[#8c7e72]">
                        {block.subtitle}
                      </p>
                      <h2 className="font-serif text-3xl font-bold">{block.title}</h2>
                    </div>
                    <Dumbbell className="h-6 w-6 shrink-0" style={{ color: block.accent }} />
                  </div>
                </div>

                <div className="divide-y divide-[#2b241f]">
                  {block.exercises.map((exercise, index) => (
                    <div key={`${block.id}-${exercise.name}`} className="grid grid-cols-[34px_1fr] gap-3 p-3 sm:grid-cols-[34px_1fr_72px_78px_72px] sm:items-center">
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
    </main>
  );
}

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
