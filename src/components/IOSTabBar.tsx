'use client';

import React from 'react';
import { Flame, History, Share2, Compass, Sparkles } from 'lucide-react';
import { ActiveTab } from '../types';

interface IOSTabBarProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  hasActiveWorkout?: boolean;
}

export const IOSTabBar: React.FC<IOSTabBarProps> = ({
  activeTab,
  onTabChange,
  hasActiveWorkout = false
}) => {
  const tabs = [
    {
      id: 'workout' as ActiveTab,
      label: 'Workout',
      icon: Flame,
      badge: hasActiveWorkout ? 'Active' : undefined
    },
    {
      id: 'history' as ActiveTab,
      label: 'History',
      icon: History
    },
    {
      id: 'pt-export' as ActiveTab,
      label: 'PT Export',
      icon: Share2,
      highlight: true
    },
    {
      id: 'machines' as ActiveTab,
      label: 'Machines',
      icon: Compass
    },
    {
      id: 'analytics' as ActiveTab,
      label: 'Analytics',
      icon: Sparkles
    }
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 max-w-md mx-auto px-3 pb-3 pt-1 pointer-events-none">
      <div className="pointer-events-auto bg-[#181412]/95 backdrop-blur-2xl border border-[#382f29]/90 rounded-full shadow-2xl px-2 py-1.5 flex items-center justify-around">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`relative flex flex-col items-center justify-center py-1.5 px-3 rounded-full transition-all duration-300 ${
                isActive
                  ? 'text-[#f5c999] font-semibold scale-105'
                  : 'text-[#8c7e72] hover:text-[#e8e0d5]'
              }`}
            >
              {isActive && (
                <span className="absolute inset-0 bg-gradient-to-r from-[#d97724]/20 via-[#c86d51]/20 to-[#e6a15c]/20 rounded-full border border-[#d97724]/40 shadow-inner" />
              )}

              <div className="relative">
                <Icon className={`w-4 h-4 transition-transform ${isActive ? 'scale-110 text-[#e6a15c]' : ''}`} />
                {tab.badge && (
                  <span className="absolute -top-1 -right-2 w-2 h-2 rounded-full bg-[#e6a15c] animate-pulse ring-2 ring-[#181412]" />
                )}
              </div>

              <span className="text-[10px] mt-0.5 tracking-wide font-syne">
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
