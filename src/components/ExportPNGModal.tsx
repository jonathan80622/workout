import React, { useState } from 'react';
import { toPng, toBlob } from 'html-to-image';
import { Download, Copy, X, Check, Share2, Sparkles, MessageSquare } from 'lucide-react';
import { Workout, WeightUnit } from '../types';
import { PTSummaryCard } from './PTSummaryCard';

interface ExportPNGModalProps {
  workout: Workout;
  unit: WeightUnit;
  isOpen: boolean;
  onClose: () => void;
}

export const ExportPNGModal: React.FC<ExportPNGModalProps> = ({
  workout,
  unit,
  isOpen,
  onClose
}) => {
  const [themeStyle, setThemeStyle] = useState<'othership-sanctuary' | 'somatic-sage' | 'aura-sunset' | 'ethereal-sand'>('othership-sanctuary');
  const [customNote, setCustomNote] = useState<string>(workout.ptNotes || '');
  const [showSeatSettings, setShowSeatSettings] = useState<boolean>(true);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  if (!isOpen) return null;

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
      link.download = `Somatic_PT_Report_${safeTitle}_${dateStr}.png`;
      link.href = dataUrl;
      link.click();

      showToast('✨ Somatic PNG Report Card exported successfully!');
    } catch (err) {
      console.error('Failed to export PNG:', err);
      showToast('Failed to generate PNG image. Please try again.');
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
        showToast('📋 PNG copied to clipboard! Ready to paste in your PT chat.');
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
    <div className="fixed inset-0 z-50 bg-[#0c0a09]/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="relative w-full max-w-xl bg-[#181412] border border-[#382f29] rounded-3xl shadow-2xl p-5 my-auto max-h-[92vh] overflow-y-auto">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full bg-[#211b18] text-[#8c7e72] hover:text-[#f7f3ee] transition-colors border border-[#382f29]"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 rounded-full bg-[#d97724]/20 text-[#e6a15c] border border-[#d97724]/40">
            <Share2 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-serif font-semibold text-[#f7f3ee] flex items-center gap-2">
              Export PT Report Card
            </h3>
            <p className="text-xs text-[#a39588] font-light">
              High-resolution PNG formatted for iMessage, WhatsApp, or chat with your Personal Trainer / Guide.
            </p>
          </div>
        </div>

        {/* Toast Alert Banner */}
        {toastMessage && (
          <div className="mb-4 bg-[#849a88]/20 border border-[#849a88]/40 text-[#e8f0e9] text-xs font-medium px-4 py-2.5 rounded-2xl flex items-center justify-between animate-fade-in">
            <span>{toastMessage}</span>
            <Check className="w-4 h-4 text-[#849a88]" />
          </div>
        )}

        {/* Customization Options Bar */}
        <div className="bg-[#100d0b] border border-[#2b241f] rounded-2xl p-3.5 mb-5 space-y-3 text-xs">
          {/* Theme Selector */}
          <div className="space-y-1.5">
            <span className="font-serif italic text-[#c8b8a8] block">Aesthetic Sanctuary Theme:</span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              <button
                onClick={() => setThemeStyle('othership-sanctuary')}
                className={`px-2.5 py-1.5 rounded-xl font-syne text-[11px] border transition-all ${
                  themeStyle === 'othership-sanctuary'
                    ? 'bg-[#d97724] text-[#0c0a09] border-[#e6a15c] font-bold shadow-md'
                    : 'bg-[#211b18] text-[#a39588] border-[#382f29]'
                }`}
              >
                🕯️ Sanctuary
              </button>
              <button
                onClick={() => setThemeStyle('somatic-sage')}
                className={`px-2.5 py-1.5 rounded-xl font-syne text-[11px] border transition-all ${
                  themeStyle === 'somatic-sage'
                    ? 'bg-[#849a88] text-[#0c0a09] border-[#a3b8a7] font-bold shadow-md'
                    : 'bg-[#211b18] text-[#a39588] border-[#382f29]'
                }`}
              >
                🌿 Sage
              </button>
              <button
                onClick={() => setThemeStyle('aura-sunset')}
                className={`px-2.5 py-1.5 rounded-xl font-syne text-[11px] border transition-all ${
                  themeStyle === 'aura-sunset'
                    ? 'bg-[#c08497] text-[#0c0a09] border-[#e2b3c2] font-bold shadow-md'
                    : 'bg-[#211b18] text-[#a39588] border-[#382f29]'
                }`}
              >
                🌅 Sunset
              </button>
              <button
                onClick={() => setThemeStyle('ethereal-sand')}
                className={`px-2.5 py-1.5 rounded-xl font-syne text-[11px] border transition-all ${
                  themeStyle === 'ethereal-sand'
                    ? 'bg-[#f7f3ee] text-[#1c1815] border-[#d8ccbe] font-bold shadow-md'
                    : 'bg-[#211b18] text-[#a39588] border-[#382f29]'
                }`}
              >
                🪵 Sand Spa
              </button>
            </div>
          </div>

          {/* Toggle Seat Settings */}
          <div className="flex items-center justify-between pt-2 border-t border-[#2b241f]">
            <span className="font-serif italic text-[#c8b8a8]">Include Machine Seat & Alignment Settings:</span>
            <input
              type="checkbox"
              checked={showSeatSettings}
              onChange={(e) => setShowSeatSettings(e.target.checked)}
              className="w-4 h-4 rounded text-[#d97724] accent-[#d97724] cursor-pointer"
            />
          </div>

          {/* Trainer Message Input */}
          <div className="pt-2 border-t border-[#2b241f] space-y-1">
            <label className="font-serif italic text-[#c8b8a8] flex items-center gap-1">
              <MessageSquare className="w-3.5 h-3.5 text-[#d97724]" />
              Personal Reflection Note for Guide / PT:
            </label>
            <input
              type="text"
              value={customNote}
              onChange={(e) => setCustomNote(e.target.value)}
              placeholder="e.g. Guide Marcus, leg press felt very grounded with slow eccentrics!"
              className="w-full bg-[#181412] border border-[#2b241f] rounded-xl px-3 py-2 text-xs text-[#f7f3ee] placeholder-[#6b5e54] focus:outline-none focus:ring-1 focus:ring-[#d97724]"
            />
          </div>
        </div>

        {/* Live Card Preview Container */}
        <div className="bg-[#100d0b] p-3 sm:p-4 rounded-2xl border border-[#2b241f] max-h-[50vh] overflow-y-auto mb-5">
          <PTSummaryCard
            workout={workout}
            unit={unit}
            customPtNote={customNote}
            themeStyle={themeStyle}
            showSeatSettings={showSeatSettings}
          />
        </div>

        {/* Primary Action Buttons */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={handleDownloadPNG}
            disabled={isGenerating}
            className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-[#d97724] via-[#c86d51] to-[#e6a15c] hover:opacity-95 text-[#0c0a09] font-syne font-bold text-xs flex items-center justify-center gap-2 shadow-xl shadow-[#d97724]/20 transition-all disabled:opacity-50"
          >
            {isGenerating ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                Generating PNG...
              </span>
            ) : (
              <>
                <Download className="w-4 h-4" /> Save PNG Card
              </>
            )}
          </button>

          <button
            onClick={handleCopyPNGToClipboard}
            disabled={isGenerating}
            className="w-full py-3.5 px-4 rounded-2xl bg-[#211b18] hover:bg-[#2c2420] text-[#f7f3ee] font-syne font-bold text-xs flex items-center justify-center gap-2 border border-[#382f29] transition-all disabled:opacity-50"
          >
            <Copy className="w-4 h-4 text-[#e6a15c]" /> Copy to Chat
          </button>
        </div>
      </div>
    </div>
  );
};

