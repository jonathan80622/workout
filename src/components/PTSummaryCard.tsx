import React from 'react';
import { Compass, Calendar, Clock, Award, Activity, Flame, HeartPulse, UserCheck, Sparkles, Feather } from 'lucide-react';
import { Workout, WeightUnit } from '../types';
import { calculateWorkoutVolume, calculateCompletedSets, calculateCompletedReps, getHeaviestSet, formatWorkoutDate } from '../utils/formatters';

interface PTSummaryCardProps {
  workout: Workout;
  unit: WeightUnit;
  customPtNote?: string;
  themeStyle?: 'othership-sanctuary' | 'somatic-sage' | 'aura-sunset' | 'ethereal-sand';
  showSeatSettings?: boolean;
}

export const PTSummaryCard: React.FC<PTSummaryCardProps> = ({
  workout,
  unit,
  customPtNote,
  themeStyle = 'othership-sanctuary',
  showSeatSettings = true
}) => {
  const totalVolume = calculateWorkoutVolume(workout);
  const totalSets = calculateCompletedSets(workout);
  const totalReps = calculateCompletedReps(workout);
  const heaviest = getHeaviestSet(workout);

  const themeClasses = {
    'othership-sanctuary': {
      bg: 'bg-[#14110f] text-[#f7f3ee] border-[#382f29]',
      headerBg: 'bg-gradient-to-r from-[#d97724] via-[#c86d51] to-[#e6a15c]',
      accentText: 'text-[#e6a15c]',
      badgeBg: 'bg-[#d97724]/15 border-[#d97724]/30 text-[#f5c999]',
      exerciseCard: 'bg-[#1c1815] border-[#2b241f]',
      feedbackCard: 'bg-[#231d19] border-[#382f29]'
    },
    'somatic-sage': {
      bg: 'bg-[#111814] text-[#f4f7f4] border-[#2a382d]',
      headerBg: 'bg-gradient-to-r from-[#5a7360] via-[#849a88] to-[#a3b8a7]',
      accentText: 'text-[#a3b8a7]',
      badgeBg: 'bg-[#849a88]/20 border-[#849a88]/40 text-[#e4ece5]',
      exerciseCard: 'bg-[#18211b] border-[#28352b]',
      feedbackCard: 'bg-[#1e2a22] border-[#2a382d]'
    },
    'aura-sunset': {
      bg: 'bg-[#181116] text-[#f9f2f5] border-[#382431]',
      headerBg: 'bg-gradient-to-r from-[#c08497] via-[#d97724] to-[#e2b3c2]',
      accentText: 'text-[#e2b3c2]',
      badgeBg: 'bg-[#c08497]/20 border-[#c08497]/40 text-[#f7e2e8]',
      exerciseCard: 'bg-[#21171e] border-[#33222e]',
      feedbackCard: 'bg-[#2b1c27] border-[#3d2737]'
    },
    'ethereal-sand': {
      bg: 'bg-[#f7f3ee] text-[#1c1815] border-[#e2d8cd]',
      headerBg: 'bg-gradient-to-r from-[#2c241f] via-[#382f29] to-[#1c1815]',
      accentText: 'text-[#d97724]',
      badgeBg: 'bg-[#d97724]/10 border-[#d97724]/20 text-[#8c4b18]',
      exerciseCard: 'bg-[#ffffff] border-[#e6ddd2] shadow-sm',
      feedbackCard: 'bg-[#f2ebe1] border-[#d8ccbe]'
    }
  }[themeStyle];

  const effectivePtNote = customPtNote !== undefined ? customPtNote : workout.ptNotes;

  return (
    <div
      id="pt-summary-card-export"
      className={`w-full max-w-lg mx-auto rounded-3xl border shadow-2xl overflow-hidden ${themeClasses.bg} font-sans select-none relative`}
    >
      {/* Top Banner Header */}
      <div className={`p-5 ${themeClasses.headerBg} text-white relative`}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-full bg-black/20 backdrop-blur-md">
              <Compass className="w-5 h-5 text-white" />
            </span>
            <div>
              <span className="text-[10px] uppercase font-syne font-bold tracking-widest text-white/90 block">
                Somatic Movement Report
              </span>
              <h2 className="text-xl font-serif font-semibold tracking-tight leading-tight">
                {workout.title || 'Somatic Ritual Session'}
              </h2>
            </div>
          </div>
          <div className="text-right">
            <span className="inline-flex items-center gap-1 text-[11px] font-syne font-semibold bg-black/20 px-3 py-1 rounded-full backdrop-blur-md">
              <Sparkles className="w-3 h-3 text-white/90" /> Guide Report
            </span>
          </div>
        </div>

        {/* Client & Guide Names */}
        <div className="flex items-center justify-between text-xs font-medium pt-2 border-t border-white/20">
          <div className="flex items-center gap-1.5">
            <UserCheck className="w-3.5 h-3.5 text-white/90" />
            <span>Member: <strong className="font-serif font-bold text-white underline underline-offset-2">{workout.clientName || 'Jordan'}</strong></span>
          </div>
          <div className="text-white/90">
            <span>Guide: <strong className="font-serif font-bold text-white">{workout.ptName || 'Coach'}</strong></span>
          </div>
        </div>
      </div>

      {/* Date & Core Metrics Strip */}
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between text-xs opacity-80 font-medium bg-black/10 px-3.5 py-2 rounded-xl border border-black/10">
          <span className="flex items-center gap-1.5 font-serif italic">
            <Calendar className="w-3.5 h-3.5 text-[#d97724]" />
            {formatWorkoutDate(workout.date)}
          </span>
          <span className="flex items-center gap-1.5 font-syne text-[11px]">
            <Clock className="w-3.5 h-3.5 text-[#849a88]" />
            {workout.durationMinutes || 45} mins flow
          </span>
        </div>

        {/* Summary Metric Cards */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-black/15 p-2.5 rounded-2xl border border-black/10 text-center">
            <span className="text-[10px] opacity-70 uppercase font-syne block">Total Volume</span>
            <span className="text-base font-bold font-mono text-[#e6a15c]">
              {totalVolume.toLocaleString()} <span className="text-xs font-normal">{unit}</span>
            </span>
          </div>
          <div className="bg-black/15 p-2.5 rounded-2xl border border-black/10 text-center">
            <span className="text-[10px] opacity-70 uppercase font-syne block">Completed Sets</span>
            <span className="text-base font-bold font-mono text-[#849a88]">
              {totalSets} <span className="text-xs opacity-70 font-normal">sets</span>
            </span>
          </div>
          <div className="bg-black/15 p-2.5 rounded-2xl border border-black/10 text-center">
            <span className="text-[10px] opacity-70 uppercase font-syne block">Total Reps</span>
            <span className="text-base font-bold font-mono text-[#c86d51]">
              {totalReps} <span className="text-xs opacity-70 font-normal">reps</span>
            </span>
          </div>
        </div>

        {/* Heaviest Lift Highlight */}
        {heaviest && (
          <div className="flex items-center justify-between bg-[#d97724]/10 border border-[#d97724]/30 px-3 py-2 rounded-xl text-xs">
            <span className="flex items-center gap-1.5 font-serif italic text-[#e6a15c]">
              <Award className="w-4 h-4 text-[#e6a15c]" /> Peak Load Highlight
            </span>
            <span className="font-mono font-bold text-[#f5c999]">
              {heaviest.machineName}: {heaviest.weight} {unit} × {heaviest.reps} reps
            </span>
          </div>
        )}

        {/* Exercises Breakdown */}
        <div className="space-y-3 pt-2">
          <h3 className="text-xs font-serif italic font-semibold opacity-70 tracking-wider flex items-center justify-between">
            <span>Somatic Vessel & Exercise Flow</span>
            <span className="text-[10px] font-sans font-normal">{workout.exercises.length} Exercises</span>
          </h3>

          {workout.exercises.map((exercise, idx) => {
            const completedSets = exercise.sets.filter(s => s.completed);

            return (
              <div
                key={exercise.id || idx}
                className={`p-3.5 rounded-2xl border space-y-2.5 ${themeClasses.exerciseCard}`}
              >
                {/* Header for Exercise */}
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="text-sm font-serif font-bold flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-[#d97724]/20 text-[#e6a15c] flex items-center justify-center text-xs font-mono font-bold">
                        {idx + 1}
                      </span>
                      {exercise.machineName}
                    </h4>
                    {showSeatSettings && exercise.seatSettings && (
                      <p className="text-[11px] opacity-75 mt-0.5 font-medium">
                        ⚙️ Alignment: <span className="opacity-90">{exercise.seatSettings}</span>
                      </p>
                    )}
                  </div>
                  <span className="text-[10px] font-syne font-semibold opacity-80 bg-black/20 px-2.5 py-0.5 rounded-full border border-black/10">
                    {exercise.category}
                  </span>
                </div>

                {/* Set Pills */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {completedSets.length > 0 ? (
                    completedSets.map((s) => (
                      <div
                        key={s.id}
                        className="bg-black/20 border border-black/10 px-2.5 py-1 rounded-xl text-xs font-mono flex items-center gap-1.5"
                      >
                        <span className={`text-[10px] font-bold px-1 rounded ${
                          s.type === 'warmup' ? 'bg-[#d97724]/20 text-[#e6a15c]' :
                          s.type === 'drop' ? 'bg-[#c08497]/20 text-[#e2b3c2]' :
                          s.type === 'failure' ? 'bg-[#c86d51]/20 text-[#e08265]' : 'bg-[#849a88]/20 text-[#a3b8a7]'
                        }`}>
                          {s.type === 'warmup' ? 'W' : s.type === 'drop' ? 'D' : s.type === 'failure' ? 'F' : `#${s.setNumber}`}
                        </span>
                        <span className="font-bold">{s.weight} <span className="text-[10px] opacity-60">{unit}</span></span>
                        <span className="opacity-40">×</span>
                        <span className="font-bold text-[#849a88]">{s.reps} <span className="text-[10px] opacity-60">reps</span></span>
                      </div>
                    ))
                  ) : (
                    <span className="text-xs opacity-50 italic">No completed sets logged</span>
                  )}
                </div>

                {/* Muscle Feel Feedback Box per exercise */}
                {exercise.muscleFeeling && (exercise.muscleFeeling.notes || exercise.muscleFeeling.targetMuscles.length > 0) && (
                  <div className={`p-3 rounded-xl border text-xs space-y-1.5 ${themeClasses.feedbackCard}`}>
                    <div className="flex items-center justify-between text-[#e6a15c] font-serif italic text-xs">
                      <span className="flex items-center gap-1">
                        <Activity className="w-3.5 h-3.5 text-[#d97724]" />
                        Somatic Feedback
                      </span>
                      {exercise.muscleFeeling.pumpQuality > 0 && (
                        <span className="flex items-center gap-1 text-[#e6a15c] text-[10px] font-syne">
                          <Flame className="w-3 h-3" /> Aura: {'✦'.repeat(exercise.muscleFeeling.pumpQuality)}
                        </span>
                      )}
                    </div>

                    {/* Detailed text notes */}
                    {exercise.muscleFeeling.notes && (
                      <p className="text-xs italic bg-black/20 p-2 rounded-lg border border-black/10 leading-relaxed opacity-90">
                        "{exercise.muscleFeeling.notes}"
                      </p>
                    )}

                    {/* Quick Tags */}
                    {exercise.muscleFeeling.quickTags && exercise.muscleFeeling.quickTags.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-0.5">
                        {exercise.muscleFeeling.quickTags.map((tag, tIdx) => (
                          <span
                            key={tIdx}
                            className="bg-[#849a88]/15 border border-[#849a88]/30 text-[#a3b8a7] text-[10px] px-2 py-0.5 rounded-full font-medium"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Direct Note to Guide */}
        {effectivePtNote && (
          <div className="bg-gradient-to-r from-[#d97724]/10 via-[#c86d51]/10 to-transparent border border-[#d97724]/30 p-3.5 rounded-2xl space-y-1 mt-3">
            <span className="text-[10px] uppercase font-syne font-bold text-[#e6a15c] tracking-wider flex items-center gap-1">
              <Feather className="w-3.5 h-3.5" /> Direct Note to Guide / PT
            </span>
            <p className="text-xs font-serif italic leading-relaxed opacity-90">
              "{effectivePtNote}"
            </p>
          </div>
        )}

        {/* Footer Brand Watermark */}
        <div className="pt-3 pb-1 border-t border-black/10 text-center text-[10px] opacity-60 font-syne flex items-center justify-between">
          <span>Somatic Vessel Movement • PT Report</span>
          <span>Othership Alt Sanctuary</span>
        </div>
      </div>
    </div>
  );
};

