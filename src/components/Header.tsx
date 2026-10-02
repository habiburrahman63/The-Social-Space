/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Search, Bell, MessageSquare, Plus, LogOut, Shield, User as UserIcon, Menu, HelpCircle, Settings as SettingsIcon, Home, Users, ArrowLeft, Moon, Sun } from 'lucide-react';
import { User, Notification } from '../types';
import { api } from '../utils/api';
import { isUserOnline } from '../utils/presence';
import { countUnreadInSection } from '../utils/notificationSections';

interface HeaderProps {
  currentUser: User;
  onNavigate: (view: string, targetId?: string, forceRefresh?: boolean) => void;
  onLogout: () => void;
  notifications: Notification[];
  onRefreshNotifications: () => void;
  unreadMessagesCount: number;
  activeTab: string;
  messengerChatActive?: boolean;
  darkMode?: boolean;
  onToggleDarkMode?: () => void;
}

export default function Header({
  currentUser,
  onNavigate,
  onLogout,
  notifications,
  onRefreshNotifications,
  unreadMessagesCount,
  activeTab,
  messengerChatActive,
  darkMode = false,
  onToggleDarkMode,
}: HeaderProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);

  // Search autocomplete
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const res = await api.get('/api/friends/suggestions');
        const list = (res?.suggestions || []) as User[];
        const filtered = list.filter(u =>
          u.username.toLowerCase().includes(searchQuery.toLowerCase())
        );
        // Sort online users to the top
        filtered.sort((a, b) => {
          const aOnline = isUserOnline(a.lastActiveAt);
          const bOnline = isUserOnline(b.lastActiveAt);
          if (aOnline && !bOnline) return -1;
          if (!aOnline && bOnline) return 1;
          return a.username.localeCompare(b.username);
        });
        setSearchResults(filtered);
      } catch (_) {}
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleMarkAllRead = async () => {
    try {
      await api.post('/api/notifications/read');
      onRefreshNotifications();
    } catch (_) {}
  };

  useEffect(() => {
    const handleNotifsUpdate = () => {
      onRefreshNotifications();
    };
    window.addEventListener('notifications-updated', handleNotifsUpdate);
    return () => window.removeEventListener('notifications-updated', handleNotifsUpdate);
  }, [onRefreshNotifications]);

  const triggerToast = (message: string, options?: any) => {
    window.dispatchEvent(new CustomEvent('show-toast', { detail: { message, options } }));
  };

  const handleAcceptFriendRequest = async (e: React.MouseEvent, senderId: string, senderName: string) => {
    e.stopPropagation();
    try {
      await api.post(`/api/friends/accept/${senderId}`);
      triggerToast(`You are now friends with ${senderName}! 🤝`, { type: 'success' });
      onRefreshNotifications();
      window.dispatchEvent(new CustomEvent('friends-updated'));
      window.dispatchEvent(new CustomEvent('notifications-updated'));
    } catch (err: any) {
      triggerToast(err.message || 'Failed to accept friend request', { type: 'error' });
    }
  };

  const handleDeclineFriendRequest = async (e: React.MouseEvent, senderId: string, senderName: string) => {
    e.stopPropagation();
    try {
      await api.post(`/api/friends/reject/${senderId}`);
      triggerToast(`Declined friend request from ${senderName}.`, { type: 'info' });
      onRefreshNotifications();
      window.dispatchEvent(new CustomEvent('friends-updated'));
      window.dispatchEvent(new CustomEvent('notifications-updated'));
    } catch (err: any) {
      triggerToast(err.message || 'Failed to decline friend request', { type: 'error' });
    }
  };

  const handleClearAll = async () => {
    try {
      await api.post('/api/notifications/clear');
      onRefreshNotifications();
    } catch (_) {}
  };

  const unreadNotifs = notifications.filter(n => !n.isRead).length;
  const homeUnread = countUnreadInSection(notifications, 'home');
  const friendsUnread = countUnreadInSection(notifications, 'friends');

  return (
    <header className={`sticky top-0 z-40 w-full border-b border-gray-200 bg-white px-4 py-2.5 lg:py-0 shadow-xs dark:border-gray-800 dark:bg-gray-900 transition-colors duration-200 ${
      activeTab === 'messenger' && messengerChatActive ? 'hidden lg:block' : ''
    }`}>
      <div className="flex flex-col lg:flex-row lg:h-14 lg:items-center lg:justify-between gap-3 lg:gap-4 max-w-7xl mx-auto w-full">
        {/* Left section: Logo & Search (Top Row on mobile) */}
        <div className="flex items-center gap-2.5 w-full lg:w-auto lg:flex-1 max-w-none lg:max-w-md shrink-0">
          <div
            onClick={() => onNavigate('feed')}
            onDoubleClick={() => onNavigate('feed', undefined, true)}
            className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-blue-600 text-white hover:bg-blue-700 shadow-sm transition-all duration-150 active:scale-95 shrink-0"
            title="SocialSpace Home (double-click to refresh)"
          >
            <span className="text-xl font-extrabold tracking-tighter select-none">S</span>
          </div>

          {/* Global Search Bar with Autocomplete */}
          <div className="relative flex-1">
            <div className="pointer-events-none absolute left-3 text-gray-400 dark:text-gray-500">
              <Search className="h-4.5 w-4.5" />
            </div>
            <input
              type="text"
              placeholder="Search users, groups, #hashtags..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setShowSearchDropdown(true);
              }}
              onFocus={() => setShowSearchDropdown(true)}
              className="w-full rounded-full bg-gray-100 hover:bg-gray-200/70 py-2 pl-10 pr-4 text-sm text-gray-900 placeholder-gray-500 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-400 dark:focus:bg-gray-950 transition-all border border-transparent dark:border-gray-800/40 cursor-text shadow-inner"
            />

            {showSearchDropdown && searchQuery && (
              <>
                <div
                  className="fixed inset-0 z-40 cursor-default"
                  onClick={() => setShowSearchDropdown(false)}
                />
                <div className="absolute top-11 left-0 z-50 w-full rounded-xl border border-gray-200 bg-white p-2 shadow-lg dark:border-gray-800 dark:bg-gray-950 animate-in fade-in slide-in-from-top-1 duration-150">
                  <div className="px-3 py-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-900 mb-1">
                    Search results for &ldquo;{searchQuery}&rdquo;
                  </div>
                  {searchResults.length === 0 ? (
                    <div className="px-3 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                      No matching users found
                    </div>
                  ) : (
                    searchResults.map((u, idx) => (
                      <div
                        key={u.id ? `${u.id}-${idx}` : `search-usr-${idx}`}
                        onClick={() => {
                          onNavigate('profile', u.id);
                          setSearchQuery('');
                          setShowSearchDropdown(false);
                        }}
                        className="flex cursor-pointer items-center gap-3 rounded-lg p-2 hover:bg-gray-100 dark:hover:bg-gray-900 transition-colors"
                      >
                        <img
                          src={u.profilePic || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'}
                          alt={u.username}
                          referrerPolicy="no-referrer"
                          className="h-9 w-9 rounded-full object-cover border border-gray-100 dark:border-gray-800"
                        />
                        <div className="flex flex-col">
                          <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-1">
                            {u.username}
                            {u.verifyBadge && (
                              <Shield className="h-3.5 w-3.5 fill-blue-500 text-white" />
                            )}
                          </span>
                          <span className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[200px]">
                            {u.bio || 'No bio yet'}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Middle section: Desktop Quick View Icons */}
        <div className="hidden lg:flex items-center gap-1.5">
          <button
            onClick={() => onNavigate('feed')}
            onDoubleClick={() => onNavigate('feed', undefined, true)}
            className={`relative flex h-14 px-6 items-center justify-center border-b-2 transition-all cursor-pointer ${
              activeTab === 'feed'
                ? 'text-blue-600 border-blue-600 font-semibold dark:text-blue-400 dark:border-blue-400'
                : 'text-gray-500 border-transparent hover:text-gray-700 hover:bg-gray-50 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-800/40'
            }`}
            title="Home (double-click to refresh)"
          >
            <span className="text-sm">Home</span>
            {homeUnread > 0 && (
              <span className="absolute top-2 right-1.5 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white shadow-xs">
                {homeUnread}
              </span>
            )}
          </button>
          <button
            onClick={() => onNavigate('friends')}
            className={`relative flex h-14 px-6 items-center justify-center border-b-2 transition-all cursor-pointer ${
              activeTab === 'friends'
                ? 'text-blue-600 border-blue-600 font-semibold dark:text-blue-400 dark:border-blue-400'
                : 'text-gray-500 border-transparent hover:text-gray-700 hover:bg-gray-50 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-800/40'
            }`}
            title="Friends"
          >
            <span className="text-sm">Friends</span>
            {friendsUnread > 0 && (
              <span className="absolute top-2 right-1.5 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white shadow-xs">
                {friendsUnread}
              </span>
            )}
          </button>
          <button
            onClick={() => onNavigate('messenger')}
            className={`relative flex h-14 px-6 items-center justify-center border-b-2 transition-all cursor-pointer ${
              activeTab === 'messenger'
                ? 'text-blue-600 border-blue-600 font-semibold dark:text-blue-400 dark:border-blue-400'
                : 'text-gray-500 border-transparent hover:text-gray-700 hover:bg-gray-50 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-800/40'
            }`}
            title="Messages"
          >
            <span className="text-sm">Messages</span>
            {unreadMessagesCount > 0 && (
              <span className="absolute top-2 right-1.5 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white shadow-xs">
                {unreadMessagesCount}
              </span>
            )}
          </button>
          <button
            onClick={() => onNavigate('marketplace')}
            className={`flex h-14 px-6 items-center justify-center border-b-2 transition-all cursor-pointer ${
              activeTab === 'marketplace'
                ? 'text-blue-600 border-blue-600 font-semibold dark:text-blue-400 dark:border-blue-400'
                : 'text-gray-500 border-transparent hover:text-gray-700 hover:bg-gray-50 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-800/40'
            }`}
            title="Marketplace"
          >
            <span className="text-sm">Marketplace</span>
          </button>
        </div>

        {/* Right section / Bottom Row on mobile: Action Panels & Avatars */}
        <div className="flex items-center justify-between lg:justify-end gap-2.5 w-full lg:w-auto pt-2.5 lg:pt-0 border-t border-gray-100 lg:border-t-0 dark:border-gray-800/60">
          {/* Admin Hub entry */}
          {currentUser.role === 'admin' && (
            <button
              onClick={() => onNavigate('admin')}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-orange-100 text-orange-600 hover:bg-orange-200 dark:bg-orange-950/40 dark:text-orange-400 transition-all cursor-pointer active:scale-90"
              title="Admin Controller"
            >
              <Shield className="h-4.5 w-4.5" />
            </button>
          )}

          {/* Mobile/Tablet Home Button */}
          <button
            onClick={() => onNavigate('feed')}
            onDoubleClick={() => onNavigate('feed', undefined, true)}
            className={`relative flex lg:hidden h-9 w-9 items-center justify-center rounded-full transition-all cursor-pointer active:scale-90 ${
              activeTab === 'feed'
                ? 'bg-blue-100 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400 font-medium'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
            }`}
            title="Home (double-click to refresh)"
          >
            <Home className="h-4.5 w-4.5" />
            {homeUnread > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white shadow-xs">
                {homeUnread}
              </span>
            )}
          </button>

          {/* Mobile/Tablet Friends Button */}
          <button
            onClick={() => onNavigate('friends')}
            className={`relative flex lg:hidden h-9 w-9 items-center justify-center rounded-full transition-all cursor-pointer active:scale-90 ${
              activeTab === 'friends'
                ? 'bg-blue-100 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400 font-medium'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
            }`}
            title="Friends"
          >
            <Users className="h-4.5 w-4.5" />
            {friendsUnread > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white shadow-xs">
                {friendsUnread}
              </span>
            )}
          </button>

          {/* Messaging Icon */}
          <button
            onClick={() => onNavigate('messenger')}
            className="relative flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-gray-700 hover:bg-gray-200/80 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700/80 transition-all cursor-pointer active:scale-90"
            title="Messenger"
          >
            <MessageSquare className="h-4.5 w-4.5" />
            {unreadMessagesCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white shadow-xs">
                {unreadMessagesCount}
              </span>
            )}
          </button>

          {/* Dark/Night Mode Quick Toggle */}
          {onToggleDarkMode && (
            <button
              onClick={onToggleDarkMode}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-gray-700 hover:bg-gray-200/80 dark:bg-gray-800 dark:text-amber-400 dark:hover:bg-gray-700/80 transition-all cursor-pointer active:scale-90"
              title={darkMode ? "Switch to Light Mode" : "Switch to Night Mode"}
            >
              {darkMode ? <Sun className="h-4.5 w-4.5 text-amber-400" /> : <Moon className="h-4.5 w-4.5 text-indigo-500" />}
            </button>
          )}

          {/* Notification Bell with Dropdown */}
          <div className="relative">
            <button
              onClick={() => {
                setShowNotifDropdown(!showNotifDropdown);
                setShowUserDropdown(false);
              }}
              className="relative flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-gray-700 hover:bg-gray-200/80 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700/80 transition-all cursor-pointer active:scale-90"
              title="Notifications"
            >
              <Bell className="h-4.5 w-4.5" />
              {unreadNotifs > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white shadow-xs animate-pulse">
                  {unreadNotifs}
                </span>
              )}
            </button>

          {showNotifDropdown && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowNotifDropdown(false)}
              />
              <div className="fixed left-4 right-4 md:absolute md:left-auto md:right-0 top-16 md:top-11 z-50 w-auto md:w-96 rounded-xl border border-gray-200 bg-white p-2 shadow-lg dark:border-gray-800 dark:bg-gray-950 animate-in fade-in slide-in-from-top-1 duration-150">
                <div className="flex items-center justify-between border-b border-gray-100 pb-2 mb-2 px-2 dark:border-gray-900">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        onNavigate('feed');
                        setShowNotifDropdown(false);
                      }}
                      className="flex items-center gap-1 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 px-2.5 py-1 text-xs font-bold text-gray-700 dark:text-gray-300 transition cursor-pointer active:scale-95"
                      title="Go back to Home"
                    >
                      <ArrowLeft className="h-3.5 w-3.5" />
                      <span>Home</span>
                    </button>
                    <span className="text-sm font-bold text-gray-900 dark:text-gray-100">
                      Notifications
                    </span>
                  </div>
                </div>

                <div className="max-h-80 overflow-y-auto pr-1">
                  {notifications.length === 0 ? (
                    <div className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                      No notifications yet
                    </div>
                  ) : (
                    notifications.map((n) => (
                      <div
                        key={n.id}
                        onClick={async () => {
                          setShowNotifDropdown(false);
                          try {
                            await handleMarkAllRead();
                            if (n.type === 'friend_request' || n.type === 'friend_accept') {
                              onNavigate('friends');
                            } else if (n.relatedId) {
                              onNavigate('feed');
                            }
                          } catch (_) {}
                        }}
                        className={`flex gap-3 rounded-lg p-2 hover:bg-gray-50 dark:hover:bg-gray-900 cursor-pointer transition-colors mb-1 ${
                          !n.isRead ? 'bg-blue-50/40 dark:bg-blue-950/20' : ''
                        }`}
                      >
                        <img
                          src={n.senderAvatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'}
                          alt={n.senderName}
                          referrerPolicy="no-referrer"
                          className="h-10 w-10 rounded-full object-cover border border-gray-100 dark:border-gray-800 shrink-0"
                        />
                        <div className="flex flex-col flex-1 min-w-0">
                          <p className="text-xs text-gray-900 dark:text-gray-100 leading-tight">
                            <span className="font-semibold">{n.senderName}</span>{' '}
                            {n.message}
                          </p>
                          <span className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">
                            {new Date(n.createdAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                          {n.type === 'friend_request' && (
                            <div className="flex gap-1.5 mt-2">
                              <button
                                onClick={(e) => handleAcceptFriendRequest(e, n.senderId, n.senderName)}
                                className="rounded-md bg-blue-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-blue-700 transition cursor-pointer"
                              >
                                Confirm
                              </button>
                              <button
                                onClick={(e) => handleDeclineFriendRequest(e, n.senderId, n.senderName)}
                                className="rounded-md bg-gray-200 dark:bg-gray-800 px-2.5 py-1 text-[11px] font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-700 transition cursor-pointer"
                              >
                                Decline
                              </button>
                            </div>
                          )}
                        </div>
                        {!n.isRead && (
                          <div className="h-2 w-2 rounded-full bg-blue-500 self-center shrink-0" />
                        )}
                      </div>
                    ))
                  )}
                </div>

                {notifications.length > 0 && (
                  <div className="flex items-center justify-between border-t border-gray-100 pt-2 mt-1 px-2 dark:border-gray-900">
                    <button
                      onClick={handleMarkAllRead}
                      className="text-xs font-bold text-blue-600 hover:text-blue-700 hover:underline cursor-pointer transition"
                    >
                      Mark all read
                    </button>
                    <button
                      onClick={handleClearAll}
                      className="text-xs font-bold text-red-600 hover:text-red-700 hover:underline cursor-pointer transition"
                    >
                      Clear all
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* User Menu Trigger */}
        <div className="relative">
          <button
            onClick={() => {
              setShowUserDropdown(!showUserDropdown);
              setShowNotifDropdown(false);
            }}
            className="flex items-center gap-1.5 focus:outline-hidden cursor-pointer"
          >
            <img
              src={currentUser.profilePic || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'}
              alt={currentUser.username}
              referrerPolicy="no-referrer"
              className="h-9 w-9 rounded-full object-cover border border-gray-200 hover:brightness-95 active:scale-95 transition dark:border-gray-800 cursor-pointer"
            />
          </button>

          {showUserDropdown && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowUserDropdown(false)}
              />
              <div className="fixed left-4 right-4 md:absolute md:left-auto md:right-0 top-16 md:top-11 z-50 w-auto md:w-64 max-w-xs md:max-w-none md:mx-0 ml-auto mr-0 rounded-xl border border-gray-200 bg-white p-2 shadow-lg dark:border-gray-800 dark:bg-gray-950 animate-in fade-in slide-in-from-top-1 duration-150">
                <div
                  onClick={() => {
                    onNavigate('profile', currentUser.id);
                    setShowUserDropdown(false);
                  }}
                  className="flex cursor-pointer items-center gap-3 rounded-lg p-2.5 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors border-b border-gray-100 dark:border-gray-900 mb-1"
                >
                  <img
                    src={currentUser.profilePic || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'}
                    alt={currentUser.username}
                    referrerPolicy="no-referrer"
                    className="h-10 w-10 rounded-full object-cover border border-gray-200 dark:border-gray-800 cursor-pointer hover:brightness-95 transition"
                  />
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-bold text-gray-900 dark:text-gray-100 truncate">
                      {currentUser.username}
                    </span>
                    <span className="text-[11px] text-gray-500 dark:text-gray-400">
                      See your profile
                    </span>
                  </div>
                </div>

                <div className="flex flex-col">
                  <button
                    onClick={() => {
                      onNavigate('settings');
                      setShowUserDropdown(false);
                    }}
                    className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-900 cursor-pointer transition-colors"
                  >
                    <SettingsIcon className="h-4.5 w-4.5 text-gray-500" />
                    <span>Settings & Privacy</span>
                  </button>

                  {onToggleDarkMode && (
                    <button
                      onClick={() => {
                        onToggleDarkMode();
                      }}
                      className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-900 cursor-pointer transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        {darkMode ? <Sun className="h-4.5 w-4.5 text-amber-400" /> : <Moon className="h-4.5 w-4.5 text-indigo-500" />}
                        <span>{darkMode ? 'Light Mode' : 'Night Mode'}</span>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                        {darkMode ? 'ON' : 'OFF'}
                      </span>
                    </button>
                  )}

                  <button
                    onClick={() => {
                      onLogout();
                      setShowUserDropdown(false);
                    }}
                    className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/20 cursor-pointer transition-colors"
                  >
                    <LogOut className="h-4.5 w-4.5 text-red-500" />
                    <span>Log Out</span>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  </header>
  );
}
