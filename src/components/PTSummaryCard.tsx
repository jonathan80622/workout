import React from 'react';
import { Compass, Calendar, Clock, Award, Activity, Flame, HeartPulse, UserCheck, Sparkles, Feather, Sun, Globe } from 'lucide-react';
import { Workout, WeightUnit } from '../types';
import { 
  calculateWorkoutVolume, 
  calculateCompletedSets, 
  calculateCompletedReps, 
  getHeaviestSet, 
  formatWorkoutDate, 
  calculateTotalDistance, 
  calculateTotalRunningTime, 
  calculateAveragePace,
  getDayOfWeekTheme,
  formatDateEn,
  formatDateZh,
  translateSeatSettings
} from '../utils/formatters';

interface PTSummaryCardProps {
  workout: Workout;
  unit: WeightUnit;
  customPtNote?: string;
  themeStyle?: 'amber-warmth' | 'sage-green' | 'sunset-rose' | 'light-sand';
  showSeatSettings?: boolean;
  language?: 'en' | 'zh';
  customClientName?: string;
  customPtName?: string;
  customDate?: string;
}

const CATEGORY_MAP_ZH: Record<string, string> = {
  'Quads': '股四頭肌',
  'Hamstrings & Glutes': '腘繩肌與臀大肌',
  'Chest': '胸部力量',
  'Back': '背部肌群',
  'Shoulders': '肩部三角肌',
  'Arms': '手臂雙頭/三頭肌',
  'Abs & Core': '核心與腹肌',
  'Calves': '小腿肌群',
  'Lower Back': '下背背肌',
  'Forearms': '前臂肌群',
  'Cardio & Running': '跑步與有氧'
};

export const PTSummaryCard: React.FC<PTSummaryCardProps> = ({
  workout,
  unit,
  customPtNote,
  themeStyle = 'amber-warmth',
  showSeatSettings = true,
  language = 'zh',
  customClientName,
  customPtName,
  customDate
}) => {
  const isZh = language === 'zh';
  const dateToUse = customDate || workout.date;
  const totalVolume = calculateWorkoutVolume(workout);
  const totalSets = calculateCompletedSets(workout);
  const totalReps = calculateCompletedReps(workout);
  const heaviest = getHeaviestSet(workout);
  const totalDistance = calculateTotalDistance(workout);
  const totalRunningTime = calculateTotalRunningTime(workout);
  const avgPace = calculateAveragePace(totalDistance, totalRunningTime);

  const displayClientName = customClientName !== undefined
    ? customClientName
    : (workout.clientName || '');

  const displayPtName = customPtName !== undefined
    ? customPtName
    : (workout.ptName || '');

  // Calculate Day of Week theme
  const dayTheme = getDayOfWeekTheme(dateToUse);

  const themeClassesMap = {
    'amber-warmth': {
      bg: 'bg-[#14110f] text-[#f7f3ee]',
      headerBg: 'bg-gradient-to-r from-[#d97724] via-[#c86d51] to-[#e6a15c]',
      accentText: 'text-[#e6a15c]',
      badgeBg: 'bg-[#d97724]/15 border-[#d97724]/30 text-[#f5c999]',
      exerciseCard: 'bg-[#1c1815] border-[#2b241f]',
      feedbackCard: 'bg-[#231d19] border-[#382f29]'
    },
    'sage-green': {
      bg: 'bg-[#111814] text-[#f4f7f4]',
      headerBg: 'bg-gradient-to-r from-[#5a7360] via-[#849a88] to-[#a3b8a7]',
      accentText: 'text-[#a3b8a7]',
      badgeBg: 'bg-[#849a88]/20 border-[#849a88]/40 text-[#e4ece5]',
      exerciseCard: 'bg-[#18211b] border-[#28352b]',
      feedbackCard: 'bg-[#1e2a22] border-[#2a382d]'
    },
    'sunset-rose': {
      bg: 'bg-[#181116] text-[#f9f2f5]',
      headerBg: 'bg-gradient-to-r from-[#c08497] via-[#d97724] to-[#e2b3c2]',
      accentText: 'text-[#e2b3c2]',
      badgeBg: 'bg-[#c08497]/20 border-[#c08497]/40 text-[#f7e2e8]',
      exerciseCard: 'bg-[#21171e] border-[#33222e]',
      feedbackCard: 'bg-[#2b1c27] border-[#3d2737]'
    },
    'light-sand': {
      bg: 'bg-[#f7f3ee] text-[#1c1815]',
      headerBg: 'bg-gradient-to-r from-[#2c241f] via-[#382f29] to-[#1c1815]',
      accentText: 'text-[#d97724]',
      badgeBg: 'bg-[#d97724]/10 border-[#d97724]/20 text-[#8c4b18]',
      exerciseCard: 'bg-[#ffffff] border-[#e6ddd2] shadow-sm',
      feedbackCard: 'bg-[#f2ebe1] border-[#d8ccbe]'
    }
  };

  const themeClasses = themeClassesMap[themeStyle] || themeClassesMap['amber-warmth'];
  const effectivePtNote = customPtNote !== undefined ? customPtNote : workout.ptNotes;

  const unitText = isZh ? (unit === 'lbs' ? '磅' : '公斤') : unit;

  return (
    <div
      id="pt-summary-card-export"
      style={{
        borderColor: dayTheme.borderColor,
        boxShadow: `0 0 28px ${dayTheme.glowColor}`
      }}
      className={`w-full max-w-lg mx-auto rounded-3xl border-[3.5px] shadow-2xl overflow-hidden ${themeClasses.bg} font-sans select-none relative transition-all`}
    >
      {/* First-Class Hero Day of Week & Date Header Banner */}
      <div className={`p-5 ${themeClasses.headerBg} text-white relative`}>
        {/* Top Badges */}
        <div className="flex items-center justify-between mb-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/30 backdrop-blur-md text-xs font-syne font-bold border border-white/20">
            <Sun className="w-3.5 h-3.5" style={{ color: dayTheme.borderColor }} />
            <span>{isZh ? dayTheme.dayNameZh : dayTheme.dayNameEn}</span>
            <span className="opacity-60">•</span>
            <span className="text-[10px] font-mono uppercase tracking-wider">{dayTheme.shortDayEn} COLOR</span>
          </div>

          <div className="inline-flex items-center gap-1 text-[11px] font-syne font-semibold bg-black/25 px-3 py-1 rounded-full backdrop-blur-md border border-white/10">
            <Sparkles className="w-3 h-3 text-white/90" />
            <span>{isZh ? '教練報告卡' : 'PT Card'}</span>
          </div>
        </div>

        {/* First Class Date & Day Title Feature */}
        <div className="my-2 space-y-1">
          <div className="flex items-baseline gap-2">
            <h1 className="text-2xl sm:text-3xl font-serif font-extrabold tracking-tight text-white drop-shadow-md">
              {dayTheme.dayNameZh} <span className="text-lg font-sans font-normal opacity-85">/ {dayTheme.dayNameEn}</span>
            </h1>
          </div>
          <p className="text-sm font-mono font-medium text-white/90 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-white/80" />
            <span>{formatDateZh(dateToUse)}</span>
            <span className="opacity-50">|</span>
            <span className="text-xs opacity-90">{formatDateEn(dateToUse)}</span>
          </p>
        </div>

        {/* Workout Session Subtitle */}
        <div className="mt-3 pt-3 border-t border-white/20 flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-syne font-bold tracking-widest text-white/80 block">
              {isZh ? '訓練主題 / SESSION' : 'WORKOUT SESSION'}
            </span>
            <h2 className="text-base font-serif font-bold text-white leading-tight">
              {workout.title || (isZh ? '自主訓練課表' : 'Workout Session')}
            </h2>
          </div>
          <div className="text-right text-xs font-syne font-medium bg-black/20 px-3 py-1.5 rounded-xl border border-white/15">
            <Clock className="w-3.5 h-3.5 inline mr-1 text-white/80" />
            <span>{workout.durationMinutes || 45} {isZh ? '分鐘' : 'mins'}</span>
          </div>
        </div>

        {/* Client & Coach Row */}
        {(displayClientName.trim() !== '' || displayPtName.trim() !== '') && (
          <div className="flex items-center justify-between text-xs font-medium pt-2.5 mt-2.5 border-t border-white/15">
            {displayClientName.trim() !== '' ? (
              <div className="flex items-center gap-1.5">
                <UserCheck className="w-3.5 h-3.5 text-white/90" />
                <span>{isZh ? '學員' : 'Athlete'}: <strong className="font-serif font-bold text-white underline underline-offset-2">{displayClientName}</strong></span>
              </div>
            ) : <div />}
            {displayPtName.trim() !== '' ? (
              <div className="text-white/90">
                <span>{isZh ? '教練 / PT' : 'Coach'}: <strong className="font-serif font-bold text-white">{displayPtName}</strong></span>
              </div>
            ) : <div />}
          </div>
        )}
      </div>

      {/* Core Metrics & Breakdown Section */}
      <div className="p-4 space-y-3">
        {/* Summary Metric Cards */}
        <div className={`grid ${totalDistance > 0 ? 'grid-cols-4' : 'grid-cols-3'} gap-2`}>
          <div className="bg-black/15 p-2.5 rounded-2xl border border-black/10 text-center">
            <span className="text-[10px] opacity-70 uppercase font-syne block">
              {isZh ? '總容量' : 'Total Volume'}
            </span>
            <span className="text-base font-bold font-mono text-[#e6a15c]">
              {totalVolume.toLocaleString()} <span className="text-xs font-normal">{unitText}</span>
            </span>
          </div>
          <div className="bg-black/15 p-2.5 rounded-2xl border border-black/10 text-center">
            <span className="text-[10px] opacity-70 uppercase font-syne block">
              {isZh ? '完成組數' : 'Completed Sets'}
            </span>
            <span className="text-base font-bold font-mono text-[#849a88]">
              {totalSets} <span className="text-xs opacity-70 font-normal">{isZh ? '組' : 'sets'}</span>
            </span>
          </div>
          <div className="bg-black/15 p-2.5 rounded-2xl border border-black/10 text-center">
            <span className="text-[10px] opacity-70 uppercase font-syne block">
              {isZh ? '總次數' : 'Total Reps'}
            </span>
            <span className="text-base font-bold font-mono text-[#c86d51]">
              {totalReps} <span className="text-xs opacity-70 font-normal">{isZh ? '次' : 'reps'}</span>
            </span>
          </div>
          {totalDistance > 0 && (
            <div className="bg-black/15 p-2.5 rounded-2xl border border-black/10 text-center">
              <span className="text-[10px] opacity-70 uppercase font-syne block">
                {isZh ? '累積距離' : 'Distance'}
              </span>
              <span className="text-base font-bold font-mono text-[#d97724]">
                {totalDistance} <span className="text-xs opacity-70 font-normal">{isZh ? '英里' : 'mi'}</span>
              </span>
            </div>
          )}
        </div>

        {/* Running Highlight Banner */}
        {totalDistance > 0 && (
          <div className="flex items-center justify-between bg-[#849a88]/15 border border-[#849a88]/30 px-3 py-2 rounded-xl text-xs">
            <span className="flex items-center gap-1.5 font-serif italic text-[#849a88]">
              <Flame className="w-4 h-4 text-[#849a88]" />
              {isZh ? '跑步與有氧數據' : 'Running & Cardio Stats'}
            </span>
            <span className="font-mono font-bold text-[#f7f3ee]">
              {totalDistance} {isZh ? '英里' : 'mi'} / {totalRunningTime || workout.durationMinutes} {isZh ? '分鐘' : 'mins'} ({avgPace} {isZh ? '配速' : 'pace'})
            </span>
          </div>
        )}

        {/* Heaviest Lift Highlight */}
        {heaviest && (
          <div className="flex items-center justify-between bg-[#d97724]/10 border border-[#d97724]/30 px-3 py-2 rounded-xl text-xs">
            <span className="flex items-center gap-1.5 font-serif italic text-[#e6a15c]">
              <Award className="w-4 h-4 text-[#e6a15c]" />
              {isZh ? '最佳重量突破' : 'Peak Load Highlight'}
            </span>
            <span className="font-mono font-bold text-[#f5c999]">
              {heaviest.machineName}: {heaviest.weight} {unitText} × {heaviest.reps} {isZh ? '次' : 'reps'}
            </span>
          </div>
        )}

        {/* Exercises Breakdown */}
        <div className="space-y-3 pt-2">
          <h3 className="text-xs font-serif italic font-semibold opacity-70 tracking-wider flex items-center justify-between">
            <span>{isZh ? '動作與器材明細' : 'Exercise & Machine Breakdown'}</span>
            <span className="text-[10px] font-sans font-normal">
              {workout.exercises.length} {isZh ? '項動作' : 'Exercises'}
            </span>
          </h3>

          {workout.exercises.map((exercise, idx) => {
            const completedSets = exercise.sets.filter(s => s.completed);
            const categoryDisplay = isZh ? (CATEGORY_MAP_ZH[exercise.category] || exercise.category) : exercise.category;

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
                        ⚙️ {isZh ? '座椅與角度刻度:' : 'Alignment:'} <span className="opacity-90">{translateSeatSettings(exercise.seatSettings, isZh)}</span>
                      </p>
                    )}
                  </div>
                  <span className="text-[10px] font-syne font-semibold opacity-80 bg-black/20 px-2.5 py-0.5 rounded-full border border-black/10">
                    {categoryDisplay}
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
                          {s.type === 'warmup' ? (isZh ? '熱身' : 'W') : 
                           s.type === 'drop' ? (isZh ? '遞減' : 'D') : 
                           s.type === 'failure' ? (isZh ? '力竭' : 'F') : 
                           (isZh ? `組${s.setNumber}` : `#${s.setNumber}`)}
                        </span>
                        {s.distance && s.distance > 0 ? (
                          <>
                            <span className="font-bold">{s.distance} <span className="text-[10px] opacity-60">{isZh ? '英里' : 'mi'}</span></span>
                            {s.runningTimeMinutes ? (
                              <>
                                <span className="opacity-40">•</span>
                                <span className="font-bold text-[#849a88]">{s.runningTimeMinutes} <span className="text-[10px] opacity-60">{isZh ? '分' : 'min'}</span></span>
                              </>
                            ) : null}
                          </>
                        ) : (
                          <>
                            <span className="font-bold">{s.weight} <span className="text-[10px] opacity-60">{unitText}</span></span>
                            <span className="opacity-40">×</span>
                            <span className="font-bold text-[#849a88]">{s.reps} <span className="text-[10px] opacity-60">{isZh ? '次' : 'reps'}</span></span>
                          </>
                        )}
                      </div>
                    ))
                  ) : (
                    <span className="text-xs opacity-50 italic">
                      {isZh ? '尚未記錄完成組數' : 'No completed sets logged'}
                    </span>
                  )}
                </div>

                {/* Muscle Feel Feedback Box per exercise */}
                {exercise.muscleFeeling && (exercise.muscleFeeling.notes || exercise.muscleFeeling.targetMuscles.length > 0) && (
                  <div className={`p-3 rounded-xl border text-xs space-y-1.5 ${themeClasses.feedbackCard}`}>
                    <div className="flex items-center justify-between text-[#e6a15c] font-serif italic text-xs">
                      <span className="flex items-center gap-1">
                        <Activity className="w-3.5 h-3.5 text-[#d97724]" />
                        {isZh ? '肌肉感知與充血反饋' : 'Muscle Sensation Feedback'}
                      </span>
                      {exercise.muscleFeeling.pumpQuality > 0 && (
                        <span className="flex items-center gap-1 text-[#e6a15c] text-[10px] font-syne">
                          <Flame className="w-3 h-3" /> {isZh ? '充血:' : 'Pump:'} {'✦'.repeat(exercise.muscleFeeling.pumpQuality)}
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

        {/* Direct Note to Trainer / PT */}
        {effectivePtNote && (
          <div className="bg-gradient-to-r from-[#d97724]/10 via-[#c86d51]/10 to-transparent border border-[#d97724]/30 p-3.5 rounded-2xl space-y-1 mt-3">
            <span className="text-[10px] uppercase font-syne font-bold text-[#e6a15c] tracking-wider flex items-center gap-1">
              <Feather className="w-3.5 h-3.5" />
              {isZh ? '給指導教練 / PT 的心得備忘' : 'Note to Personal Trainer / Coach'}
            </span>
            <p className="text-xs font-serif italic leading-relaxed opacity-90">
              "{effectivePtNote}"
            </p>
          </div>
        )}

        {/* Footer Brand Watermark */}
        <div className="pt-3 pb-1 border-t border-black/10 text-center text-[10px] opacity-60 font-syne flex items-center justify-between">
          <span>{isZh ? '健身隨身日誌 • 專業教練報告' : 'Workout Tracker • PT Report'}</span>
          <span className="font-mono">{dayTheme.shortDayEn} THEME</span>
        </div>
      </div>
    </div>
  );
};


