import { BodyWeightEntry, BodyWeightStore, WeightUnit } from '../types';

const KG_PER_LB = 0.45359237;

type LegacyWeightEntry = {
  id?: string;
  date?: string;
  weight?: number;
};

export function weightToKg(value: number, unit: WeightUnit): number {
  return roundWeight(unit === 'kg' ? value : value * KG_PER_LB);
}

export function weightFromKg(weightKg: number, unit: WeightUnit): number {
  return roundWeight(unit === 'kg' ? weightKg : weightKg / KG_PER_LB);
}

export function roundWeight(value: number): number {
  return Math.round(value * 10) / 10;
}

export function formatBodyWeight(weightKg: number, unit: WeightUnit): string {
  return `${weightFromKg(weightKg, unit).toFixed(1)} ${unit}`;
}

export function createBodyWeightEntry(params: {
  id: string;
  date: string;
  value: number;
  unit: WeightUnit;
}): BodyWeightEntry {
  return {
    schemaVersion: 1,
    id: params.id,
    date: params.date,
    weightKg: weightToKg(params.value, params.unit),
    sourceValue: roundWeight(params.value),
    sourceUnit: params.unit,
  };
}

export function serializeBodyWeightStore(store: BodyWeightStore): string {
  return JSON.stringify({
    version: 1,
    entries: store.entries.map(normalizeBodyWeightEntry).filter(Boolean),
  });
}

export function parseBodyWeightStore(raw: string | null): BodyWeightStore | null {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    const rawEntries = Array.isArray(parsed) ? parsed : parsed?.entries;

    if (!Array.isArray(rawEntries)) {
      return { version: 1, entries: [] };
    }

    return {
      version: 1,
      entries: rawEntries.map(normalizeBodyWeightEntry).filter(Boolean),
    };
  } catch {
    return null;
  }
}

export function normalizeBodyWeightEntry(value: unknown): BodyWeightEntry | null {
  if (!value || typeof value !== 'object') return null;

  const entry = value as Partial<BodyWeightEntry> & LegacyWeightEntry;
  if (!entry.date) return null;

  if (typeof entry.weightKg === 'number' && Number.isFinite(entry.weightKg) && entry.weightKg > 0) {
    const sourceUnit = parseWeightUnit(entry.sourceUnit) || 'kg';
    const sourceValue =
      typeof entry.sourceValue === 'number' && Number.isFinite(entry.sourceValue)
        ? entry.sourceValue
        : weightFromKg(entry.weightKg, sourceUnit);

    return {
      schemaVersion: 1,
      id: entry.id || `weight-${entry.date}`,
      date: entry.date,
      weightKg: roundWeight(entry.weightKg),
      sourceValue: roundWeight(sourceValue),
      sourceUnit,
    };
  }

  if (typeof entry.weight === 'number' && Number.isFinite(entry.weight) && entry.weight > 0) {
    return createBodyWeightEntry({
      id: entry.id || `legacy-weight-${entry.date}`,
      date: entry.date,
      value: entry.weight,
      unit: 'lbs',
    });
  }

  return null;
}

function parseWeightUnit(value: unknown): WeightUnit | null {
  return value === 'lbs' || value === 'kg' ? value : null;
}
