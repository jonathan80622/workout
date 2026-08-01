import React from 'react';
import { Activity, Flame, HeartPulse, Sparkles, Heart } from 'lucide-react';
import { MuscleFeeling, MuscleGroup, SorenessLevel, JointComfort } from '../types';

interface MuscleFeelInputProps {
  value: MuscleFeeling;
  onChange: (updated: MuscleFeeling) => void;
  machineName?: string;
}

const MUSCLE_GROUPS: MuscleGroup[] = [
  'Chest',
  'Lats & Back',
  'Quads',
  'Hamstrings',
  'Glutes',
  'Shoulders',
  'Biceps',
  'Triceps',
  'Abs & Core',
  'Calves',
  'Lower Back'
];

const PRESET_QUICK_TAGS = [
  '👁️ Mind-Muscle Connection',
  '🕯️ Deep Somatic Release',
  '🌊 Fluid Joint Harmony',
  '⚡ Peak Vitality / High Aura',
  '🌿 100% Pain Free & Grounded',
  '🪵 Sacred Slow Eccentrics',
  '🧘 Deep Breath & Core Anchor',
  '✨ Ethereal Muscle Sensation'
];

export const MuscleFeelInput: React.FC<MuscleFeelInputProps> = ({
  value,
  onChange,
  machineName
}) => {
  const handleNotesChange = (text: string) => {
    onChange({ ...value, notes: text });
  };

  const toggleMuscleGroup = (group: MuscleGroup) => {
    const exists = value.targetMuscles.includes(group);
    const updated = exists
      ? value.targetMuscles.filter((m) => m !== group)
      : [...value.targetMuscles, group];
    onChange({ ...value, targetMuscles: updated });
  };

  const toggleQuickTag = (tag: string) => {
    const exists = value.quickTags.includes(tag);
    const updated = exists
      ? value.quickTags.filter((t) => t !== tag)
      : [...value.quickTags, tag];
    onChange({ ...value, quickTags: updated });
  };

  const setJointComfort = (comfort: JointComfort) => {
    onChange({ ...value, jointComfort: comfort });
  };

  const setPumpStars = (stars: number) => {
    onChange({ ...value, pumpQuality: stars });
  };

  return (
    <div className="bg-[#181412]/90 border border-[#382f29] rounded-2xl p-4 shadow-xl space-y-4 relative overflow-hidden">
      {/* Background Subtle Ambient Amber Glow */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-[#d97724]/5 rounded-full blur-2xl pointer-events-none" />

      <div className="flex items-center justify-between border-b border-[#2b241f] pb-2.5">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-full bg-[#d97724]/20 text-[#e6a15c]">
            <Activity className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-sm font-serif font-semibold text-[#f7f3ee] flex items-center gap-1.5 tracking-wide">
              Somatic Sensation & Muscle Feel
            </h4>
            <p className="text-[11px] text-[#a39588] font-light">
              {machineName ? `Mind-body feedback for ${machineName}` : 'Describe physical resonance for your Guide / PT'}
            </p>
          </div>
        </div>
        <span className="text-[10px] font-syne font-semibold bg-[#d97724]/10 text-[#f5c999] border border-[#d97724]/30 px-2.5 py-0.5 rounded-full flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-[#e6a15c]" />
          Guide Export
        </span>
      </div>

      {/* Target Muscle Selector */}
      <div>
        <label className="text-xs font-serif italic text-[#c8b8a8] block mb-1.5">
          Where did your vessel feel the deepest activation or heat?
        </label>
        <div className="flex flex-wrap gap-1.5">
          {MUSCLE_GROUPS.map((group) => {
            const isSelected = value.targetMuscles.includes(group);
            return (
              <button
                key={group}
                type="button"
                onClick={() => toggleMuscleGroup(group)}
                className={`text-xs px-2.5 py-1 rounded-full transition-all border ${
                  isSelected
                    ? 'bg-[#d97724] text-[#0c0a09] font-bold border-[#e6a15c] shadow-md shadow-[#d97724]/20 scale-102'
                    : 'bg-[#211b18] text-[#a39588] border-[#382f29] hover:text-[#f7f3ee]'
                }`}
              >
                {group}
              </button>
            );
          })}
        </div>
      </div>

      {/* Text Area for Muscle Feel Description */}
      <div>
        <label className="text-xs font-serif italic text-[#c8b8a8] flex items-center justify-between mb-1.5">
          <span className="flex items-center gap-1">
            <Heart className="w-3.5 h-3.5 text-[#c86d51]" />
            Somatic Sensation Details
          </span>
          <span className="text-[10px] text-[#8c7e72] font-sans">Included in PT PNG</span>
        </label>
        <textarea
          rows={3}
          value={value.notes}
          onChange={(e) => handleNotesChange(e.target.value)}
          placeholder="e.g. Deep quad activation on the final set. Felt grounded in the heels with zero knee tightness."
          className="w-full bg-[#100d0b] border border-[#2b241f] rounded-xl p-3 text-xs text-[#f7f3ee] placeholder-[#6b5e54] focus:outline-none focus:ring-1 focus:ring-[#d97724] resize-none leading-relaxed"
        />
      </div>

      {/* Quick Feeling Tags */}
      <div>
        <label className="text-[11px] font-syne text-[#a39588] block mb-1.5">
          Somatic Feeling Badges (Tap to toggle)
        </label>
        <div className="flex flex-wrap gap-1.5">
          {PRESET_QUICK_TAGS.map((tag) => {
            const isSelected = value.quickTags.includes(tag);
            return (
              <button
                key={tag}
                type="button"
                onClick={() => toggleQuickTag(tag)}
                className={`text-[11px] px-2.5 py-0.5 rounded-full border transition-all ${
                  isSelected
                    ? 'bg-[#849a88]/30 border-[#849a88] text-[#e8f0e9] font-semibold shadow-sm'
                    : 'bg-[#211b18]/80 border-[#382f29] text-[#8c7e72] hover:text-[#c8b8a8]'
                }`}
              >
                {tag}
              </button>
            );
          })}
        </div>
      </div>

      {/* Pump & Joint Controls */}
      <div className="grid grid-cols-2 gap-3 pt-2 border-t border-[#2b241f]">
        {/* Vitality / Pump Rating */}
        <div>
          <span className="text-[11px] font-syne text-[#a39588] block mb-1 flex items-center gap-1">
            <Flame className="w-3 h-3 text-[#e6a15c]" /> Vitality / Pump
          </span>
          <div className="flex items-center gap-1 bg-[#100d0b] p-1.5 rounded-xl border border-[#2b241f]">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setPumpStars(star)}
                className={`flex-1 py-1 text-center text-xs font-bold rounded-lg transition-colors ${
                  star <= value.pumpQuality
                    ? 'bg-[#d97724] text-[#0c0a09] shadow-sm'
                    : 'text-[#4a3f36] hover:text-[#8c7e72]'
                }`}
              >
                ✦
              </button>
            ))}
          </div>
        </div>

        {/* Joint Harmony */}
        <div>
          <span className="text-[11px] font-syne text-[#a39588] block mb-1 flex items-center gap-1">
            <HeartPulse className="w-3 h-3 text-[#c86d51]" /> Joint Harmony
          </span>
          <select
            value={value.jointComfort}
            onChange={(e) => setJointComfort(e.target.value as JointComfort)}
            className="w-full bg-[#100d0b] border border-[#2b241f] text-[#f7f3ee] text-xs font-semibold rounded-xl p-2 outline-none focus:ring-1 focus:ring-[#d97724]"
          >
            <option value="great">🌿 Harmonious (0 Pain)</option>
            <option value="minor_stiffness">🌾 Mild Stiffness</option>
            <option value="discomfort">🍂 Discomfort / Caution</option>
          </select>
        </div>
      </div>
    </div>
  );
};

