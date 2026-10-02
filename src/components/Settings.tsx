/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Settings as SettingsIcon, Shield, Moon, Sun, Lock, LogOut, Trash2, Eye, EyeOff, Code, Heart } from 'lucide-react';
import { User } from '../types';
import { api } from '../utils/api';

interface SettingsProps {
  currentUser: User;
  onRefreshUser: () => void;
  onLogout: () => void;
  darkMode?: boolean;
  onToggleDarkMode?: () => void;
}

export default function Settings({ currentUser, onRefreshUser, onLogout, darkMode: propDarkMode, onToggleDarkMode }: SettingsProps) {
  // Theme settings state
  const [localDarkMode, setLocalDarkMode] = useState(() => {
    return document.documentElement.classList.contains('dark');
  });

  const isDark = propDarkMode !== undefined ? propDarkMode : localDarkMode;

  // Toggle dark/light class
  const handleToggleTheme = () => {
    if (onToggleDarkMode) {
      onToggleDarkMode();
    } else {
      if (localDarkMode) {
        document.documentElement.classList.remove('dark');
        localStorage.setItem('theme', 'light');
        setLocalDarkMode(false);
      } else {
        document.documentElement.classList.add('dark');
        localStorage.setItem('theme', 'dark');
        setLocalDarkMode(true);
      }
    }
  };

  // Password fields state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwdMessage, setPwdMessage] = useState<{ text: string; error: boolean } | null>(null);

  const [showCurrentPwd, setShowCurrentPwd] = useState(false);
  const [showNewPwd, setShowNewPwd] = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);

  // Blocked users states
  const [blockedUsers, setBlockedUsers] = useState<User[]>([]);
  const [loadingBlocked, setLoadingBlocked] = useState(false);

  const fetchBlockedUsers = async () => {
    try {
      setLoadingBlocked(true);
      const res = await api.get('/api/users/blocked/list');
      setBlockedUsers(res?.blocked || []);
    } catch (_) {
    } finally {
      setLoadingBlocked(false);
    }
  };

  const handleUnblockFromSettings = async (id: string) => {
    try {
      await api.post(`/api/users/${id}/unblock`);
      fetchBlockedUsers();
      onRefreshUser();
    } catch (err: any) {
      alert(err.message || 'Failed to unblock user');
    }
  };

  React.useEffect(() => {
    fetchBlockedUsers();
  }, [currentUser?.id]);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setPwdMessage({ text: 'Passwords do not match.', error: true });
      return;
    }

    try {
      setPwdMessage(null);
      const res = await api.put('/api/auth/profile', {
        currentPassword,
        newPassword
      });

      if (res?.success) {
        setPwdMessage({ text: 'Password successfully updated!', error: false });
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      }
    } catch (err: any) {
      setPwdMessage({ text: err.message || 'Error updating password', error: true });
    }
  };

  const handleDeactivateAccount = async () => {
    const confirmation = confirm('Are you sure you want to deactivate your profile? You will be logged out immediately.');
    if (!confirmation) return;

    try {
      await api.put('/api/auth/profile', { isDeactivated: true });
      alert('Your profile has been deactivated.');
      onLogout();
    } catch (err: any) {
      alert(err.message || 'Failed to deactivate account');
    }
  };

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6 md:px-6 max-w-3xl mx-auto space-y-6 bg-gray-50/30 dark:bg-gray-950 transition-colors">
      
      {/* Header bar */}
      <div className="flex items-center gap-2 border-b border-gray-100 pb-4 dark:border-gray-800">
        <SettingsIcon className="h-6 w-6 text-blue-600 animate-spin" style={{ animationDuration: '6s' }} />
        <h1 className="text-xl font-black text-gray-900 dark:text-white">Account Settings</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs">
        {/* Left Side: General preferences & Themes */}
        <div className="md:col-span-1 space-y-4">
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-800 dark:bg-gray-900 space-y-4">
            <h3 className="text-xs font-black text-gray-900 dark:text-gray-100 border-b pb-2 flex items-center gap-1.5">
              <Sun className="h-4.5 w-4.5 text-orange-500" />
              <span>General Preferences</span>
            </h3>

            <div className="space-y-3">
              {/* Theme toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-bold block text-gray-800 dark:text-gray-200">Dark Mode</span>
                  <span className="text-[10px] text-gray-400">Toggle dark visual canvas</span>
                </div>

                <button
                  onClick={handleToggleTheme}
                  className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-1.5 hover:bg-gray-100 dark:border-gray-800 dark:hover:bg-gray-950 text-gray-700 dark:text-gray-300 cursor-pointer font-bold text-xs"
                >
                  {isDark ? (
                    <>
                      <Sun className="h-4 w-4 text-amber-500" />
                      <span>Light</span>
                    </>
                  ) : (
                    <>
                      <Moon className="h-4 w-4 text-indigo-500" />
                      <span>Dark</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Active Sessions lists widget */}
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-800 dark:bg-gray-900 space-y-4">
            <h3 className="text-xs font-black text-gray-900 dark:text-gray-100 border-b pb-2 flex items-center gap-1.5">
              <Shield className="h-4.5 w-4.5 text-blue-500" />
              <span>Active Sessions</span>
            </h3>

            <div className="space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <span className="font-bold block text-gray-800 dark:text-gray-200">Chrome on Linux</span>
                  <span className="text-[10px] text-green-500 font-bold uppercase tracking-wider">Active Device</span>
                </div>
                <span className="text-[10px] text-gray-400">This applet</span>
              </div>

              <div className="flex items-start justify-between border-t pt-2.5">
                <div>
                  <span className="font-bold block text-gray-800 dark:text-gray-200">Safari on iPhone 15</span>
                  <span className="text-[10px] text-gray-400 block">San Francisco, USA • 3 hrs ago</span>
                </div>
                <button
                  onClick={() => alert('Logged out of remote iPhone 15 session')}
                  className="text-[10px] text-red-500 hover:underline font-bold"
                >
                  Terminate
                </button>
              </div>
            </div>
          </div>

          {/* Developed By Credit Card */}
          <div className="rounded-xl border border-blue-100 bg-blue-50/40 p-4 shadow-xs dark:border-blue-900/30 dark:bg-blue-950/20 space-y-1.5 transition-colors">
            <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 font-extrabold text-xs">
              <Code className="h-4 w-4" />
              <span>Developer Information</span>
            </div>
            <div className="text-xs font-semibold text-gray-700 dark:text-gray-300 pt-0.5">
              Developed by <span className="font-black text-gray-900 dark:text-white">Habibur Rahman</span>
            </div>
          </div>
        </div>

        {/* Right Side: Security & Security Form */}
        <div className="md:col-span-2 space-y-4">
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-800 dark:bg-gray-900 space-y-4">
            <h3 className="text-xs font-black text-gray-900 dark:text-gray-100 border-b pb-2 flex items-center gap-1.5">
              <Lock className="h-4.5 w-4.5 text-blue-500" />
              <span>Change Password</span>
            </h3>

            {pwdMessage && (
              <div
                className={`rounded-lg p-2.5 font-semibold text-[11px] ${
                  pwdMessage.error
                    ? 'bg-red-50 text-red-600 border border-red-100 dark:bg-red-950/25 dark:border-red-900/30'
                    : 'bg-green-50 text-green-600 border border-green-100 dark:bg-green-950/25 dark:border-green-900/30'
                }`}
              >
                {pwdMessage.text}
              </div>
            )}

             <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label className="block font-bold text-gray-500 mb-1">Current Password</label>
                <div className="relative">
                  <input
                    type={showCurrentPwd ? "text" : "password"}
                    required
                    placeholder="••••••••"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 pl-3 pr-10 py-2 focus:outline-hidden focus:ring-1 focus:ring-blue-500 dark:border-gray-800 dark:bg-gray-950"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPwd(!showCurrentPwd)}
                    className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer focus:outline-hidden"
                    title={showCurrentPwd ? "Hide password" : "Show password"}
                  >
                    {showCurrentPwd ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-500 mb-1">New Password</label>
                  <div className="relative">
                    <input
                      type={showNewPwd ? "text" : "password"}
                      required
                      placeholder="Min 6 characters"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full rounded-lg border border-gray-200 pl-3 pr-10 py-2 focus:outline-hidden focus:ring-1 focus:ring-blue-500 dark:border-gray-800 dark:bg-gray-950"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPwd(!showNewPwd)}
                      className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer focus:outline-hidden"
                      title={showNewPwd ? "Hide password" : "Show password"}
                    >
                      {showNewPwd ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-gray-500 mb-1">Confirm New Password</label>
                  <div className="relative">
                    <input
                      type={showConfirmPwd ? "text" : "password"}
                      required
                      placeholder="Min 6 characters"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full rounded-lg border border-gray-200 pl-3 pr-10 py-2 focus:outline-hidden focus:ring-1 focus:ring-blue-500 dark:border-gray-800 dark:bg-gray-950"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPwd(!showConfirmPwd)}
                      className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer focus:outline-hidden"
                      title={showConfirmPwd ? "Hide password" : "Show password"}
                    >
                      {showConfirmPwd ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  className="rounded-lg bg-blue-600 px-5 py-2 font-bold text-white hover:bg-blue-700 cursor-pointer transition active:scale-95"
                >
                  Save New Password
                </button>
              </div>
            </form>
          </div>

          {/* Blocked Users Settings Card */}
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-800 dark:bg-gray-900 space-y-4">
            <h3 className="text-xs font-black text-gray-900 dark:text-gray-100 border-b pb-2 flex items-center gap-1.5">
              <Shield className="h-4.5 w-4.5 text-red-500" />
              <span>Blocked Users</span>
            </h3>
            
            <p className="text-[11px] text-gray-400">
              When you block someone, they cannot see your stories, posts, or listings. You also cannot send messages or friend requests to each other.
            </p>

            {loadingBlocked ? (
              <div className="text-[11px] text-gray-400 py-2">Loading blocked users...</div>
            ) : blockedUsers.length === 0 ? (
              <div className="text-[11px] text-gray-400 py-3 text-center bg-gray-50 dark:bg-gray-950 rounded-lg">
                No users blocked.
              </div>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {blockedUsers.map(u => (
                  <div key={u.id} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-950 rounded-lg border dark:border-gray-800">
                    <div className="flex items-center gap-2">
                      <img
                        src={u.profilePic || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=50'}
                        alt={u.username}
                        referrerPolicy="no-referrer"
                        className="h-7 w-7 rounded-full object-cover"
                      />
                      <span className="font-bold text-gray-800 dark:text-gray-200">{u.username}</span>
                    </div>
                    <button
                      onClick={() => handleUnblockFromSettings(u.id)}
                      className="rounded-lg bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 px-3 py-1 text-[10px] font-bold transition cursor-pointer"
                    >
                      Unblock
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Account Deactivation Card */}
          <div className="rounded-xl border border-red-150 bg-red-50/10 p-4 dark:border-red-950/20 text-xs space-y-3">
            <h3 className="font-black text-red-600 flex items-center gap-1.5">
              <Trash2 className="h-4.5 w-4.5" />
              <span>Danger Zone</span>
            </h3>
            <p className="text-gray-500 dark:text-gray-400 leading-relaxed font-semibold">
              Once you deactivate your profile, all stories, posts, listings, and messages will be permanently hidden. This action cannot be undone.
            </p>
            <div className="flex justify-end">
              <button
                onClick={handleDeactivateAccount}
                className="flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 font-bold text-white hover:bg-red-700 transition active:scale-95 cursor-pointer"
              >
                Deactivate Profile Account
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Credit */}
      <div className="pt-4 border-t border-gray-200/80 dark:border-gray-800/80 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-gray-500 dark:text-gray-400">
        <div className="flex items-center gap-1.5 font-medium">
          <Code className="h-3.5 w-3.5 text-blue-500" />
          <span>Developed by <strong className="font-bold text-gray-900 dark:text-gray-100">Habibur Rahman</strong></span>
        </div>
        <span className="text-[11px] text-gray-400 dark:text-gray-500">
          Social Network • All rights reserved
        </span>
      </div>

    </div>
  );
}
