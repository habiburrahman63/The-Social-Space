/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback, Suspense, lazy } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation, useParams } from 'react-router-dom';
import Header from './components/Header';
import Sidebar from './components/Sidebar';

// Each tab is only ever needed once the user actually navigates to it, so
// they're code-split into separate chunks instead of all being bundled into
// the initial JS payload (which previously included every tab up front,
// even on the login screen before there's a logged-in user at all).
const Feed = lazy(() => import('./components/Feed'));
const Messenger = lazy(() => import('./components/Messenger'));
const Profile = lazy(() => import('./components/Profile'));
const Friends = lazy(() => import('./components/Friends'));
const Marketplace = lazy(() => import('./components/Marketplace'));
const PagesGroups = lazy(() => import('./components/PagesGroups'));
const Events = lazy(() => import('./components/Events'));
const AdminPanel = lazy(() => import('./components/AdminPanel'));
const Settings = lazy(() => import('./components/Settings'));

// Route-level memoization. App re-renders on every background
// notification/message badge poll; without this, whichever heavy page is
// currently mounted (Feed with its posts+comments, Messenger, Profile, ...)
// would also re-render on every single poll. Wrapping the lazy components in
// React.memo skips that. It is safe because every prop they receive is either
// a primitive or one of the stable useCallback handlers defined below.
const MemoFeed = React.memo(Feed);
const MemoMessenger = React.memo(Messenger);
const MemoProfile = React.memo(Profile);
const MemoFriends = React.memo(Friends);
const MemoMarketplace = React.memo(Marketplace);
const MemoPagesGroups = React.memo(PagesGroups);
const MemoEvents = React.memo(Events);
const MemoAdminPanel = React.memo(AdminPanel);
const MemoSettings = React.memo(Settings);
import { User, Notification } from './types';
import { api } from './utils/api';
import { countUnreadInSection, HOME_NOTIFICATION_TYPES, FRIENDS_NOTIFICATION_TYPES } from './utils/notificationSections';
import { pathForView, viewForPath } from './utils/routes';
import { useScrollRestoration, resetScrollPosition } from './hooks/useScrollRestoration';
import { Shield, Users, Mail, Lock, ChevronRight, Sparkles, MessageSquare, Eye, EyeOff, CheckCircle, AlertTriangle, XCircle, Info, X, KeyRound, ArrowLeft, RefreshCw } from 'lucide-react';

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const routeParams = useParams();

  // Derived, not stored: the "current tab" and "target id" (which friend's
  // profile, which conversation) now live in the URL itself instead of in
  // React state, so the browser's own address bar, history, back/forward,
  // and refresh all naturally reflect where the user actually is.
  const activeTab = viewForPath(location.pathname);
  const targetUserId = routeParams.targetId;

  // Bumped only by a genuine "refresh this page" action (double-clicking
  // Home). Passed as a React `key` to force a full remount + refetch of the
  // Feed, without ever touching window.location or reloading the browser.
  const [feedRefreshKey, setFeedRefreshKey] = useState(0);

  useScrollRestoration();

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Sign In / Sign Up state
  const [isSignUp, setIsSignUp] = useState(false);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authUsername, setAuthUsername] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Forgot Password States
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [resetStep, setResetStep] = useState<'request' | 'verify'>('request');
  const [resetEmail, setResetEmail] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [resetResendCooldownMs, setResetResendCooldownMs] = useState(0);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState('');
  const [resetSuccess, setResetSuccess] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);

  // Active navigation tab
  const [messengerChatActive, setMessengerChatActive] = useState(false);

  // Notifications and messages counts state
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const notificationsRef = useRef<Notification[]>([]);
  const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);
  // Prevents overlapping background polls: when the backend is slow (e.g. a
  // Render cold start) the interval would otherwise keep firing and stack
  // several in-flight request pairs on top of each other.
  const notifPollInFlightRef = useRef(false);

  // Keep notificationsRef in sync with notifications state
  useEffect(() => {
    notificationsRef.current = notifications;
  }, [notifications]);

  interface ToastMessage {
    id: string;
    message: string;
    title?: string;
    avatar?: string;
    type?: 'friend_request' | 'info' | 'success' | 'warning' | 'error';
    senderId?: string;
    actionLabel?: string;
    onAction?: () => void;
  }

  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const triggerToast = (msg: string, options?: {
    title?: string;
    avatar?: string;
    type?: 'friend_request' | 'info' | 'success' | 'warning' | 'error';
    senderId?: string;
    actionLabel?: string;
    onAction?: () => void;
  }) => {
    const id = 'toast-' + Date.now().toString(36) + '-' + Math.random().toString(36).substr(2, 9);
    const newToast: ToastMessage = {
      id,
      message: msg,
      title: options?.title,
      avatar: options?.avatar,
      type: options?.type || 'info',
      senderId: options?.senderId,
      actionLabel: options?.actionLabel,
      onAction: options?.onAction
    };
    setToasts(prev => [...prev, newToast]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 5500);
  };

  const handleAcceptFriendRequest = async (senderId: string) => {
    try {
      await api.post(`/api/friends/accept/${senderId}`);
      triggerToast('Friend request accepted!', { type: 'success' });
      fetchCurrentUser();
      fetchNotificationsAndCounts();
      // Dispatch custom event to notify Friends component to refresh
      window.dispatchEvent(new CustomEvent('friends-updated'));
      window.dispatchEvent(new CustomEvent('notifications-updated'));
    } catch (err: any) {
      triggerToast(err.message || 'Failed to accept friend request', { type: 'error' });
    }
  };

  useEffect(() => {
    const handleToastEvent = (e: Event) => {
      const customEvent = e as CustomEvent<{
        message: string;
        options?: {
          title?: string;
          avatar?: string;
          type?: 'friend_request' | 'info' | 'success' | 'warning' | 'error';
          senderId?: string;
          actionLabel?: string;
          onAction?: () => void;
        };
      }>;
      if (customEvent.detail) {
        triggerToast(customEvent.detail.message, customEvent.detail.options);
      }
    };
    window.addEventListener('show-toast', handleToastEvent);
    return () => window.removeEventListener('show-toast', handleToastEvent);
  }, []);

  const fetchCurrentUser = useCallback(async () => {
    const token = localStorage.getItem('social_token');
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const res = await api.get('/api/auth/me');
      if (res?.user) {
        setCurrentUser(res.user);
      } else {
        localStorage.removeItem('social_token');
      }
    } catch (err) {
      localStorage.removeItem('social_token');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchNotificationsAndCounts = useCallback(async () => {
    if (notifPollInFlightRef.current) return;
    notifPollInFlightRef.current = true;
    try {
      // Both values are independent, so fetch them in parallel instead of one
      // after the other - halves the round-trip time of every poll.
      const [notifRes, unreadRes] = await Promise.all([
        api.get('/api/notifications'),
        api.get('/api/messages/unread/count'),
      ]);
      const fetchedNotifs: Notification[] = notifRes.notifications || [];
      
      // Compare with existing notifications to find brand new ones
      const prevNotifs = notificationsRef.current;
      if (prevNotifs.length > 0) {
        const brandNewNotifs = fetchedNotifs.filter(
          n => !n.isRead && !prevNotifs.some(existing => existing.id === n.id)
        );
        
        brandNewNotifs.forEach(newNotif => {
          // Toast trigger
          if (newNotif.type === 'friend_request') {
            triggerToast(newNotif.message, {
              title: newNotif.senderName,
              avatar: newNotif.senderAvatar,
              type: 'friend_request',
              senderId: newNotif.senderId,
              actionLabel: 'Accept',
              onAction: () => handleAcceptFriendRequest(newNotif.senderId)
            });
          } else if (newNotif.type === 'friend_accept') {
            triggerToast(`accepted your friend request! 🤝`, {
              title: newNotif.senderName,
              avatar: newNotif.senderAvatar,
              type: 'success'
            });
          } else {
            triggerToast(newNotif.message, {
              title: newNotif.senderName,
              avatar: newNotif.senderAvatar,
              type: 'info'
            });
          }
          
          // Play soft alert audio
          try {
            const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-600.wav');
            audio.volume = 0.3;
            audio.play().catch(() => {});
          } catch (_) {}
        });
      }

      setNotifications(fetchedNotifs);
      
      setUnreadMessagesCount(unreadRes.count || 0);
    } catch (_) {
    } finally {
      notifPollInFlightRef.current = false;
    }
  }, []);

  // Theme state
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) return savedTheme === 'dark';
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [darkMode]);

  const handleToggleDarkMode = useCallback(() => {
    setDarkMode(prev => !prev);
  }, []);

  useEffect(() => {
    fetchCurrentUser();
  }, []);

  useEffect(() => {
    if (currentUser?.id) {
      fetchNotificationsAndCounts();

      // Poll every 10s while the tab is visible/foregrounded and pause while
      // it's backgrounded (re-fetching once on return). Together with the
      // in-flight guard inside fetchNotificationsAndCounts this keeps the
      // badges live without hammering a slow or cold-starting backend with
      // overlapping request pairs every few seconds.
      let interval: ReturnType<typeof setInterval> | null = null;

      const startPolling = () => {
        if (interval) return;
        interval = setInterval(fetchNotificationsAndCounts, 10000);
      };
      const stopPolling = () => {
        if (interval) {
          clearInterval(interval);
          interval = null;
        }
      };

      const handleVisibilityChange = () => {
        if (document.hidden) {
          stopPolling();
        } else {
          fetchNotificationsAndCounts();
          startPolling();
        }
      };

      if (!document.hidden) startPolling();
      document.addEventListener('visibilitychange', handleVisibilityChange);

      return () => {
        stopPolling();
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      };
    }
  }, [currentUser?.id]);

  // Clear the relevant section's unread badge when the user is actually
  // looking at that section, the same way opening a conversation already
  // clears the Messages badge.
  useEffect(() => {
    if (!currentUser?.id) return;

    const sectionTypes = activeTab === 'feed' ? HOME_NOTIFICATION_TYPES
      : activeTab === 'friends' ? FRIENDS_NOTIFICATION_TYPES
      : null;
    if (!sectionTypes) return;

    const section = activeTab === 'feed' ? 'home' : 'friends';
    if (countUnreadInSection(notifications, section as any) === 0) return;

    api.post('/api/notifications/read', { types: sectionTypes })
      .then(fetchNotificationsAndCounts)
      .catch(() => {});
  }, [activeTab, currentUser?.id, notifications]);

  // Tick down the password-reset resend cooldown once a second while it's active.
  useEffect(() => {
    if (resetResendCooldownMs <= 0) return;
    const timer = setInterval(() => setResetResendCooldownMs((ms) => Math.max(0, ms - 1000)), 1000);
    return () => clearInterval(timer);
  }, [resetResendCooldownMs > 0]);

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (authLoading) return;
    setAuthError('');
    if (!authEmail || !authPassword || (isSignUp && !authUsername)) {
      setAuthError('Please fill in all required fields.');
      return;
    }

    if (isSignUp && !authEmail.includes('@')) {
      setAuthError('Please enter a valid email address.');
      return;
    }

    setAuthLoading(true);
    try {
      if (isSignUp) {
        const res = await api.post('/api/auth/register', {
          username: authUsername,
          email: authEmail,
          password: authPassword,
        });
        if (res?.token) localStorage.setItem('social_token', res.token);
        triggerToast('Welcome to Social Space! Custom profile created.');
      } else {
        const res = await api.post('/api/auth/login', {
          email: authEmail,
          password: authPassword,
        });
        if (res?.token) localStorage.setItem('social_token', res.token);
        triggerToast('Welcome back! Successfully authenticated.');
      }
      await fetchCurrentUser();
    } catch (err: any) {
      setAuthError(err.message || 'Authentication failed. Please verify credentials.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleRequestResetCode = async () => {
    setResetError('');
    setResetSuccess('');

    if (!resetEmail) {
      setResetError('Please enter your registered email address.');
      return;
    }

    if (!resetEmail.includes('@')) {
      setResetError('Please enter a valid email address.');
      return;
    }

    setResetLoading(true);
    try {
      const res = await api.post('/api/auth/forgot-password', {
        email: resetEmail
      });
      if (res?.success) {
        setResetStep('verify');
        setResetResendCooldownMs(60000);
        triggerToast('Password reset code sent to your email!');
      }
    } catch (err: any) {
      setResetError(err.message || 'Failed to send password reset code.');
    } finally {
      setResetLoading(false);
    }
  };

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError('');
    setResetSuccess('');

    if (!resetCode) {
      setResetError('Please enter the 6-digit verification code.');
      return;
    }

    if (resetCode.length !== 6) {
      setResetError('Verification code must be exactly 6 digits.');
      return;
    }

    if (!newPassword) {
      setResetError('Please enter a new password.');
      return;
    }

    if (newPassword.length < 6) {
      setResetError('New password must be at least 6 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setResetError('Passwords do not match. Please try again.');
      return;
    }

    setResetLoading(true);
    try {
      const res = await api.post('/api/auth/reset-password', {
        email: resetEmail,
        otp: resetCode,
        newPassword
      });

      if (res?.success) {
        triggerToast('Password reset successfully! You can now sign in with your new password.', { type: 'success' });
        setAuthEmail(resetEmail);
        setAuthPassword(newPassword);
        setIsForgotPassword(false);
        setResetStep('request');
        setResetEmail('');
        setResetCode('');
        setNewPassword('');
        setConfirmPassword('');
      }
    } catch (err: any) {
      setResetError(err.message || 'Failed to reset password. Invalid or expired code.');
    } finally {
      setResetLoading(false);
    }
  };

  const handleLogout = useCallback(() => {
    localStorage.removeItem('social_token');
    setCurrentUser(null);
    navigate('/', { replace: true });
    triggerToast('Logged out successfully.');
  }, [navigate]);

  // Safe Navigation controller. Signature is unchanged - every child
  // component still just calls onNavigate(view, targetId) exactly as
  // before - but it now drives the real URL via react-router instead of
  // local state, so back/forward/refresh/direct-URL-access all work.
  //
  // forceRefresh is only ever set by the Home button's double-click: it
  // doesn't touch the URL differently, it just bumps a key that remounts
  // Feed to fetch genuinely fresh data (see feedRefreshKey below).
  const handleNavigate = useCallback((view: string, targetId?: string, forceRefresh?: boolean) => {
    const nextPath = pathForView(view, targetId);
    const isCurrent = nextPath === location.pathname;

    navigate(nextPath, { replace: isCurrent });

    if (view === 'feed') {
      resetScrollPosition('/');
      if (forceRefresh || isCurrent) {
        window.dispatchEvent(new CustomEvent('refresh-feed'));
      }
    }

    if (view !== 'messenger') {
      setMessengerChatActive(false);
    } else {
      setMessengerChatActive(!!targetId);
    }
  }, [navigate, location.pathname]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 text-xs font-bold uppercase tracking-wider text-gray-500 animate-pulse dark:bg-gray-950 dark:text-gray-400">
        Syncing global sessions...
      </div>
    );
  }

  // 1. LANDING LOGIN SCREEN
  if (!currentUser) {
    return (
      <div className="flex min-h-screen flex-col md:flex-row items-center justify-center bg-[#F0F2F5] dark:bg-gray-950 p-4 transition-colors duration-200">
        
        {/* Dynamic Toast Alerts component */}
        <div className="fixed bottom-4 left-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
          {toasts.map(t => {
            const isFriendRequest = t.type === 'friend_request';
            return (
              <div
                key={t.id}
                className="pointer-events-auto w-full rounded-2xl bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-4 shadow-2xl border border-gray-150 dark:border-gray-800 flex flex-col gap-3 animate-in slide-in-from-bottom duration-300 transition-all"
              >
                <div className="flex items-start gap-3">
                  {isFriendRequest ? (
                    t.avatar ? (
                      <img
                        src={t.avatar}
                        alt={t.title || 'User'}
                        referrerPolicy="no-referrer"
                        className="h-10 w-10 rounded-full object-cover border border-gray-200 dark:border-gray-800"
                      />
                    ) : (
                      <div className="h-10 w-10 rounded-full bg-blue-100 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400 flex items-center justify-center font-bold text-sm">
                        {t.title ? t.title[0].toUpperCase() : 'U'}
                      </div>
                    )
                  ) : (
                    <div className={`p-2 rounded-xl shrink-0 ${
                      t.type === 'success' ? 'bg-green-50 text-green-600 dark:bg-green-950/30 dark:text-green-400' :
                      t.type === 'error' ? 'bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-400' :
                      t.type === 'warning' ? 'bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400' :
                      'bg-blue-50 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400'
                    }`}>
                      {t.type === 'success' && <CheckCircle className="h-5 w-5" />}
                      {t.type === 'error' && <XCircle className="h-5 w-5" />}
                      {t.type === 'warning' && <AlertTriangle className="h-5 w-5" />}
                      {t.type === 'info' && <Sparkles className="h-5 w-5" />}
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    {t.title && (
                      <p className="text-xs font-black text-gray-900 dark:text-white truncate">
                        {t.title}
                      </p>
                    )}
                    <p className="text-[11px] text-gray-600 dark:text-gray-400 font-semibold leading-relaxed">
                      {t.message}
                    </p>
                  </div>

                  <button
                    onClick={() => setToasts(prev => prev.filter(item => item.id !== t.id))}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition cursor-pointer"
                  >
                    <X className="h-4.5 w-4.5" />
                  </button>
                </div>

                {isFriendRequest && (
                  <div className="flex items-center gap-2 pl-13">
                    <button
                      onClick={async () => {
                        if (t.onAction) t.onAction();
                        setToasts(prev => prev.filter(item => item.id !== t.id));
                      }}
                      className="rounded-lg bg-blue-600 text-white hover:bg-blue-700 px-3 py-1.5 text-[10px] font-extrabold cursor-pointer transition shadow-sm hover:shadow-md"
                    >
                      Accept
                    </button>
                    <button
                      onClick={() => setToasts(prev => prev.filter(item => item.id !== t.id))}
                      className="rounded-lg bg-gray-100 text-gray-800 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700 px-3 py-1.5 text-[10px] font-extrabold cursor-pointer transition"
                    >
                      Ignore
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex w-full max-w-4xl flex-col md:flex-row items-center md:justify-between gap-8 md:gap-12">
          {/* Branding Left Column */}
          <div className="max-w-md space-y-4 text-center md:text-left">
            <h1 className="text-4xl md:text-5xl font-black tracking-tight text-[#1877F2]">
              Social Space
            </h1>
            <p className="text-sm md:text-base text-gray-600 dark:text-gray-400 font-medium leading-relaxed">
              Connect with friends, share stories, list marketplace products, and discover upcoming meetups around you in our clean custom playground.
            </p>
          </div>

          {/* Form Right Column */}
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-gray-900 dark:border dark:border-gray-800 transition-all duration-200">
            {authError && !isForgotPassword && (
              <div className="mb-4 rounded-lg bg-red-50 p-2.5 text-[11px] font-bold text-red-600 border border-red-100 dark:bg-red-950/20 dark:border-red-900/30">
                {authError}
              </div>
            )}

            {isForgotPassword ? (
              <div className="space-y-4 text-xs animate-in fade-in duration-200">
                <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3 mb-2">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-xl bg-blue-50 text-[#1877F2] dark:bg-blue-950/40 dark:text-blue-400">
                      <KeyRound className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">
                        {resetStep === 'request' ? 'Forgot Password' : 'Reset Your Password'}
                      </h3>
                      <p className="text-[10px] text-gray-500 dark:text-gray-400">
                        {resetStep === 'request'
                          ? 'Enter your registered email to receive a code'
                          : `Verification code sent to ${resetEmail}`}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setIsForgotPassword(false);
                      setResetError('');
                      setResetSuccess('');
                    }}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-[11px] font-bold cursor-pointer transition flex items-center gap-1"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    <span>Back</span>
                  </button>
                </div>

                {resetError && (
                  <div className="rounded-lg bg-red-50 p-2.5 text-[11px] font-bold text-red-600 border border-red-100 dark:bg-red-950/20 dark:border-red-900/30">
                    {resetError}
                  </div>
                )}

                {resetSuccess && (
                  <div className="rounded-lg bg-green-50 p-2.5 text-[11px] font-bold text-green-600 border border-green-100 dark:bg-green-950/20 dark:border-green-900/30">
                    {resetSuccess}
                  </div>
                )}

                {resetStep === 'request' ? (
                  <form onSubmit={(e) => { e.preventDefault(); handleRequestResetCode(); }} className="space-y-4">
                    <div>
                      <label className="block font-bold text-gray-500 mb-1">Registered Email Address</label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-2.5 h-4.5 w-4.5 text-gray-400" />
                        <input
                          type="email"
                          required
                          placeholder="Enter your registered email"
                          value={resetEmail}
                          onChange={(e) => setResetEmail(e.target.value)}
                          className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2 pl-9 pr-3 focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-blue-500 dark:border-gray-800 dark:bg-gray-950 dark:text-white"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={resetLoading}
                      className="w-full rounded-xl bg-[#1877F2] py-2.5 text-sm font-bold text-white hover:bg-blue-600 hover:shadow-md transition duration-200 active:scale-95 cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
                    >
                      {resetLoading ? (
                        <span className="flex items-center gap-2">
                          <RefreshCw className="h-4 w-4 animate-spin" />
                          Sending Code...
                        </span>
                      ) : (
                        <>
                          <span>Send Verification Code</span>
                          <ChevronRight className="h-4 w-4" />
                        </>
                      )}
                    </button>
                  </form>
                ) : (
                  <form onSubmit={handleResetPasswordSubmit} className="space-y-3.5">
                    <div className="rounded-xl border border-green-100 bg-green-50/40 p-3 dark:border-green-950/40 dark:bg-green-950/10 space-y-1 animate-in fade-in duration-150">
                      <div className="flex items-center gap-1.5 text-green-600 dark:text-green-400 font-bold text-[11px]">
                        <Mail className="h-4 w-4 text-green-500" />
                        <span>Reset Code Sent to Email!</span>
                      </div>
                      <p className="text-[10px] text-gray-600 dark:text-gray-400 leading-relaxed font-medium">
                        We sent a 6-digit code to <strong className="text-gray-800 dark:text-gray-200">{resetEmail}</strong>. Please check your inbox and spam folder.
                      </p>
                    </div>

                    <div>
                      <label className="block font-bold text-gray-500 mb-1">6-Digit Verification Code</label>
                      <input
                        type="text"
                        required
                        maxLength={6}
                        placeholder="Enter 6-digit code"
                        value={resetCode}
                        onChange={(e) => setResetCode(e.target.value.replace(/\D/g, ''))}
                        className="w-full text-center rounded-lg border border-gray-200 bg-gray-50 py-2 text-base font-bold tracking-widest focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-blue-500 dark:border-gray-800 dark:bg-gray-950 dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-gray-500 mb-1">New Password</label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-2.5 h-4.5 w-4.5 text-gray-400" />
                        <input
                          type={showNewPassword ? "text" : "password"}
                          required
                          placeholder="Minimum 6 characters"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2 pl-9 pr-10 focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-blue-500 dark:border-gray-800 dark:bg-gray-950 dark:text-white"
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPassword(!showNewPassword)}
                          className="absolute right-3 top-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer focus:outline-hidden"
                          title={showNewPassword ? "Hide password" : "Show password"}
                        >
                          {showNewPassword ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block font-bold text-gray-500 mb-1">Confirm New Password</label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-2.5 h-4.5 w-4.5 text-gray-400" />
                        <input
                          type={showNewPassword ? "text" : "password"}
                          required
                          placeholder="Re-enter new password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2 pl-9 pr-3 focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-blue-500 dark:border-gray-800 dark:bg-gray-950 dark:text-white"
                        />
                      </div>
                    </div>

                    <div className="pt-1 space-y-2">
                      <button
                        type="submit"
                        disabled={resetLoading}
                        className="w-full rounded-xl bg-[#1877F2] py-2.5 text-sm font-bold text-white hover:bg-blue-600 hover:shadow-md transition duration-200 active:scale-95 cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
                      >
                        {resetLoading ? (
                          <span className="flex items-center gap-2">
                            <RefreshCw className="h-4 w-4 animate-spin" />
                            Resetting Password...
                          </span>
                        ) : (
                          <span>Reset Password & Sign In</span>
                        )}
                      </button>

                      <div className="flex items-center justify-between text-[10px] font-bold text-gray-500 pt-1">
                        <button
                          type="button"
                          onClick={() => handleRequestResetCode()}
                          disabled={resetLoading || resetResendCooldownMs > 0}
                          className="hover:text-blue-500 transition cursor-pointer disabled:opacity-50"
                        >
                          {resetResendCooldownMs > 0 ? `Resend Code (${Math.ceil(resetResendCooldownMs / 1000)}s)` : 'Resend Code'}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setResetStep('request');
                            setResetError('');
                            setResetResendCooldownMs(0);
                          }}
                          className="hover:text-gray-800 dark:hover:text-gray-200 transition cursor-pointer"
                        >
                          Change Email
                        </button>
                      </div>
                    </div>
                  </form>
                )}
              </div>
            ) : (
              <form onSubmit={handleAuthSubmit} className="space-y-4 text-xs">
                {isSignUp && (
                  <div>
                    <label className="block font-bold text-gray-500 mb-1">Full Name</label>
                    <div className="relative">
                      <Users className="absolute left-3 top-2.5 h-4.5 w-4.5 text-gray-400" />
                      <input
                        type="text"
                        required
                        placeholder="Full Name"
                        value={authUsername}
                        onChange={(e) => setAuthUsername(e.target.value)}
                        className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2 pl-9 pr-3 focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-blue-500 dark:border-gray-800 dark:bg-gray-950 dark:text-white"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block font-bold text-gray-500 mb-1">Email Address</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-2.5 h-4.5 w-4.5 text-gray-400" />
                    <input
                      type="email"
                      required
                      placeholder="name@domain.com"
                      value={authEmail}
                      onChange={(e) => setAuthEmail(e.target.value)}
                      className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2 pl-9 pr-3 focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-blue-500 dark:border-gray-800 dark:bg-gray-950 dark:text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-gray-500 mb-1">Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-2.5 h-4.5 w-4.5 text-gray-400" />
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      placeholder="Min 6 characters"
                      value={authPassword}
                      onChange={(e) => setAuthPassword(e.target.value)}
                      className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2 pl-9 pr-10 focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-blue-500 dark:border-gray-800 dark:bg-gray-950 dark:text-white"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer focus:outline-hidden"
                      title={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
                    </button>
                  </div>
                  {!isSignUp && (
                    <div className="flex justify-end pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setAuthError('');
                          setResetError('');
                          setResetSuccess('');
                          setResetEmail(authEmail || '');
                          setResetCode('');
                          setNewPassword('');
                          setConfirmPassword('');
                          setResetStep('request');
                          setIsForgotPassword(true);
                        }}
                        className="text-[11px] font-bold text-[#1877F2] hover:underline cursor-pointer transition"
                      >
                        Forgot Password?
                      </button>
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={authLoading}
                  className="w-full rounded-xl bg-[#1877F2] py-2.5 text-sm font-bold text-white hover:bg-blue-600 hover:shadow-md transition duration-200 active:scale-95 cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  {authLoading ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <span>{isSignUp ? 'Create Account' : 'Sign In'}</span>
                      <ChevronRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </form>
            )}

            <div className="my-5 border-t border-gray-150 dark:border-gray-800" />

            <div className="text-center">
              <button
                onClick={() => {
                  setAuthError('');
                  setIsForgotPassword(false);
                  setIsSignUp(!isSignUp);
                }}
                className="rounded-xl bg-[#42B72A] px-6 py-2.5 text-sm font-bold text-white hover:bg-[#36a420] hover:shadow-md transition duration-200 active:scale-95 cursor-pointer"
              >
                {isSignUp ? 'Already have an account? Sign In' : 'Create New Account'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 2. AUTHENTICATED APP WORKSPACE
  return (
    <div className="min-h-screen bg-[#F0F2F5] text-gray-900 flex flex-col dark:bg-gray-950 dark:text-gray-100 transition-colors duration-200">
      
      {/* Dynamic Toast Alerts component */}
      <div className="fixed bottom-4 left-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
        {toasts.map((t, idx) => {
          const isFriendRequest = t.type === 'friend_request';
          return (
            <div
              key={t.id ? `${t.id}-${idx}` : `toast-${idx}`}
              className="pointer-events-auto w-full rounded-2xl bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-4 shadow-2xl border border-gray-150 dark:border-gray-800 flex flex-col gap-3 animate-in slide-in-from-bottom duration-300 transition-all"
            >
              <div className="flex items-start gap-3">
                {isFriendRequest ? (
                  t.avatar ? (
                    <img
                      src={t.avatar}
                      alt={t.title || 'User'}
                      referrerPolicy="no-referrer"
                      className="h-10 w-10 rounded-full object-cover border border-gray-200 dark:border-gray-800"
                    />
                  ) : (
                    <div className="h-10 w-10 rounded-full bg-blue-100 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400 flex items-center justify-center font-bold text-sm">
                      {t.title ? t.title[0].toUpperCase() : 'U'}
                    </div>
                  )
                ) : (
                  <div className={`p-2 rounded-xl shrink-0 ${
                    t.type === 'success' ? 'bg-green-50 text-green-600 dark:bg-green-950/30 dark:text-green-400' :
                    t.type === 'error' ? 'bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-400' :
                    t.type === 'warning' ? 'bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400' :
                    'bg-blue-50 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400'
                  }`}>
                    {t.type === 'success' && <CheckCircle className="h-5 w-5" />}
                    {t.type === 'error' && <XCircle className="h-5 w-5" />}
                    {t.type === 'warning' && <AlertTriangle className="h-5 w-5" />}
                    {t.type === 'info' && <Sparkles className="h-5 w-5" />}
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  {t.title && (
                    <p className="text-xs font-black text-gray-900 dark:text-white truncate">
                      {t.title}
                    </p>
                  )}
                  <p className="text-[11px] text-gray-600 dark:text-gray-400 font-semibold leading-relaxed">
                    {t.message}
                  </p>
                </div>

                <button
                  onClick={() => setToasts(prev => prev.filter(item => item.id !== t.id))}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition cursor-pointer"
                >
                  <X className="h-4.5 w-4.5" />
                </button>
              </div>

              {isFriendRequest && (
                <div className="flex items-center gap-2 pl-13">
                  <button
                    onClick={async () => {
                      if (t.onAction) t.onAction();
                      setToasts(prev => prev.filter(item => item.id !== t.id));
                    }}
                    className="rounded-lg bg-blue-600 text-white hover:bg-blue-700 px-3 py-1.5 text-[10px] font-extrabold cursor-pointer transition shadow-sm hover:shadow-md"
                  >
                    Accept
                  </button>
                  <button
                    onClick={() => setToasts(prev => prev.filter(item => item.id !== t.id))}
                    className="rounded-lg bg-gray-100 text-gray-800 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700 px-3 py-1.5 text-[10px] font-extrabold cursor-pointer transition"
                  >
                    Ignore
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Header bar */}
      <Header
        currentUser={currentUser}
        onNavigate={handleNavigate}
        onLogout={handleLogout}
        notifications={notifications}
        onRefreshNotifications={fetchNotificationsAndCounts}
        unreadMessagesCount={unreadMessagesCount}
        activeTab={activeTab}
        messengerChatActive={messengerChatActive}
        darkMode={darkMode}
        onToggleDarkMode={handleToggleDarkMode}
      />

      {/* Left Sidebar and main layout wrapper */}
      <div className="flex-1 flex w-full mx-auto relative max-w-[1340px]">
        <Sidebar
          currentUser={currentUser}
          currentView={activeTab}
          onNavigate={handleNavigate}
          unreadMessagesCount={unreadMessagesCount}
          notifications={notifications}
        />

        {/* Central Dynamic view panel */}
        <main className="flex-1 min-w-0 flex flex-col">
        <Suspense fallback={
          <div className="flex flex-1 items-center justify-center text-xs font-bold uppercase tracking-wider text-gray-400 animate-pulse">
            Loading...
          </div>
        }>
          <Routes>
            <Route
              path="/"
              element={<MemoFeed key={feedRefreshKey} currentUser={currentUser} onNavigate={handleNavigate} />}
            />

            <Route
              path="/messenger/:targetId?"
              element={
                <MemoMessenger
                  currentUser={currentUser}
                  initialTargetUserId={targetUserId}
                  onNavigate={handleNavigate}
                  onChatActiveChange={setMessengerChatActive}
                />
              }
            />

            <Route
              path="/profile/:targetId?"
              element={
                <MemoProfile
                  currentUser={currentUser}
                  profileUserId={targetUserId || currentUser.id}
                  onNavigate={handleNavigate}
                  onProfileUpdated={fetchCurrentUser}
                />
              }
            />

            <Route
              path="/friends"
              element={<MemoFriends currentUser={currentUser} onNavigate={handleNavigate} onRefreshUser={fetchCurrentUser} />}
            />

            <Route
              path="/marketplace"
              element={<MemoMarketplace currentUser={currentUser} onNavigate={handleNavigate} />}
            />

            <Route
              path="/pages"
              element={<MemoPagesGroups key="pages" currentUser={currentUser} onNavigate={handleNavigate} initialSection="pages" />}
            />
            <Route
              path="/groups"
              element={<MemoPagesGroups key="groups" currentUser={currentUser} onNavigate={handleNavigate} initialSection="groups" />}
            />

            <Route
              path="/events"
              element={<MemoEvents currentUser={currentUser} onNavigate={handleNavigate} />}
            />

            <Route
              path="/admin"
              element={currentUser.role === 'admin' ? <MemoAdminPanel /> : <Navigate to="/" replace />}
            />

            <Route
              path="/settings"
              element={
                <MemoSettings
                  currentUser={currentUser}
                  onRefreshUser={fetchCurrentUser}
                  onLogout={handleLogout}
                  darkMode={darkMode}
                  onToggleDarkMode={handleToggleDarkMode}
                />
              }
            />

            {/* Unknown path (or a stale bookmarked/shared URL) - land safely
                on Home instead of showing a blank page. */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
        </main>
      </div>
    </div>
  );
}
