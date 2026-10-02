/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Newspaper, Users, MessageSquare, Flag, Users as GroupsIcon, ShoppingBag, Calendar, Settings, Shield, User as UserIcon } from 'lucide-react';
import { User, Notification } from '../types';
import { countUnreadInSection } from '../utils/notificationSections';

interface SidebarProps {
  currentUser: User;
  currentView: string;
  onNavigate: (view: string, targetId?: string, forceRefresh?: boolean) => void;
  unreadMessagesCount: number;
  notifications?: Notification[];
}

export default function Sidebar({ currentUser, currentView, onNavigate, unreadMessagesCount, notifications = [] }: SidebarProps) {
  const homeUnread = countUnreadInSection(notifications, 'home');
  const friendsUnread = countUnreadInSection(notifications, 'friends');

  const menuItems = [
    { id: 'feed', label: 'News Feed', icon: Newspaper, color: 'text-blue-500', count: homeUnread },
    { id: 'friends', label: 'Friends Hub', icon: Users, color: 'text-indigo-500', count: friendsUnread },
    { id: 'messenger', label: 'Messenger', icon: MessageSquare, color: 'text-emerald-500', count: unreadMessagesCount },
    { id: 'pages', label: 'Pages Discover', icon: Flag, color: 'text-orange-500' },
    { id: 'groups', label: 'Groups Hub', icon: GroupsIcon, color: 'text-teal-500' },
    { id: 'marketplace', label: 'Marketplace', icon: ShoppingBag, color: 'text-red-500' },
    { id: 'events', label: 'Events Calendar', icon: Calendar, color: 'text-pink-500' },
    { id: 'settings', label: 'Settings', icon: Settings, color: 'text-gray-500' },
  ];

  return (
    <aside className="sticky top-14 left-0 hidden h-[calc(100vh-3.5rem)] w-64 shrink-0 overflow-y-auto border-r border-gray-100 bg-gray-50/50 p-3 md:block dark:border-gray-800 dark:bg-gray-950 transition-colors duration-200">
      {/* Profile quick-link */}
      <div
        onClick={() => onNavigate('profile', currentUser.id)}
        className="flex cursor-pointer items-center gap-3 rounded-xl p-2.5 hover:bg-gray-200/50 dark:hover:bg-gray-900/50 transition-all active:scale-[0.98]"
      >
        <img
          src={currentUser.profilePic || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'}
          alt={currentUser.username}
          referrerPolicy="no-referrer"
          className="h-9 w-9 rounded-full object-cover border border-white shadow-xs dark:border-gray-800"
        />
        <div className="flex flex-col min-w-0">
          <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
            {currentUser.username}
          </span>
          <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400">
            View Profile
          </span>
        </div>
      </div>

      <div className="my-3 border-t border-gray-200/60 dark:border-gray-800/60" />

      {/* Menu links list */}
      <nav className="space-y-1">
        {menuItems.map(item => {
          const Icon = item.icon;
          const isActive = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              onDoubleClick={item.id === 'feed' ? () => onNavigate('feed', undefined, true) : undefined}
              className={`flex w-full items-center justify-between rounded-xl p-2.5 text-left text-sm font-medium transition-all cursor-pointer ${
                isActive
                  ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400'
                  : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-900'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon className={`h-5 w-5 ${item.color} ${isActive ? 'scale-110' : ''} transition-transform`} />
                <span>{item.label}</span>
              </div>
              {item.count && item.count > 0 ? (
                <span className="rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-bold text-white">
                  {item.count}
                </span>
              ) : null}
            </button>
          );
        })}

        {/* Admin only rail item */}
        {currentUser.role === 'admin' && (
          <button
            onClick={() => onNavigate('admin')}
            className={`flex w-full items-center justify-between rounded-xl p-2.5 text-left text-sm font-medium transition-all cursor-pointer ${
              currentView === 'admin'
                ? 'bg-orange-50 text-orange-700 dark:bg-orange-950/30 dark:text-orange-400'
                : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-900'
            }`}
          >
            <div className="flex items-center gap-3">
              <Shield className={`h-5 w-5 text-orange-600 ${currentView === 'admin' ? 'scale-110' : ''}`} />
              <span>Admin Hub</span>
            </div>
          </button>
        )}
      </nav>

      {/* Static Sponsored/Credit panel */}
      <div className="mt-8 rounded-2xl bg-blue-50/30 border border-blue-100/50 p-3 dark:bg-blue-950/10 dark:border-blue-900/20">
        <span className="text-[10px] font-bold tracking-wider uppercase text-blue-600 dark:text-blue-400">Sponsored</span>
        <div className="mt-2 flex gap-3">
          <img
            src="https://images.unsplash.com/photo-1531297484001-80022131f5a1?w=100"
            alt="Sponsored"
            referrerPolicy="no-referrer"
            className="h-12 w-12 rounded-lg object-cover shrink-0 border border-gray-200 dark:border-gray-800"
          />
          <div className="flex flex-col justify-center min-w-0">
            <h4 className="text-xs font-bold text-gray-900 dark:text-gray-100 truncate">Velo Quantum Core</h4>
            <p className="text-[10px] text-gray-500 dark:text-gray-400 line-clamp-2">The future of local full-stack compiling, live in port 3000.</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
