import React, { useState } from 'react';
import { toPng, toBlob } from 'html-to-image';
import { Download, Copy, Check, Share2, Calendar, Globe, UserCheck, MessageSquare, Sparkles } from 'lucide-react';
import { Workout, WeightUnit } from '../types';
import { PTSummaryCard } from './PTSummaryCard';
import { ScheduleCalendarModal } from './ScheduleCalendarModal';
import { loadUserProfile, saveUserProfile } from '../utils/storage';

interface PTSummaryStudioProps {
  workout: Workout;
  unit: WeightUnit;
  onClose?: () => void;
}

export const PTSummaryStudio: React.FC<PTSummaryStudioProps> = ({
  workout,
  unit,
  onClose
}) => {
  const [themeStyle, setThemeStyle] = useState<'amber-warmth' | 'sage-green' | 'sunset-rose' | 'light-sand'>('amber-warmth');
  const [language, setLanguage] = useState<'en' | 'zh'>('zh');
  const [customNote, setCustomNote] = useState<string>(workout.ptNotes || '');
  const [showSeatSettings, setShowSeatSettings] = useState<boolean>(true);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState<boolean>(false);

  const [clientName, setClientName] = useState<string>(() => {
    if (workout.clientName) return workout.clientName;
    const prof = loadUserProfile();
    return prof.clientName || '';
  });

  const [ptName, setPtName] = useState<string>(() => {
    if (workout.ptName) return workout.ptName;
    const prof = loadUserProfile();
    return prof.ptName || '';
  });

  const [cardDate, setCardDate] = useState<string>(workout.date || new Date().toISOString());

  const isZh = language === 'zh';

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleDownloadPNG = async () => {
    const cardNode = document.getElementById('pt-summary-card-export');
    if (!cardNode) {
      showToast('Error: Summary card element not found.');
      return;
    }

    try {
      setIsGenerating(true);
      const dataUrl = await toPng(cardNode, { cacheBust: true, pixelRatio: 2 });
      
      const link = document.createElement('a');
      const safeTitle = (workout.title || 'Workout').replace(/[^a-zA-Z0-9]/g, '_');
      const dateStr = new Date().toISOString().split('T')[0];
      link.download = `Workout_PT_Report_${safeTitle}_${language}_${dateStr}.png`;
      link.href = dataUrl;
      link.click();

      showToast(isZh ? '✨ 訓練報告 PNG 圖片已成功下載！' : '✨ Workout PNG Report Card downloaded successfully!');
    } catch (err) {
      console.error('Failed to export PNG:', err);
      showToast(isZh ? '產生 PNG 圖片失敗，請重試。' : 'Failed to generate PNG image. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyPNGToClipboard = async () => {
    const cardNode = document.getElementById('pt-summary-card-export');
    if (!cardNode) return;

    try {
      setIsGenerating(true);
      const blob = await toBlob(cardNode, { cacheBust: true, pixelRatio: 2 });
      if (blob && navigator.clipboard && window.ClipboardItem) {
        await navigator.clipboard.write([
          new window.ClipboardItem({ 'image/png': blob })
        ]);
        showToast(isZh ? '📋 PNG 報告已複製至剪貼簿！可直接貼在教練對話框。' : '📋 PNG copied to clipboard! Ready to paste in your PT chat.');
      } else {
        handleDownloadPNG();
      }
    } catch (err) {
      console.error('Copy to clipboard failed:', err);
      handleDownloadPNG();
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-4 max-w-xl mx-auto">
      {/* Toast Banner */}
      {toastMessage && (
        <div className="bg-[#849a88]/20 border border-[#849a88]/40 text-[#e8f0e9] text-xs font-medium px-4 py-2.5 rounded-2xl flex items-center justify-between animate-fade-in">
          <span>{toastMessage}</span>
          <Check className="w-4 h-4 text-[#849a88]" />
        </div>
      )}

      {/* Control Panel directly on Preview */}
      <div className="bg-[#100d0b] border border-[#2b241f] rounded-2xl p-4 space-y-3.5 text-xs shadow-xl">
        {/* Language Toggle & Header */}
        <div className="flex items-center justify-between bg-[#1c1815] p-2.5 rounded-xl border border-[#382f29]">
          <span className="font-serif italic text-[#e6a15c] flex items-center gap-1.5 font-semibold">
            <Globe className="w-4 h-4 text-[#d97724]" />
            {isZh ? '一鍵切換語言:' : 'One-Click Language:'}
          </span>
          <div className="flex items-center gap-1 bg-[#100d0b] p-1 rounded-lg border border-[#2b241f]">
            <button
              onClick={() => setLanguage('zh')}
              className={`px-3 py-1 rounded-md text-xs font-syne font-bold transition-all ${
                language === 'zh'
                  ? 'bg-[#d97724] text-[#0c0a09] shadow-md'
                  : 'text-[#a39588] hover:text-[#f7f3ee]'
              }`}
            >
              中文版 (ZH)
            </button>
            <button
              onClick={() => setLanguage('en')}
              className={`px-3 py-1 rounded-md text-xs font-syne font-bold transition-all ${
                language === 'en'
                  ? 'bg-[#d97724] text-[#0c0a09] shadow-md'
                  : 'text-[#a39588] hover:text-[#f7f3ee]'
              }`}
            >
              English (EN)
            </button>
          </div>
        </div>

        {/* Theme Selector */}
        <div className="space-y-1.5">
          <span className="font-serif italic text-[#c8b8a8] block">
            {isZh ? '選擇卡片視覺風格主題:' : 'Card Aesthetic Theme:'}
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
            <button
              onClick={() => setThemeStyle('amber-warmth')}
              className={`px-2.5 py-1.5 rounded-xl font-syne text-[11px] border transition-all ${
                themeStyle === 'amber-warmth'
                  ? 'bg-[#d97724] text-[#0c0a09] border-[#e6a15c] font-bold shadow-md'
                  : 'bg-[#211b18] text-[#a39588] border-[#382f29]'
              }`}
            >
              🕯️ {isZh ? '溫暖琥珀' : 'Warm Amber'}
            </button>
            <button
              onClick={() => setThemeStyle('sage-green')}
              className={`px-2.5 py-1.5 rounded-xl font-syne text-[11px] border transition-all ${
                themeStyle === 'sage-green'
                  ? 'bg-[#849a88] text-[#0c0a09] border-[#a3b8a7] font-bold shadow-md'
                  : 'bg-[#211b18] text-[#a39588] border-[#382f29]'
              }`}
            >
              🌿 {isZh ? '鼠尾草綠' : 'Sage Green'}
            </button>
            <button
              onClick={() => setThemeStyle('sunset-rose')}
              className={`px-2.5 py-1.5 rounded-xl font-syne text-[11px] border transition-all ${
                themeStyle === 'sunset-rose'
                  ? 'bg-[#c08497] text-[#0c0a09] border-[#e2b3c2] font-bold shadow-md'
                  : 'bg-[#211b18] text-[#a39588] border-[#382f29]'
              }`}
            >
              🌅 {isZh ? '日落晚霞' : 'Sunset'}
            </button>
            <button
              onClick={() => setThemeStyle('light-sand')}
              className={`px-2.5 py-1.5 rounded-xl font-syne text-[11px] border transition-all ${
                themeStyle === 'light-sand'
                  ? 'bg-[#f7f3ee] text-[#1c1815] border-[#d8ccbe] font-bold shadow-md'
                  : 'bg-[#211b18] text-[#a39588] border-[#382f29]'
              }`}
            >
              🪵 {isZh ? '暖沙米色' : 'Warm Sand'}
            </button>
          </div>
        </div>

        {/* Athlete Name & Coach Name Inputs */}
        <div className="grid grid-cols-2 gap-2.5 pt-2.5 border-t border-[#2b241f]">
          <div className="space-y-1">
            <label className="font-serif italic text-[#c8b8a8] text-[11px] flex items-center gap-1">
              <UserCheck className="w-3.5 h-3.5 text-[#d97724]" />
              {isZh ? '學員姓名:' : 'Athlete Name:'}
            </label>
            <input
              type="text"
              value={clientName}
              onChange={(e) => {
                const val = e.target.value;
                setClientName(val);
                const prof = loadUserProfile();
                saveUserProfile({ ...prof, clientName: val });
              }}
              placeholder={isZh ? "你的名字" : "Your name"}
              className="w-full bg-[#181412] border border-[#2b241f] rounded-xl px-2.5 py-1.5 text-xs text-[#f7f3ee] placeholder-[#6b5e54] focus:outline-none focus:ring-1 focus:ring-[#d97724]"
            />
          </div>
          <div className="space-y-1">
            <label className="font-serif italic text-[#c8b8a8] text-[11px] flex items-center gap-1">
              <UserCheck className="w-3.5 h-3.5 text-[#849a88]" />
              {isZh ? '指導教練 (PT):' : 'Coach / PT:'}
            </label>
            <input
              type="text"
              value={ptName}
              onChange={(e) => {
                const val = e.target.value;
                setPtName(val);
                const prof = loadUserProfile();
                saveUserProfile({ ...prof, ptName: val });
              }}
              placeholder={isZh ? "教練名字" : "Coach name"}
              className="w-full bg-[#181412] border border-[#2b241f] rounded-xl px-2.5 py-1.5 text-xs text-[#f7f3ee] placeholder-[#6b5e54] focus:outline-none focus:ring-1 focus:ring-[#d97724]"
            />
          </div>
        </div>

        {/* Date Picker */}
        <div className="flex items-center justify-between pt-2.5 border-t border-[#2b241f]">
          <label className="font-serif italic text-[#c8b8a8] text-[11px] flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5 text-[#e6a15c]" />
            {isZh ? '卡片紀錄日期:' : 'Card Session Date:'}
          </label>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={cardDate ? cardDate.split('T')[0] : new Date().toISOString().split('T')[0]}
              onChange={(e) => {
                if (e.target.value) {
                  setCardDate(e.target.value + 'T12:00:00.000Z');
                }
              }}
              className="bg-[#181412] border border-[#2b241f] rounded-xl px-2 py-1 text-xs text-[#f7f3ee] outline-none focus:ring-1 focus:ring-[#d97724]"
            />
            <button
              type="button"
              onClick={() => setCardDate(new Date().toISOString())}
              className="px-2.5 py-1 bg-[#d97724]/20 hover:bg-[#d97724]/30 text-[#e6a15c] border border-[#d97724]/40 rounded-xl text-[11px] font-syne font-semibold transition-all"
            >
              {isZh ? '設為今天' : 'Set Today'}
            </button>
          </div>
        </div>

        {/* Seat Settings Checkbox */}
        <div className="flex items-center justify-between pt-2 border-t border-[#2b241f]">
          <span className="font-serif italic text-[#c8b8a8]">
            {isZh ? '顯示器材角度與座椅位置設定:' : 'Include Machine Seat & Alignment Settings:'}
          </span>
          <input
            type="checkbox"
            checked={showSeatSettings}
            onChange={(e) => setShowSeatSettings(e.target.checked)}
            className="w-4 h-4 rounded text-[#d97724] accent-[#d97724] cursor-pointer"
          />
        </div>

        {/* Note to PT */}
        <div className="pt-2 border-t border-[#2b241f] space-y-1">
          <label className="font-serif italic text-[#c8b8a8] flex items-center gap-1">
            <MessageSquare className="w-3.5 h-3.5 text-[#d97724]" />
            {isZh ? '給教練 / PT 的自訂備忘留言:' : 'Note for Trainer / PT:'}
          </label>
          <input
            type="text"
            value={customNote}
            onChange={(e) => setCustomNote(e.target.value)}
            placeholder={isZh ? "例：Marcus 教練，今天腿推感受度極佳，離心控制有特別放慢！" : "e.g. Coach Marcus, leg press felt very strong!"}
            className="w-full bg-[#181412] border border-[#2b241f] rounded-xl px-3 py-2 text-xs text-[#f7f3ee] placeholder-[#6b5e54] focus:outline-none focus:ring-1 focus:ring-[#d97724]"
          />
        </div>
      </div>

      {/* Live Preview Card Container */}
      <div className="py-2">
        <PTSummaryCard
          workout={workout}
          unit={unit}
          customPtNote={customNote}
          themeStyle={themeStyle}
          showSeatSettings={showSeatSettings}
          language={language}
          customClientName={clientName}
          customPtName={ptName}
          customDate={cardDate}
        />
      </div>

      {/* Action Buttons Toolbar */}
      <div className="space-y-3 pt-1">
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={handleDownloadPNG}
            disabled={isGenerating}
            className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-[#d97724] via-[#c86d51] to-[#e6a15c] hover:opacity-95 text-[#0c0a09] font-syne font-bold text-xs flex items-center justify-center gap-2 shadow-xl shadow-[#d97724]/20 transition-all disabled:opacity-50"
          >
            {isGenerating ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                {isZh ? '生成圖片中...' : 'Generating PNG...'}
              </span>
            ) : (
              <>
                <Download className="w-4 h-4" /> {isZh ? '下載 PNG 報告卡' : 'Download PNG Card'}
              </>
            )}
          </button>

          <button
            onClick={handleCopyPNGToClipboard}
            disabled={isGenerating}
            className="w-full py-3.5 px-4 rounded-2xl bg-[#211b18] hover:bg-[#2c2420] text-[#f7f3ee] font-syne font-bold text-xs flex items-center justify-center gap-2 border border-[#382f29] transition-all disabled:opacity-50"
          >
            <Copy className="w-4 h-4 text-[#e6a15c]" /> {isZh ? '複製圖片至對話框' : 'Copy to Chat'}
          </button>
        </div>

        {/* Schedule to Calendar Button */}
        <div className="bg-[#100d0b] border border-[#2b241f] rounded-2xl p-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-[#d97724]/20 text-[#e6a15c] border border-[#d97724]/30">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-serif font-semibold text-[#f7f3ee] block">
                {isZh ? '將下次訓練排程存入手機行事曆 (.ics)' : 'Save Next Session to Calendar (.ics)'}
              </span>
            </div>
          </div>

          <button
            onClick={() => setIsScheduleModalOpen(true)}
            className="px-3 py-1.5 bg-[#211b18] hover:bg-[#2c2420] text-[#e6a15c] border border-[#d97724]/40 rounded-xl text-xs font-syne font-bold transition-all shrink-0"
          >
            {isZh ? '加入行事曆' : 'Schedule .ics'}
          </button>
        </div>
      </div>

      <ScheduleCalendarModal
        isOpen={isScheduleModalOpen}
        onClose={() => setIsScheduleModalOpen(false)}
        defaultTitle={`Next ${workout.title || 'Workout'}`}
      />
    </div>
  );
};
