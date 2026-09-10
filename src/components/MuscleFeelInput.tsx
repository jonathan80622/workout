'use client';

import React from 'react';
import { MuscleFeeling } from '../types';

interface MuscleFeelInputProps {
  value: MuscleFeeling;
  onChange: (updated: MuscleFeeling) => void;
  machineName?: string;
}

// Retains the legacy data shape so existing saved workouts remain compatible.
export const MuscleFeelInput: React.FC<MuscleFeelInputProps> = ({ value, onChange, machineName }) => (
  <div className="bg-[#181412]/90 border border-[#382f29] rounded-2xl p-4 shadow-xl space-y-2">
    <label className="text-xs font-serif italic text-[#c8b8a8] block" htmlFor={`exercise-note-${machineName || 'custom'}`}>
      Exercise Notes{machineName ? ` — ${machineName}` : ''}
    </label>
    <textarea
      id={`exercise-note-${machineName || 'custom'}`}
      rows={3}
      value={value.notes}
      onChange={(event) => onChange({ ...value, notes: event.target.value })}
      placeholder="Add any notes about this exercise."
      className="w-full bg-[#100d0b] border border-[#2b241f] rounded-xl p-3 text-xs text-[#f7f3ee] placeholder-[#6b5e54] focus:outline-none focus:ring-1 focus:ring-[#d97724] resize-none leading-relaxed"
    />
  </div>
);
