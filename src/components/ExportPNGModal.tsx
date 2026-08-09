import React from 'react';
import { X, Share2 } from 'lucide-react';
import { Workout, WeightUnit } from '../types';
import { PTSummaryStudio } from './PTSummaryStudio';

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
  if (!isOpen) return null;

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
            <h3 className="text-lg font-serif font-semibold text-[#f7f3ee]">
              教練報告卡匯出工作室 (PT Export Studio)
            </h3>
            <p className="text-xs text-[#a39588] font-light">
              在即時預覽卡片上直接調整風格、語言與備忘，一鍵下載 high-res PNG 圖片。
            </p>
          </div>
        </div>

        {/* Unified PTSummaryStudio */}
        <PTSummaryStudio workout={workout} unit={unit} onClose={onClose} />
      </div>
    </div>
  );
};
