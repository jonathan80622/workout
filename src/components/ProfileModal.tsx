'use client';

import React, { useState } from 'react';
import { Compass, X, Check, RefreshCw, LogIn, LogOut, User as UserIcon } from 'lucide-react';
import { useSession, signIn, signOut } from 'next-auth/react';
import { UserProfile } from '../utils/storage';

interface ProfileModalProps {
  profile: UserProfile;
  isOpen: boolean;
  onClose: () => void;
  onSaveProfile: (profile: UserProfile) => void;
  onResetData: () => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({
  profile,
  isOpen,
  onClose,
  onSaveProfile,
  onResetData
}) => {
  const { data: session } = useSession();
  const [clientName, setClientName] = useState<string>(profile.clientName || session?.user?.name || '');
  const [ptName, setPtName] = useState<string>(profile.ptName);
  const [appTitle, setAppTitle] = useState<string>(profile.appTitle || 'Workout Studio');
  const [unit, setUnit] = useState<'lbs' | 'kg'>(profile.preferredUnit);

  if (!isOpen) return null;

  const handleSave = () => {
    onSaveProfile({
      ...profile,
      clientName: clientName.trim(),
      ptName: ptName.trim(),
      appTitle: appTitle.trim() || 'Workout Studio',
      preferredUnit: unit
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#0c0a09]/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-[#181412] border border-[#382f29] rounded-3xl p-5 w-full max-w-md space-y-4 shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#2b241f] pb-3">
          <h3 className="text-base font-serif font-bold text-[#f7f3ee] flex items-center gap-2">
            <Compass className="w-5 h-5 text-[#e6a15c]" /> Athlete & Trainer Settings
          </h3>
          <button onClick={onClose} className="text-[#8c7e72] hover:text-[#f7f3ee]">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Google OAuth Auth Section */}
        <div className="p-3 bg-[#100d0b] border border-[#2b241f] rounded-2xl space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-syne font-semibold text-xs text-[#e6a15c] flex items-center gap-1.5">
              <UserIcon className="w-4 h-4 text-[#d97724]" /> Google Account
            </span>
            {session ? (
              <span className="text-[10px] bg-[#849a88]/20 text-[#a3b8a7] px-2 py-0.5 rounded-full border border-[#849a88]/40">
                Connected
              </span>
            ) : (
              <span className="text-[10px] bg-[#382f29] text-[#8c7e72] px-2 py-0.5 rounded-full">
                Not signed in
              </span>
            )}
          </div>

          {session ? (
            <div className="flex items-center justify-between pt-1">
              <div className="text-xs text-[#f7f3ee] truncate max-w-[200px]">
                <p className="font-medium truncate">{session.user?.name || 'Athlete'}</p>
                <p className="text-[10px] text-[#8c7e72] truncate">{session.user?.email}</p>
              </div>
              <button
                onClick={() => signOut()}
                className="px-2.5 py-1 bg-[#211b18] hover:bg-[#2b241f] border border-[#382f29] text-[#c86d51] text-xs font-syne font-bold rounded-xl flex items-center gap-1"
              >
                <LogOut className="w-3.5 h-3.5" /> Sign Out
              </button>
            </div>
          ) : (
            <div className="pt-1 flex items-center justify-between">
              <p className="text-[11px] text-[#a39588]">
                Sign in with Google to sync workouts to Prisma Postgres database.
              </p>
              <button
                onClick={() => signIn('google')}
                className="px-3 py-1.5 bg-[#d97724] hover:bg-[#e6a15c] text-[#0c0a09] text-xs font-syne font-bold rounded-xl flex items-center gap-1 shadow-md shrink-0"
              >
                <LogIn className="w-3.5 h-3.5" /> Google Sign In
              </button>
            </div>
          )}
        </div>

        <div className="space-y-3 text-xs">
          <div>
            <label className="font-syne font-semibold text-[#c8b8a8] block mb-1">
              App / Studio Name
            </label>
            <input
              type="text"
              value={appTitle}
              onChange={(e) => setAppTitle(e.target.value)}
              placeholder="e.g. My Gym Studio"
              className="w-full bg-[#100d0b] border border-[#2b241f] rounded-xl p-2.5 text-xs text-[#f7f3ee] outline-none focus:ring-1 focus:ring-[#d97724]"
            />
          </div>

          <div>
            <label className="font-syne font-semibold text-[#c8b8a8] block mb-1">
              Your Name
            </label>
            <input
              type="text"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="e.g. Jordan Vance"
              className="w-full bg-[#100d0b] border border-[#2b241f] rounded-xl p-2.5 text-xs text-[#f7f3ee] outline-none focus:ring-1 focus:ring-[#d97724]"
            />
          </div>

          <div>
            <label className="font-syne font-semibold text-[#c8b8a8] block mb-1">
              Personal Trainer / Coach Name
            </label>
            <input
              type="text"
              value={ptName}
              onChange={(e) => setPtName(e.target.value)}
              placeholder="e.g. Coach Marcus"
              className="w-full bg-[#100d0b] border border-[#2b241f] rounded-xl p-2.5 text-xs text-[#f7f3ee] outline-none focus:ring-1 focus:ring-[#d97724]"
            />
          </div>

          <div>
            <label className="font-syne font-semibold text-[#c8b8a8] block mb-1">
              Default Weight Unit
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setUnit('lbs')}
                className={`py-2 rounded-xl font-syne font-bold border transition-all ${
                  unit === 'lbs'
                    ? 'bg-[#d97724] text-[#0c0a09] border-[#d97724]'
                    : 'bg-[#100d0b] text-[#8c7e72] border-[#2b241f]'
                }`}
              >
                Pounds (lbs)
              </button>
              <button
                type="button"
                onClick={() => setUnit('kg')}
                className={`py-2 rounded-xl font-syne font-bold border transition-all ${
                  unit === 'kg'
                    ? 'bg-[#d97724] text-[#0c0a09] border-[#d97724]'
                    : 'bg-[#100d0b] text-[#8c7e72] border-[#2b241f]'
                }`}
              >
                Kilograms (kg)
              </button>
            </div>
          </div>

          <div className="pt-3 border-t border-[#2b241f]">
            <button
              onClick={() => {
                if (window.confirm('Reset sample workouts and restore database defaults?')) {
                  onResetData();
                  onClose();
                }
              }}
              className="text-[#c86d51] hover:text-[#d97724] flex items-center gap-1 font-syne font-semibold"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Restore Sample Sessions
            </button>
          </div>
        </div>

        <button
          onClick={handleSave}
          className="w-full py-3 bg-[#d97724] hover:bg-[#e6a15c] text-[#0c0a09] font-syne font-bold text-xs rounded-xl shadow-lg shadow-[#d97724]/20 flex items-center justify-center gap-1.5"
        >
          <Check className="w-4 h-4" /> Save Profile
        </button>
      </div>
    </div>
  );
};
