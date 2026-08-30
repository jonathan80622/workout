'use client';

import React, { useState } from 'react';
import { Compass, X, Check, RefreshCw, LogIn, LogOut, User as UserIcon } from 'lucide-react';
import { UserProfile } from '../utils/storage';
import { DriveConnection } from '../utils/driveStorage';

interface ProfileModalProps {
  profile: UserProfile;
  isOpen: boolean;
  onClose: () => void;
  onSaveProfile: (profile: UserProfile) => void;
  onResetData: () => void;
  driveConnection: DriveConnection;
  onConnectDrive: () => void;
  onDisconnectDrive: () => void;
  syncStatus: string;
  portalUrl: string;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({
  profile,
  isOpen,
  onClose,
  onSaveProfile,
  onResetData,
  driveConnection,
  onConnectDrive,
  onDisconnectDrive,
  syncStatus,
  portalUrl
}) => {
  const [clientName, setClientName] = useState<string>(profile.clientName || '');
  const [ptName, setPtName] = useState<string>(profile.ptName);
  const [appTitle, setAppTitle] = useState<string>(profile.appTitle || 'Workout Studio');

  if (!isOpen) return null;

  const handleSave = () => {
    onSaveProfile({
      ...profile,
      clientName: clientName.trim(),
      ptName: ptName.trim(),
      appTitle: appTitle.trim() || 'Workout Studio'
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
            {driveConnection.isConnected ? (
              <span className="text-[10px] bg-[#849a88]/20 text-[#a3b8a7] px-2 py-0.5 rounded-full border border-[#849a88]/40">
                Connected
              </span>
            ) : (
              <span className="text-[10px] bg-[#382f29] text-[#8c7e72] px-2 py-0.5 rounded-full">
                Not signed in
              </span>
            )}
          </div>

          {driveConnection.isConnected ? (
            <div className="flex items-center justify-between pt-1">
              <div className="text-xs text-[#f7f3ee] truncate max-w-[200px]">
                <p className="font-medium truncate">Drive sync enabled</p>
                <p className="text-[10px] text-[#8c7e72] truncate">JSON and videos in your Workout Recorder folder</p>
              </div>
              <button
                onClick={onDisconnectDrive}
                className="px-2.5 py-1 bg-[#211b18] hover:bg-[#2b241f] border border-[#382f29] text-[#c86d51] text-xs font-syne font-bold rounded-xl flex items-center gap-1"
              >
                <LogOut className="w-3.5 h-3.5" /> Disconnect
              </button>
            </div>
          ) : (
            <div className="pt-1 flex items-center justify-between">
              <p className="text-[11px] text-[#a39588]">
                Authorize Drive to sync workout-data.json and upload videos directly.
              </p>
              <button
                onClick={onConnectDrive}
                disabled={!driveConnection.isConfigured}
                className="px-3 py-1.5 bg-[#d97724] hover:bg-[#e6a15c] text-[#0c0a09] text-xs font-syne font-bold rounded-xl flex items-center gap-1 shadow-md shrink-0"
              >
                <LogIn className="w-3.5 h-3.5" /> Connect Drive
              </button>
            </div>
          )}
          {syncStatus && <p className="text-[10px] text-[#8c7e72]">{syncStatus}</p>}
          {portalUrl && (
            <div className="bg-[#181412] border border-[#382f29] rounded-xl p-2 space-y-1">
              <p className="text-[10px] text-[#e6a15c] font-syne font-bold uppercase">PT Portal URL</p>
              <a href={portalUrl} className="block text-[10px] text-[#c8b8a8] break-all" target="_blank" rel="noreferrer">
                {portalUrl}
              </a>
            </div>
          )}
          {!driveConnection.isConfigured && (
            <p className="text-[10px] text-[#c86d51]">Set NEXT_PUBLIC_GOOGLE_CLIENT_ID to enable Drive sync.</p>
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

          <div className="pt-3 border-t border-[#2b241f]">
            <button
              onClick={() => {
                if (window.confirm('Reset sample workouts and restore starter data?')) {
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
