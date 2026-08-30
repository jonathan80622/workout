'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, Scale, Trash2, ZoomIn, ZoomOut } from 'lucide-react';
import { BodyWeightEntry, BodyWeightStore, WeightUnit } from '@/src/types';
import {
  createBodyWeightEntry,
  formatBodyWeight,
  parseBodyWeightStore,
  serializeBodyWeightStore,
  weightFromKg,
} from '@/src/utils/bodyWeight';

type RangeKey = '1W' | '1M' | '3M' | '6M' | '1Y' | 'All';

const rangeOptions: { key: RangeKey; days: number | null }[] = [
  { key: '1W', days: 7 },
  { key: '1M', days: 30 },
  { key: '3M', days: 90 },
  { key: '6M', days: 180 },
  { key: '1Y', days: 365 },
  { key: 'All', days: null },
];

const storageKey = 'workout-recorder-weight-entries';

const seedStore = (): BodyWeightStore => {
  const today = new Date();
  const valuesLbs = [187.8, 187.1, 186.9, 186.2, 185.7, 185.4, 184.9, 184.5, 184.1, 183.8, 183.2, 182.9];

  return {
    version: 1,
    displayUnit: 'lbs',
    entries: valuesLbs.map((value, index) => {
      const date = new Date(today);
      date.setDate(today.getDate() - (valuesLbs.length - index - 1) * 7);
      return createBodyWeightEntry({
        id: `seed-${index}`,
        date: toDateInputValue(date),
        value,
        unit: 'lbs',
      });
    }),
  };
};

const toDateInputValue = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

const formatDate = (date: string) =>
  new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(new Date(`${date}T12:00:00`));

export default function WeightTrackingPage() {
  const [store, setStore] = useState<BodyWeightStore>({ version: 1, displayUnit: 'lbs', entries: [] });
  const [selectedRange, setSelectedRange] = useState<RangeKey>('3M');
  const [zoomLevel, setZoomLevel] = useState(1);
  const [panOffset, setPanOffset] = useState(0);
  const [date, setDate] = useState(() => toDateInputValue(new Date()));
  const [weight, setWeight] = useState('');
  const dragStartRef = useRef<{ x: number } | null>(null);

  useEffect(() => {
    const parsed = parseBodyWeightStore(window.localStorage.getItem(storageKey));
    const nextStore = parsed || seedStore();
    setStore(nextStore);
    window.localStorage.setItem(storageKey, serializeBodyWeightStore(nextStore));
  }, []);

  useEffect(() => {
    window.localStorage.setItem(storageKey, serializeBodyWeightStore(store));
  }, [store]);

  const displayUnit = store.displayUnit;
  const sortedEntries = useMemo(
    () => [...store.entries].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
    [store.entries]
  );

  const rangeDays = rangeOptions.find((option) => option.key === selectedRange)?.days ?? null;
  const filteredEntries = useMemo(() => {
    if (sortedEntries.length === 0) return [];
    if (!rangeDays) return sortedEntries;

    const latestTime = Math.max(...sortedEntries.map((entry) => new Date(`${entry.date}T12:00:00`).getTime()));
    const startTime = latestTime - rangeDays * 24 * 60 * 60 * 1000;
    return sortedEntries.filter((entry) => new Date(`${entry.date}T12:00:00`).getTime() >= startTime);
  }, [rangeDays, sortedEntries]);

  const windowedEntries = useMemo(() => {
    if (filteredEntries.length <= 2) return filteredEntries;
    const visibleCount = Math.max(2, Math.ceil(filteredEntries.length / zoomLevel));
    const maxOffset = Math.max(0, filteredEntries.length - visibleCount);
    const start = Math.min(maxOffset, Math.max(0, panOffset));
    return filteredEntries.slice(start, start + visibleCount);
  }, [filteredEntries, panOffset, zoomLevel]);

  useEffect(() => {
    const visibleCount = Math.max(2, Math.ceil(filteredEntries.length / zoomLevel));
    setPanOffset((current) => Math.min(Math.max(0, filteredEntries.length - visibleCount), current));
  }, [filteredEntries.length, zoomLevel]);

  const latest = sortedEntries[sortedEntries.length - 1];
  const earliestInWindow = windowedEntries[0];
  const latestInWindow = windowedEntries[windowedEntries.length - 1];
  const first = sortedEntries[0];
  const changeKg = latest && first ? latest.weightKg - first.weightKg : 0;
  const averageKg =
    windowedEntries.length > 0
      ? windowedEntries.reduce((sum, entry) => sum + entry.weightKg, 0) / windowedEntries.length
      : 0;

  const addEntry = () => {
    const parsedWeight = Number(weight);
    if (!date || !Number.isFinite(parsedWeight) || parsedWeight <= 0) return;

    const nextEntry = createBodyWeightEntry({
      id: `weight-${Date.now()}`,
      date,
      value: parsedWeight,
      unit: displayUnit,
    });

    setStore((current) => ({
      ...current,
      entries: [...current.entries.filter((entry) => entry.date !== date), nextEntry],
    }));
    setWeight('');
  };

  const deleteEntry = (entryId: string) => {
    setStore((current) => ({
      ...current,
      entries: current.entries.filter((entry) => entry.id !== entryId),
    }));
  };

  const setDisplayUnit = (unit: WeightUnit) => {
    setStore((current) => ({ ...current, displayUnit: unit }));
  };

  const visibleCount = Math.max(2, Math.ceil(filteredEntries.length / zoomLevel));
  const canPan = filteredEntries.length > visibleCount;
  const change = weightFromKg(changeKg, displayUnit);

  return (
    <main className="min-h-screen bg-[#0c0a09] text-[#f7f3ee] px-4 py-6">
      <div className="mx-auto max-w-6xl space-y-5">
        <header className="border-b border-[#2b241f] pb-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="font-syne text-xs font-bold uppercase tracking-wider text-[#e6a15c]">Body Metrics</p>
              <h1 className="mt-1 font-serif text-4xl font-bold text-[#f7f3ee]">Weight</h1>
              <p className="mt-2 max-w-2xl text-sm text-[#a39588]">
                Stored canonically in kilograms, displayed in your chosen unit.
              </p>
            </div>

            <div className="rounded-2xl border border-[#382f29] bg-[#181412] p-4 min-w-60">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-syne text-[10px] font-bold uppercase tracking-wider text-[#8c7e72]">Latest</p>
                  <p className="font-mono text-3xl font-bold text-[#e6a15c]">
                    {latest ? formatBodyWeight(latest.weightKg, displayUnit) : '--'}
                  </p>
                  {latest && <p className="text-xs text-[#a39588]">{formatDate(latest.date)}</p>}
                </div>
                <Scale className="h-8 w-8 text-[#849a88]" />
              </div>
            </div>
          </div>
        </header>

        <section className="grid gap-4 lg:grid-cols-[320px_1fr]">
          <aside className="h-fit rounded-2xl border border-[#382f29] bg-[#181412] p-4 space-y-4 lg:sticky lg:top-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-syne text-[10px] font-bold uppercase tracking-wider text-[#e6a15c]">Add weigh-in</p>
                <h2 className="font-serif text-2xl font-bold">Today</h2>
              </div>
              <div className="flex rounded-xl border border-[#382f29] bg-[#100d0b] p-1">
                {(['lbs', 'kg'] as WeightUnit[]).map((unit) => (
                  <button
                    key={unit}
                    type="button"
                    onClick={() => setDisplayUnit(unit)}
                    className={`rounded-lg px-2.5 py-1 text-xs font-bold ${
                      displayUnit === unit ? 'bg-[#d97724] text-[#0c0a09]' : 'text-[#a39588] hover:text-[#f7f3ee]'
                    }`}
                  >
                    {unit}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-2">
              <label className="space-y-1">
                <span className="text-xs font-bold text-[#c8b8a8]">Date</span>
                <input
                  type="date"
                  value={date}
                  onChange={(event) => setDate(event.target.value)}
                  className="w-full rounded-xl border border-[#382f29] bg-[#100d0b] px-3 py-2 text-sm text-[#f7f3ee] outline-none focus:ring-1 focus:ring-[#d97724]"
                />
              </label>

              <label className="space-y-1">
                <span className="text-xs font-bold text-[#c8b8a8]">Weight ({displayUnit})</span>
                <input
                  type="number"
                  inputMode="decimal"
                  min="1"
                  step="0.1"
                  value={weight}
                  onChange={(event) => setWeight(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') addEntry();
                  }}
                  placeholder={displayUnit === 'lbs' ? '182.4' : '82.7'}
                  className="w-full rounded-xl border border-[#382f29] bg-[#100d0b] px-3 py-2 text-sm text-[#f7f3ee] placeholder-[#6b5e54] outline-none focus:ring-1 focus:ring-[#d97724]"
                />
              </label>

              <button
                type="button"
                onClick={addEntry}
                className="mt-1 flex w-full items-center justify-center gap-2 rounded-xl bg-[#d97724] px-3 py-3 text-xs font-bold text-[#0c0a09] hover:bg-[#e6a15c]"
              >
                <Plus className="h-4 w-4" />
                Save weight
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 border-t border-[#2b241f] pt-4">
              <Stat label="Window avg" value={averageKg ? formatBodyWeight(averageKg, displayUnit) : '--'} />
              <Stat label="Total change" value={`${change >= 0 ? '+' : ''}${change.toFixed(1)} ${displayUnit}`} />
            </div>
          </aside>

          <div className="space-y-4">
            <section className="rounded-2xl border border-[#382f29] bg-[#181412] p-4 shadow-2xl">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex rounded-xl border border-[#382f29] bg-[#100d0b] p-1">
                  {rangeOptions.map((option) => (
                    <button
                      key={option.key}
                      type="button"
                      onClick={() => {
                        setSelectedRange(option.key);
                        setPanOffset(0);
                        setZoomLevel(1);
                      }}
                      className={`min-w-11 rounded-lg px-2 py-1.5 text-xs font-bold transition-colors ${
                        selectedRange === option.key
                          ? 'bg-[#d97724] text-[#0c0a09]'
                          : 'text-[#a39588] hover:text-[#f7f3ee]'
                      }`}
                    >
                      {option.key}
                    </button>
                  ))}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setZoomLevel((current) => Math.max(1, current - 0.5))}
                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#382f29] bg-[#100d0b] text-[#c8b8a8] hover:border-[#d97724]/50"
                    title="Zoom out"
                  >
                    <ZoomOut className="h-4 w-4" />
                  </button>
                  <input
                    type="range"
                    min="1"
                    max="6"
                    step="0.5"
                    value={zoomLevel}
                    onChange={(event) => setZoomLevel(Number(event.target.value))}
                    className="w-32 accent-[#d97724]"
                    aria-label="Chart zoom"
                  />
                  <button
                    type="button"
                    onClick={() => setZoomLevel((current) => Math.min(6, current + 0.5))}
                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#382f29] bg-[#100d0b] text-[#c8b8a8] hover:border-[#d97724]/50"
                    title="Zoom in"
                  >
                    <ZoomIn className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setPanOffset((current) => Math.max(0, current - 1))}
                    disabled={!canPan || panOffset === 0}
                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#382f29] bg-[#100d0b] text-[#c8b8a8] disabled:opacity-40"
                    title="Earlier"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setPanOffset((current) => Math.min(filteredEntries.length - visibleCount, current + 1))}
                    disabled={!canPan || panOffset >= filteredEntries.length - visibleCount}
                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#382f29] bg-[#100d0b] text-[#c8b8a8] disabled:opacity-40"
                    title="Later"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <WeightChart
                entries={windowedEntries}
                displayUnit={displayUnit}
                onDrag={(direction) => {
                  if (!canPan) return;
                  setPanOffset((current) => {
                    const next = direction === 'right' ? current - 1 : current + 1;
                    return Math.min(filteredEntries.length - visibleCount, Math.max(0, next));
                  });
                }}
                dragStartRef={dragStartRef}
              />

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-[#8c7e72]">
                <span>
                  {earliestInWindow && latestInWindow
                    ? `${formatDate(earliestInWindow.date)} to ${formatDate(latestInWindow.date)}`
                    : 'No entries yet'}
                </span>
                <span>{zoomLevel.toFixed(1)}x zoom · {displayUnit}</span>
              </div>
            </section>

            <section className="rounded-2xl border border-[#382f29] bg-[#181412] p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="font-serif text-2xl font-bold">Recent Entries</h2>
                <span className="text-xs text-[#8c7e72]">{sortedEntries.length} logs</span>
              </div>

              <div className="divide-y divide-[#2b241f]">
                {[...sortedEntries].reverse().slice(0, 10).map((entry) => (
                  <div key={entry.id} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 py-2">
                    <div>
                      <p className="text-sm text-[#c8b8a8]">{formatDate(entry.date)}</p>
                      <p className="text-[10px] text-[#8c7e72]">
                        Entered as {entry.sourceValue.toFixed(1)} {entry.sourceUnit}
                      </p>
                    </div>
                    <span className="font-mono text-sm font-bold text-[#f7f3ee]">
                      {formatBodyWeight(entry.weightKg, displayUnit)}
                    </span>
                    <button
                      type="button"
                      onClick={() => deleteEntry(entry.id)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-[#6b5e54] hover:bg-[#c86d51]/10 hover:text-[#c86d51]"
                      title="Delete entry"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[#2b241f] bg-[#100d0b] p-3">
      <p className="font-syne text-[9px] font-bold uppercase tracking-wider text-[#8c7e72]">{label}</p>
      <p className="mt-1 font-mono text-sm font-bold text-[#e6a15c]">{value}</p>
    </div>
  );
}

function WeightChart({
  entries,
  displayUnit,
  onDrag,
  dragStartRef,
}: {
  entries: BodyWeightEntry[];
  displayUnit: WeightUnit;
  onDrag: (direction: 'left' | 'right') => void;
  dragStartRef: React.MutableRefObject<{ x: number } | null>;
}) {
  const width = 760;
  const height = 330;
  const padding = { top: 28, right: 24, bottom: 44, left: 52 };
  const weights = entries.map((entry) => weightFromKg(entry.weightKg, displayUnit));
  const min = weights.length ? Math.min(...weights) : 0;
  const max = weights.length ? Math.max(...weights) : 0;
  const buffer = Math.max(1, (max - min) * 0.25);
  const yMin = min - buffer;
  const yMax = max + buffer;
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;

  const points = entries.map((entry, index) => {
    const displayWeight = weightFromKg(entry.weightKg, displayUnit);
    const x = padding.left + (entries.length === 1 ? plotWidth / 2 : (index / (entries.length - 1)) * plotWidth);
    const y = padding.top + ((yMax - displayWeight) / Math.max(1, yMax - yMin)) * plotHeight;
    return { ...entry, displayWeight, x, y };
  });

  const linePath = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
  const areaPath =
    points.length > 0
      ? `${linePath} L ${points[points.length - 1].x} ${height - padding.bottom} L ${points[0].x} ${height - padding.bottom} Z`
      : '';
  const gridValues = [0, 0.25, 0.5, 0.75, 1].map((ratio) => yMin + (yMax - yMin) * ratio);

  return (
    <div
      className="mt-4 touch-pan-y"
      onPointerDown={(event) => {
        dragStartRef.current = { x: event.clientX };
      }}
      onPointerUp={(event) => {
        if (!dragStartRef.current) return;
        const delta = event.clientX - dragStartRef.current.x;
        dragStartRef.current = null;
        if (Math.abs(delta) > 36) onDrag(delta > 0 ? 'right' : 'left');
      }}
      onPointerCancel={() => {
        dragStartRef.current = null;
      }}
    >
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Weight trend chart" className="h-auto w-full overflow-visible">
        <defs>
          <linearGradient id="weightArea" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#d97724" stopOpacity="0.32" />
            <stop offset="100%" stopColor="#d97724" stopOpacity="0" />
          </linearGradient>
        </defs>

        {gridValues.map((value) => {
          const y = padding.top + ((yMax - value) / Math.max(1, yMax - yMin)) * plotHeight;
          return (
            <g key={value}>
              <line x1={padding.left} x2={width - padding.right} y1={y} y2={y} stroke="#2b241f" strokeWidth="1" />
              <text x={padding.left - 10} y={y + 4} textAnchor="end" fill="#8c7e72" fontSize="11">
                {value.toFixed(1)}
              </text>
            </g>
          );
        })}

        {areaPath && <path d={areaPath} fill="url(#weightArea)" />}
        {linePath && <path d={linePath} fill="none" stroke="#e6a15c" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />}

        {points.map((point, index) => (
          <g key={point.id}>
            <circle cx={point.x} cy={point.y} r="5" fill="#0c0a09" stroke="#f5c999" strokeWidth="3" />
            {(index === 0 || index === points.length - 1 || entries.length <= 5) && (
              <>
                <text x={point.x} y={height - 18} textAnchor="middle" fill="#8c7e72" fontSize="11">
                  {formatDate(point.date)}
                </text>
                <text x={point.x} y={point.y - 12} textAnchor="middle" fill="#f7f3ee" fontSize="12" fontWeight="700">
                  {point.displayWeight.toFixed(1)}
                </text>
              </>
            )}
          </g>
        ))}

        {points.length === 0 && (
          <text x={width / 2} y={height / 2} textAnchor="middle" fill="#8c7e72" fontSize="14">
            Add a weigh-in to start tracking.
          </text>
        )}
      </svg>
    </div>
  );
}
