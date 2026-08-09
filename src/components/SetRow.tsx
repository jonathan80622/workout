import React, { useState } from 'react';
import { Check, Trash2, Plus, Minus, Footprints, Clock } from 'lucide-react';
import { WorkoutSet, SetType, WeightUnit } from '../types';

interface SetRowProps {
  set: WorkoutSet;
  index: number;
  unit: WeightUnit;
  isCardio?: boolean;
  onUpdate: (updatedSet: WorkoutSet) => void;
  onDelete: () => void;
}

export const SetRow: React.FC<SetRowProps> = ({
  set,
  index,
  unit,
  isCardio = false,
  onUpdate,
  onDelete
}) => {
  const [showCardioFields, setShowCardioFields] = useState<boolean>(isCardio || (set.distance !== undefined && set.distance > 0));

  const handleTypeChange = (newType: SetType) => {
    onUpdate({ ...set, type: newType });
  };

  const handleWeightChange = (delta: number) => {
    const next = Math.max(0, set.weight + delta);
    onUpdate({ ...set, weight: next });
  };

  const handleRepsChange = (delta: number) => {
    const next = Math.max(0, set.reps + delta);
    onUpdate({ ...set, reps: next });
  };

  const handleDistanceChange = (delta: number) => {
    const next = Math.max(0, Math.round(((set.distance || 0) + delta) * 100) / 100);
    onUpdate({ ...set, distance: next });
  };

  const handleRunningTimeChange = (delta: number) => {
    const next = Math.max(0, (set.runningTimeMinutes || 0) + delta);
    onUpdate({ ...set, runningTimeMinutes: next });
  };

  const toggleCompleted = () => {
    onUpdate({ ...set, completed: !set.completed });
  };

  // Pace calculation helper
  const calculatePace = () => {
    if (!set.distance || set.distance <= 0 || !set.runningTimeMinutes || set.runningTimeMinutes <= 0) return null;
    const paceTotalMin = set.runningTimeMinutes / set.distance;
    const paceMin = Math.floor(paceTotalMin);
    const paceSec = Math.round((paceTotalMin - paceMin) * 60);
    const paddedSec = paceSec < 10 ? `0${paceSec}` : `${paceSec}`;
    return `${paceMin}:${paddedSec} /mi`;
  };

  const paceText = calculatePace();

  return (
    <div className="space-y-1.5">
      <div className={`flex flex-wrap sm:flex-nowrap items-center gap-2 py-2 px-2.5 rounded-xl transition-all border ${
        set.completed 
          ? 'bg-[#1e2a22]/70 border-[#849a88]/60 text-[#f7f3ee]' 
          : 'bg-[#211b18]/80 border-[#382f29] hover:bg-[#28221d]'
      }`}>
        {/* Set Type Selector */}
        <div className="flex items-center gap-1">
          <select
            value={set.type}
            onChange={(e) => handleTypeChange(e.target.value as SetType)}
            className="bg-[#100d0b] border border-[#382f29] text-[#f7f3ee] text-xs font-bold rounded-lg px-2 py-1 focus:ring-1 focus:ring-[#d97724] outline-none cursor-pointer font-syne"
          >
            <option value="working">Set {index + 1}</option>
            <option value="warmup">Warmup (W)</option>
            <option value="drop">Drop (D)</option>
            <option value="failure">Failure (F)</option>
          </select>
        </div>

        {showCardioFields ? (
          /* Cardio Fields: Distance & Running Time */
          <div className="flex-1 flex flex-wrap sm:flex-nowrap items-center gap-2">
            {/* Distance Control */}
            <div className="flex-1 flex items-center justify-center gap-1 bg-[#100d0b] rounded-lg p-1 border border-[#382f29]">
              <button
                type="button"
                onClick={() => handleDistanceChange(-0.5)}
                className="w-6 h-6 rounded bg-[#211b18] hover:bg-[#2e2622] text-[#c8b8a8] flex items-center justify-center transition-colors text-xs font-bold"
                title="-0.5 mi"
              >
                <Minus className="w-3 h-3" />
              </button>
              <div className="flex items-center gap-1">
                <Footprints className="w-3 h-3 text-[#d97724]" />
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={set.distance !== undefined ? set.distance : ''}
                  placeholder="0.0"
                  onChange={(e) => onUpdate({ ...set, distance: parseFloat(e.target.value) || 0 })}
                  className="w-14 text-center bg-transparent text-[#f7f3ee] font-mono font-bold text-sm outline-none"
                />
                <span className="text-[10px] text-[#8c7e72] font-medium">mi</span>
              </div>
              <button
                type="button"
                onClick={() => handleDistanceChange(0.5)}
                className="w-6 h-6 rounded bg-[#211b18] hover:bg-[#2e2622] text-[#c8b8a8] flex items-center justify-center transition-colors text-xs font-bold"
                title="+0.5 mi"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>

            {/* Running Time Control */}
            <div className="flex-1 flex items-center justify-center gap-1 bg-[#100d0b] rounded-lg p-1 border border-[#382f29]">
              <button
                type="button"
                onClick={() => handleRunningTimeChange(-1)}
                className="w-6 h-6 rounded bg-[#211b18] hover:bg-[#2e2622] text-[#c8b8a8] flex items-center justify-center transition-colors text-xs font-bold"
                title="-1 min"
              >
                <Minus className="w-3 h-3" />
              </button>
              <div className="flex items-center gap-1">
                <Clock className="w-3 h-3 text-[#849a88]" />
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={set.runningTimeMinutes !== undefined ? set.runningTimeMinutes : ''}
                  placeholder="0"
                  onChange={(e) => onUpdate({ ...set, runningTimeMinutes: parseInt(e.target.value, 10) || 0 })}
                  className="w-12 text-center bg-transparent text-[#f7f3ee] font-mono font-bold text-sm outline-none"
                />
                <span className="text-[10px] text-[#8c7e72] font-medium">min</span>
              </div>
              <button
                type="button"
                onClick={() => handleRunningTimeChange(1)}
                className="w-6 h-6 rounded bg-[#211b18] hover:bg-[#2e2622] text-[#c8b8a8] flex items-center justify-center transition-colors text-xs font-bold"
                title="+1 min"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>
          </div>
        ) : (
          /* Standard Weight & Reps Controls */
          <>
            {/* Weight Controls */}
            <div className="flex-1 flex items-center justify-center gap-1 bg-[#100d0b] rounded-lg p-1 border border-[#382f29]">
              <button
                type="button"
                onClick={() => handleWeightChange(-5)}
                className="w-6 h-6 rounded bg-[#211b18] hover:bg-[#2e2622] text-[#c8b8a8] flex items-center justify-center transition-colors text-xs font-bold"
                title="Minus 5"
              >
                <Minus className="w-3 h-3" />
              </button>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={set.weight || ''}
                  placeholder="0"
                  onChange={(e) => onUpdate({ ...set, weight: parseFloat(e.target.value) || 0 })}
                  className="w-14 text-center bg-transparent text-[#f7f3ee] font-mono font-bold text-sm outline-none"
                />
                <span className="text-[10px] text-[#8c7e72] font-medium">{unit}</span>
              </div>
              <button
                type="button"
                onClick={() => handleWeightChange(5)}
                className="w-6 h-6 rounded bg-[#211b18] hover:bg-[#2e2622] text-[#c8b8a8] flex items-center justify-center transition-colors text-xs font-bold"
                title="Plus 5"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>

            {/* Reps Controls */}
            <div className="w-28 flex items-center justify-center gap-1 bg-[#100d0b] rounded-lg p-1 border border-[#382f29]">
              <button
                type="button"
                onClick={() => handleRepsChange(-1)}
                className="w-6 h-6 rounded bg-[#211b18] hover:bg-[#2e2622] text-[#c8b8a8] flex items-center justify-center transition-colors text-xs font-bold"
              >
                <Minus className="w-3 h-3" />
              </button>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min="0"
                  value={set.reps || ''}
                  placeholder="0"
                  onChange={(e) => onUpdate({ ...set, reps: parseInt(e.target.value, 10) || 0 })}
                  className="w-10 text-center bg-transparent text-[#f7f3ee] font-mono font-bold text-sm outline-none"
                />
                <span className="text-[10px] text-[#8c7e72] font-medium">reps</span>
              </div>
              <button
                type="button"
                onClick={() => handleRepsChange(1)}
                className="w-6 h-6 rounded bg-[#211b18] hover:bg-[#2e2622] text-[#c8b8a8] flex items-center justify-center transition-colors text-xs font-bold"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>
          </>
        )}

        {/* Toggle Mode Button (Distance/Time vs Weight/Reps) */}
        {!isCardio && (
          <button
            type="button"
            onClick={() => setShowCardioFields(!showCardioFields)}
            className={`p-1.5 rounded-lg border transition-colors ${
              showCardioFields 
                ? 'bg-[#d97724]/20 text-[#e6a15c] border-[#d97724]/40' 
                : 'bg-[#100d0b] text-[#8c7e72] hover:text-[#f7f3ee] border-[#382f29]'
            }`}
            title={showCardioFields ? 'Switch to Weight & Reps' : 'Add Distance & Run Time'}
          >
            <Footprints className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Checkmark Completed Toggle */}
        <button
          type="button"
          onClick={toggleCompleted}
          className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all ${
            set.completed
              ? 'bg-[#d97724] text-[#0c0a09] shadow-md shadow-[#d97724]/20 font-bold scale-105'
              : 'bg-[#211b18] text-[#6b5e54] hover:bg-[#2e2622] hover:text-[#c8b8a8] border border-[#382f29]'
          }`}
          title={set.completed ? 'Completed' : 'Mark completed'}
        >
          <Check className="w-4 h-4 stroke-[3]" />
        </button>

        {/* Delete button */}
        <button
          type="button"
          onClick={onDelete}
          className="p-1.5 rounded-lg text-[#6b5e54] hover:text-[#c86d51] hover:bg-[#c86d51]/10 transition-colors"
          title="Delete set"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Pace indicator if cardio fields are filled */}
      {showCardioFields && paceText && (
        <div className="flex items-center justify-end gap-2 px-2 text-[10px] text-[#e6a15c] font-mono">
          <span>⚡ Pace: <strong>{paceText}</strong></span>
        </div>
      )}
    </div>
  );
};

