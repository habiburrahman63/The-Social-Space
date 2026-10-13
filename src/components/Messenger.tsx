/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Search, Phone, Video, Send, Smile, ThumbsUp, Trash2, Mic, Paperclip, MoreVertical, ShieldAlert, CheckCheck, Play, Pause, X,
  PhoneCall, PhoneOff, Volume2, Maximize2, MessageSquare, Home, Plus, ArrowLeft, RefreshCw
} from 'lucide-react';
import { User, Message } from '../types';
import { api } from '../utils/api';
import { isUserOnline, formatLastSeen } from '../utils/presence';

const formatMessageTime = (isoString: string) => {
  if (!isoString) return '';
  try {
    const d = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase();
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return d.toLocaleDateString([], { weekday: 'short' });
    } else {
      return d.toLocaleDateString([], { day: 'numeric', month: 'short' });
    }
  } catch (_) {
    return '';
  }
};

interface MessengerProps {
  currentUser: User;
  initialTargetUserId?: string;
  onNavigate: (view: string, targetId?: string) => void;
  onChatActiveChange?: (active: boolean) => void;
}

export default function Messenger({ currentUser, initialTargetUserId, onNavigate, onChatActiveChange }: MessengerProps) {
  const [friends, setFriends] = useState<User[]>([]);
  const [selectedFriend, setSelectedFriend] = useState<User | null>(null);

  useEffect(() => {
    if (onChatActiveChange) {
      onChatActiveChange(!!selectedFriend);
    }
  }, [selectedFriend, onChatActiveChange]);

  const [messages, setMessages] = useState<Message[]>([]);
  const [messageText, setMessageText] = useState('');
  const [typing, setTyping] = useState(false);
  const [isFriendTyping, setIsFriendTyping] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Loading & error states
  const [contactsLoading, setContactsLoading] = useState(true);
  const [contactsError, setContactsError] = useState<string | null>(null);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messagesError, setMessagesError] = useState<string | null>(null);
  const fetchMessagesRef = useRef<((isInitial?: boolean) => Promise<void>) | null>(null);
  const fetchContactsRef = useRef<(() => Promise<void>) | null>(null);

  // Custom message types
  const [gifUrl, setGifUrl] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [voiceSeconds, setVoiceSeconds] = useState(0);

  // Calls overlay state
  const [activeCall, setActiveCall] = useState<{ type: 'voice' | 'video'; status: 'calling' | 'connected' } | null>(null);
  const [callTimer, setCallTimer] = useState(0);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const voiceTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const callTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const ringTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // In-flight guards so the polling below can't stack overlapping requests.
  const contactsInFlightRef = useRef(false);
  const messagesInFlightRef = useRef(false);
  // Prevents a double-Enter / double-click from sending the same message twice.
  const sendInFlightRef = useRef(false);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (voiceTimerRef.current) clearInterval(voiceTimerRef.current);
      if (callTimerRef.current) clearInterval(callTimerRef.current);
      if (ringTimeoutRef.current) clearTimeout(ringTimeoutRef.current);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, []);

  const activeFriend = selectedFriend ? (friends.find(u => u.id === selectedFriend.id) || selectedFriend) : null;
  const activeFriendOnline = activeFriend ? isUserOnline(activeFriend.lastActiveAt) : false;
  const activeFriendLastSeen = activeFriend ? formatLastSeen(activeFriend.lastActiveAt) : '';

  // Fetch contacts list with polling to stay in sync when new friends are accepted
  useEffect(() => {
    const fetchContacts = async (isManual = false) => {
      if (contactsInFlightRef.current) return;
      contactsInFlightRef.current = true;
      if (isManual) {
        setContactsLoading(true);
        setContactsError(null);
      }
      try {
        const res = await api.get('/api/messages/contacts');
        const contacts = (res?.contacts || []) as User[];
        const suggestions = (res?.suggestions || []) as User[];
        const allUsers = (res?.all || []) as User[];

        // Combine contacts (friends/recent chats) and suggestions
        const seenIds = new Set(contacts.map(c => c.id));
        const combinedList = [...contacts];

        suggestions.forEach(u => {
          if (!seenIds.has(u.id)) {
            combinedList.push(u);
            seenIds.add(u.id);
          }
        });

        // Preserve selected friend if already selected
        setSelectedFriend(current => {
          if (current) {
            const updated = combinedList.find(u => u.id === current.id);
            return updated || current;
          }
          if (initialTargetUserId) {
            const target = allUsers.find(u => u.id === initialTargetUserId);
            if (target) {
              if (!seenIds.has(target.id)) {
                combinedList.unshift(target);
                seenIds.add(target.id);
              }
              return target;
            }
          }
          return null;
        });

        setFriends(combinedList);
        setContactsError(null);
      } catch (err: any) {
        if (friends.length === 0) {
          setContactsError('Failed to load contacts. Please check your connection.');
        }
      } finally {
        contactsInFlightRef.current = false;
        setContactsLoading(false);
      }
    };

    fetchContactsRef.current = () => fetchContacts(true);
    fetchContacts();

    // Refresh the contact list every 8s (was every 2s) and only while the tab
    // is visible, instead of unconditionally hammering the API.
    let interval: ReturnType<typeof setInterval> | null = null;
    const startPolling = () => {
      if (interval) return;
      interval = setInterval(() => fetchContacts(false), 8000);
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
        fetchContacts(false);
        startPolling();
      }
    };

    if (!document.hidden) startPolling();
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      stopPolling();
    };
  }, [initialTargetUserId]);

  // Synchronize selected friend with initialTargetUserId changes
  useEffect(() => {
    if (!initialTargetUserId) {
      setSelectedFriend(null);
    } else {
      const loadTargetUser = async () => {
        try {
          const res = await api.get('/api/messages/contacts');
          const allUsers = (res?.all || []) as User[];
          const target = allUsers.find(u => u.id === initialTargetUserId);
          if (target) {
            setSelectedFriend(target);
          }
        } catch (_) {}
      };
      loadTargetUser();
    }
  }, [initialTargetUserId]);

  // Fetch messages and typing status when friend changes
  useEffect(() => {
    if (!selectedFriend) {
      setMessages([]);
      setMessagesLoading(false);
      setMessagesError(null);
      return;
    }

    setMessagesLoading(true);
    setMessagesError(null);
    setMessages([]); // clear stale conversation messages to avoid flashing wrong friend's chat

    const fetchMessages = async (isInitial = false) => {
      if (messagesInFlightRef.current) return;
      messagesInFlightRef.current = true;
      try {
        // Messages and typing status are independent - fetch them together
        // instead of as two sequential round-trips.
        const [res, typingRes] = await Promise.all([
          api.get(`/api/messages/${selectedFriend.id}`),
          api.get(`/api/messages/typing/${selectedFriend.id}`),
        ]);
        const newMsgs = (res?.messages || []) as Message[];
        setMessages(prev => {
          if (prev.length === newMsgs.length) {
            if (prev.length === 0) return prev;
            const lastPrev = prev[prev.length - 1];
            const lastNew = newMsgs[newMsgs.length - 1];
            if (lastPrev.id === lastNew.id && lastPrev.isRead === lastNew.isRead && lastPrev.text === lastNew.text) {
              return prev; // Same messages, skip re-render
            }
          }
          return newMsgs;
        });
        setIsFriendTyping(!!typingRes?.isTyping);
        setMessagesError(null);
      } catch (err: any) {
        if (isInitial) {
          setMessagesError(err?.message || 'Failed to load conversation. Please check your connection.');
        }
      } finally {
        messagesInFlightRef.current = false;
        if (isInitial) {
          setMessagesLoading(false);
        }
      }
    };

    fetchMessagesRef.current = fetchMessages;
    fetchMessages(true);

    // Poll for chat updates + typing status every 4s and pause while the tab is hidden
    let interval: ReturnType<typeof setInterval> | null = null;
    const startPolling = () => {
      if (interval) return;
      interval = setInterval(() => fetchMessages(false), 4000);
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
        fetchMessages(false);
        startPolling();
      }
    };

    if (!document.hidden) startPolling();
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      stopPolling();
    };
  }, [selectedFriend?.id]);

  const handleRetryMessages = () => {
    if (!selectedFriend) return;
    setMessagesLoading(true);
    setMessagesError(null);
    fetchMessagesRef.current?.(true);
  };

  // Scroll to bottom on message updates
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    // Depend on the message count (not the array identity) so the smooth
    // scroll only runs when a message is actually added/removed rather than
    // on every background poll.
  }, [messages.length, typing]);

  // Simulated Voice Note recording
  const handleToggleVoiceRecord = () => {
    if (isRecording) {
      clearInterval(voiceTimerRef.current!);
      setIsRecording(false);
      // Send simulated voice clip
      handleSendMessage(`usr-voice-${Date.now()}`, 'voice');
      setVoiceSeconds(0);
    } else {
      setIsRecording(true);
      setVoiceSeconds(0);
      voiceTimerRef.current = setInterval(() => {
        setVoiceSeconds(prev => prev + 1);
      }, 1000);
    }
  };

  // Video/Voice Call Controller
  const handleLaunchCall = (type: 'voice' | 'video') => {
    setActiveCall({ type, status: 'calling' });
    setCallTimer(0);
    
    if (ringTimeoutRef.current) clearTimeout(ringTimeoutRef.current);
    // Simulate ring connecting after 3 seconds
    ringTimeoutRef.current = setTimeout(() => {
      setActiveCall({ type, status: 'connected' });
      callTimerRef.current = setInterval(() => {
        setCallTimer(prev => prev + 1);
      }, 1000);
    }, 3000);
  };

  const handleEndCall = () => {
    if (ringTimeoutRef.current) clearTimeout(ringTimeoutRef.current);
    if (callTimerRef.current) clearInterval(callTimerRef.current);
    setActiveCall(null);
    setCallTimer(0);
  };

  // Send message API
  const handleSendMessage = async (textToSend?: string, type?: 'image' | 'video' | 'voice' | 'document') => {
    if (!selectedFriend) return;
    const finalVal = textToSend || messageText;
    if (!finalVal.trim() && !gifUrl) return;
    if (sendInFlightRef.current) return;
    sendInFlightRef.current = true;

    try {
      const payload: any = {
        receiverId: selectedFriend.id,
      };

      if (type === 'voice') {
        payload.mediaUrl = 'https://codesandbox.io/assets/sample-voice-clip.mp3';
        payload.mediaType = 'voice';
        payload.text = `Simulated Voice Clip (${voiceSeconds}s)`;
      } else if (gifUrl) {
        payload.gif = gifUrl;
        payload.text = 'Sent a GIF';
      } else {
        payload.text = finalVal;
      }

      const res = await api.post('/api/messages', payload);
      if (res && res.message) {
        setMessages(prev => [...prev, res.message]);

        // Immediately update lastMessage on selected friend and re-sort friends
        setFriends(prevFriends => {
          return prevFriends.map(f => {
            if (f.id === selectedFriend.id) {
              return {
                ...f,
                lastMessage: res.message
              };
            }
            return f;
          });
        });
      }
      
      // Reset inputs & typing
      setMessageText('');
      setGifUrl('');
      api.post('/api/messages/typing', { receiverId: selectedFriend.id, isTyping: false }).catch(() => {});

    } catch (_) {
    } finally {
      sendInFlightRef.current = false;
    }
  };

  // Unsend message
  const handleUnsend = async (id: string) => {
    try {
      const res = await api.delete(`/api/messages/${id}`);
      setMessages(prev => prev.map(m => m.id === id ? res.message : m));
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Sort friends so that recent chats with latest messages are always at the top
  const sortedFriends = [...friends].sort((a, b) => {
    const timeA = (a as any).lastMessage ? new Date((a as any).lastMessage.createdAt).getTime() : 0;
    const timeB = (b as any).lastMessage ? new Date((b as any).lastMessage.createdAt).getTime() : 0;
    if (timeA !== timeB) return timeB - timeA;
    const aOnline = isUserOnline(a.lastActiveAt);
    const bOnline = isUserOnline(b.lastActiveAt);
    if (aOnline && !bOnline) return -1;
    if (!aOnline && bOnline) return 1;
    return a.username.localeCompare(b.username);
  });

  const filteredFriends = sortedFriends.filter(f =>
    f.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex h-[calc(100vh-3.5rem)] w-full overflow-hidden border-t border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-950 transition-colors duration-200">
      
      {/* LEFT COLUMN: CONVERSATION LIST */}
      <div className={`w-full md:w-80 shrink-0 flex-col border-r border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-950 ${selectedFriend ? 'hidden md:flex' : 'flex'}`}>
        
        {/* Header: messenger wordmark + actions */}
        <div className="flex items-center justify-between px-3 pt-4 pb-2">
          <h1 className="text-2xl font-black tracking-tight text-gray-950 dark:text-white capitalize font-sans">
            messenger
          </h1>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => onNavigate('feed')}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 transition cursor-pointer"
              title="Home"
            >
              <Home className="h-4 w-4" />
            </button>
            <button
              onClick={() => {
                const firstUser = friends.find(f => f.id !== currentUser.id);
                if (firstUser) setSelectedFriend(firstUser);
              }}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 transition cursor-pointer"
              title="New Message"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Search bar */}
        <div className="px-3 mb-3">
          <div className="relative flex items-center">
            <div className="pointer-events-none absolute left-3 text-gray-400 dark:text-gray-500">
              <Search className="h-4 w-4" />
            </div>
            <input
              type="text"
              placeholder="Ask Meta AI or search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-full bg-gray-100 dark:bg-gray-905 py-2 pl-9 pr-4 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:bg-gray-200/50 dark:focus:bg-gray-900 focus:outline-hidden transition-all duration-150"
            />
          </div>
        </div>

        {/* Horizontal Active Friends List with Stories & Status Notes */}
        <div className="px-3 pb-3 border-b border-gray-100 dark:border-gray-800/60 mb-2">
          <div className="flex gap-4 overflow-x-auto py-2 px-1 scrollbar-none">
            
            {/* Create Story item for Current User */}
            <div
              onClick={() => onNavigate('feed')}
              className="flex flex-col items-center gap-1.5 cursor-pointer shrink-0 w-14 text-center group"
            >
              <div className="relative">
                <img loading="lazy"
                  src={currentUser.profilePic || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100'}
                  alt="Create story"
                  referrerPolicy="no-referrer"
                  className="h-12 w-12 rounded-full object-cover border border-gray-200 dark:border-gray-800 p-0.5 group-hover:scale-105 transition duration-150"
                />
                <div className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-blue-500 text-white border-2 border-white dark:border-gray-950 font-black text-xs shadow-sm">
                  +
                </div>
              </div>
              <span className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 leading-tight">
                Create story
              </span>
            </div>

            {/* Friends with Status Notes & Active Indicators */}
            {friends.map(f => {
              const online = isUserOnline(f.lastActiveAt);
              const isSelected = selectedFriend?.id === f.id;
              const statusNote = (f as any).statusNote;
              
              return (
                <div
                  key={f.id}
                  onClick={() => setSelectedFriend(f)}
                  className="flex flex-col items-center gap-1.5 cursor-pointer shrink-0 w-14 text-center relative group"
                >
                  <div className="relative">
                    {/* Status bubble */}
                    {statusNote && (
                      <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-gray-900/95 text-white dark:bg-white dark:text-black text-[8px] font-black py-0.5 px-1.5 rounded-xl shadow-md max-w-[56px] truncate whitespace-nowrap z-10 border border-white/10 dark:border-black/5 leading-none">
                        {statusNote}
                      </div>
                    )}
                    
                    <img loading="lazy"
                      src={f.profilePic || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100'}
                      alt={f.username}
                      referrerPolicy="no-referrer"
                      className={`h-12 w-12 rounded-full object-cover border-2 transition duration-150 group-hover:scale-105 ${
                        isSelected 
                          ? 'border-blue-500' 
                          : online ? 'border-green-500' : 'border-gray-200 dark:border-gray-800'
                      }`}
                    />
                    {online && (
                      <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-green-500 border-2 border-white dark:border-gray-950" />
                    )}
                  </div>
                  <span className="text-[10px] font-bold text-gray-700 dark:text-gray-300 truncate w-full leading-tight">
                    {f.username.split(' ')[0]}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Dynamic Chats List (Vertical) */}
        <div className="flex-1 overflow-y-auto space-y-0.5 px-2">
          {contactsLoading ? (
            <div className="space-y-2 p-2 animate-in fade-in duration-150">
              {[1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} className="flex items-center gap-3 p-2 rounded-xl animate-pulse">
                  <div className="h-11 w-11 rounded-full bg-gray-200 dark:bg-gray-800 shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 bg-gray-200 dark:bg-gray-800 rounded-sm w-28" />
                    <div className="h-2.5 bg-gray-100 dark:bg-gray-850 rounded-sm w-40" />
                  </div>
                </div>
              ))}
            </div>
          ) : contactsError ? (
            <div className="py-8 px-4 text-center">
              <p className="text-xs text-red-500 mb-2 font-medium">{contactsError}</p>
              <button
                onClick={() => fetchContactsRef.current?.()}
                className="px-3 py-1.5 rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400 text-xs font-bold hover:bg-blue-100 transition cursor-pointer"
              >
                Retry Contacts
              </button>
            </div>
          ) : filteredFriends.length === 0 ? (
            <div className="py-8 text-center text-xs text-gray-500">
              No matching chats found
            </div>
          ) : (
            filteredFriends.map(f => {
              const isSelected = selectedFriend?.id === f.id;
              const online = isUserOnline(f.lastActiveAt);
              const unreadCount = (f as any).unreadCount || 0;
              const lastMsg = (f as any).lastMessage;

              let lastMsgText = "No messages yet";
              if (lastMsg) {
                if (lastMsg.mediaType === 'voice') {
                  lastMsgText = lastMsg.senderId === currentUser.id ? "You sent a voice clip." : "Sent a voice clip.";
                } else if (lastMsg.mediaType === 'image') {
                  lastMsgText = lastMsg.senderId === currentUser.id ? "You sent a photo." : "Sent a photo.";
                } else if (lastMsg.gif) {
                  lastMsgText = lastMsg.senderId === currentUser.id ? "You sent a GIF." : "Sent a GIF.";
                } else {
                  lastMsgText = lastMsg.senderId === currentUser.id ? `You: ${lastMsg.text}` : lastMsg.text;
                }
              }

              const timeStr = lastMsg ? formatMessageTime(lastMsg.createdAt) : '';

              return (
                <div
                  key={f.id}
                  onClick={() => setSelectedFriend(f)}
                  className={`flex cursor-pointer items-center gap-3 rounded-xl p-3.5 transition-all duration-150 relative ${
                    isSelected
                      ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-900 dark:text-blue-300'
                      : 'hover:bg-gray-100 dark:hover:bg-gray-900'
                  }`}
                >
                  {/* Profile Picture with online status badge */}
                  <div className="relative shrink-0">
                    <img loading="lazy"
                      src={f.profilePic || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'}
                      alt={f.username}
                      referrerPolicy="no-referrer"
                      className={`h-12 w-12 rounded-full object-cover border-2 transition duration-150 group-hover:scale-105 ${
                        online ? 'border-green-500' : 'border-gray-200 dark:border-gray-800'
                      }`}
                    />
                    <span className={`absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-white dark:border-gray-950 ${
                      online ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
                    }`} />
                  </div>
                  
                  {/* Info Column */}
                  <div className="flex flex-1 flex-col min-w-0 text-left">
                    <div className="flex items-center justify-between">
                      <span className={`text-sm truncate text-gray-900 dark:text-gray-100 ${
                        unreadCount > 0 ? 'font-black' : 'font-bold'
                      }`}>
                        {f.username}
                      </span>
                      {timeStr && (
                        <span className={`text-[10px] shrink-0 ml-2 ${
                          unreadCount > 0 ? 'text-blue-600 dark:text-blue-400 font-bold' : 'text-gray-400 dark:text-gray-500'
                        }`}>
                          {timeStr}
                        </span>
                      )}
                    </div>
                    
                    {/* Status Indicator, Last Active Time, and Last message row */}
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 flex items-center gap-1 shrink-0">
                        <span className={`inline-block h-1.5 w-1.5 rounded-full ${online ? 'bg-green-500' : 'bg-gray-400'}`} />
                        <span>{online ? 'Active now' : formatLastSeen(f.lastActiveAt)}</span>
                      </span>
                      <span className="text-[10px] text-gray-300 dark:text-gray-700 select-none shrink-0">•</span>
                      <span className={`text-xs truncate max-w-[120px] ${
                        unreadCount > 0 
                          ? 'text-gray-900 dark:text-gray-100 font-bold' 
                          : 'text-gray-500 dark:text-gray-400'
                      }`}>
                        {lastMsgText}
                      </span>
                    </div>
                  </div>

                  {unreadCount > 0 && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex h-5 w-5 items-center justify-center rounded-full bg-blue-500 px-1 text-[10px] font-bold text-white shadow-xs">
                      {unreadCount}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* RIGHT COLUMN: ACTIVE CHAT VIEW */}
      <div className={`flex-1 flex-col bg-white dark:bg-gray-900 ${selectedFriend ? 'flex' : 'hidden md:flex'}`}>
        {activeFriend ? (
          <>
            {/* Chat header */}
            <div className="flex h-14 items-center justify-between border-b border-gray-100 px-4 dark:border-gray-800 shrink-0">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSelectedFriend(null)}
                  className="md:hidden rounded-full p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-850 cursor-pointer active:scale-95 transition"
                  title="Back to Chats"
                >
                  <ArrowLeft className="h-5 w-5 text-gray-700 dark:text-gray-300" />
                </button>

                <div
                  onClick={() => onNavigate('profile', activeFriend.id)}
                  className="flex cursor-pointer items-center gap-2.5"
                >
                  <div className="relative">
                    <img loading="lazy"
                      src={activeFriend.profilePic || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'}
                      alt={activeFriend.username}
                      referrerPolicy="no-referrer"
                      className="h-9 w-9 rounded-full object-cover"
                    />
                    <div className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white dark:border-gray-900 transition-colors duration-200 ${
                      activeFriendOnline ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
                    }`} />
                  </div>
                  <div className="flex flex-col text-left">
                    <span className="text-xs font-bold text-gray-900 dark:text-gray-100 leading-none">
                      {activeFriend.username}
                    </span>
                    <span className={`text-[10px] font-semibold mt-1 transition-colors duration-200 ${
                      activeFriendOnline ? 'text-green-500' : 'text-gray-400 dark:text-gray-500'
                    }`}>
                      {activeFriendOnline ? 'Online' : activeFriendLastSeen}
                    </span>
                  </div>
                </div>
              </div>

              {/* Header icons */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleLaunchCall('voice')}
                  className="rounded-full p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/20 cursor-pointer"
                  title="Voice Call"
                >
                  <Phone className="h-4.5 w-4.5" />
                </button>
                <button
                  onClick={() => handleLaunchCall('video')}
                  className="rounded-full p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/20 cursor-pointer"
                  title="Video Call"
                >
                  <Video className="h-4.5 w-4.5" />
                </button>
                <button
                  onClick={() => {
                    const block = confirm(`Block ${activeFriend.username}?`);
                    if (block) alert('User blocked.');
                  }}
                  className="rounded-full p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer"
                  title="Chat info"
                >
                  <MoreVertical className="h-4.5 w-4.5" />
                </button>
              </div>
            </div>

            {/* Message logs panel */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3.5 scrollbar-thin">
              {messagesLoading ? (
                <div className="flex flex-col justify-end h-full space-y-4 p-2 animate-in fade-in duration-200">
                  {/* Floating top loading pill */}
                  <div className="flex items-center justify-center mb-auto pt-2">
                    <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 text-xs font-medium shadow-xs">
                      <div className="h-3 w-3 rounded-full border-2 border-blue-600 dark:border-blue-400 border-t-transparent animate-spin" />
                      <span>Loading messages...</span>
                    </div>
                  </div>

                  {/* Message skeleton bubbles */}
                  <div className="flex items-end gap-2 max-w-[65%]">
                    <div className="h-7 w-7 rounded-full bg-gray-200 dark:bg-gray-800 animate-pulse shrink-0" />
                    <div className="space-y-1.5 w-48">
                      <div className="h-8 rounded-2xl rounded-bl-sm bg-gray-200 dark:bg-gray-800 animate-pulse w-full" />
                    </div>
                  </div>

                  <div className="flex items-end gap-2 max-w-[65%] ml-auto flex-row-reverse">
                    <div className="space-y-1.5 w-40">
                      <div className="h-8 rounded-2xl rounded-br-sm bg-blue-200/70 dark:bg-blue-900/40 animate-pulse w-full" />
                    </div>
                  </div>

                  <div className="flex items-end gap-2 max-w-[65%]">
                    <div className="h-7 w-7 rounded-full bg-gray-200 dark:bg-gray-800 animate-pulse shrink-0" />
                    <div className="space-y-1.5 w-60">
                      <div className="h-12 rounded-2xl rounded-bl-sm bg-gray-200 dark:bg-gray-800 animate-pulse w-full" />
                    </div>
                  </div>

                  <div className="flex items-end gap-2 max-w-[65%] ml-auto flex-row-reverse">
                    <div className="space-y-1.5 w-52">
                      <div className="h-9 rounded-2xl rounded-br-sm bg-blue-200/70 dark:bg-blue-900/40 animate-pulse w-full" />
                    </div>
                  </div>
                </div>
              ) : messagesError ? (
                <div className="flex h-full flex-col items-center justify-center text-center p-8 text-gray-500 animate-in fade-in duration-200">
                  <div className="h-12 w-12 rounded-full bg-red-50 dark:bg-red-950/40 text-red-500 flex items-center justify-center mb-3">
                    <ShieldAlert className="h-6 w-6" />
                  </div>
                  <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">Unable to load messages</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-xs leading-relaxed">
                    {messagesError}
                  </p>
                  <button
                    onClick={handleRetryMessages}
                    className="mt-4 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition shadow-xs cursor-pointer active:scale-95 flex items-center gap-2"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    <span>Try Again</span>
                  </button>
                </div>
              ) : messages.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center text-center p-8 text-gray-500">
                  <img loading="lazy"
                    src={activeFriend.profilePic || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'}
                    alt={activeFriend.username}
                    referrerPolicy="no-referrer"
                    className="h-20 w-20 rounded-full object-cover mb-3"
                  />
                  <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">{activeFriend.username}</h3>
                  <p className="text-xs mt-1">This is the start of your encrypted conversation stream.</p>
                </div>
              ) : (
                messages.filter(Boolean).map(m => {
                  const isMe = m.senderId === currentUser.id;
                  const isUnsent = m.text === 'This message was unsent';
                  
                  return (
                    <div
                      key={m.id}
                      className={`flex items-end gap-2 max-w-[75%] sm:max-w-[65%] group ${
                        isMe ? 'ml-auto flex-row-reverse' : ''
                      }`}
                    >
                      {!isMe && (
                        <img loading="lazy"
                          src={activeFriend.profilePic || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'}
                          alt={activeFriend.username}
                          referrerPolicy="no-referrer"
                          className="h-7 w-7 rounded-full object-cover shrink-0"
                        />
                      )}

                      <div className={`min-w-0 space-y-1 ${isMe ? 'flex flex-col items-end' : ''}`}>
                        <div
                          className={`relative max-w-full break-words px-3.5 py-2.5 text-[13px] leading-relaxed flex items-center gap-1.5 shadow-sm ${
                            isMe
                              ? isUnsent
                                ? 'rounded-2xl rounded-br-sm bg-gray-100 border border-gray-200 text-gray-400 dark:bg-gray-800 dark:border-gray-700'
                                : 'rounded-2xl rounded-br-sm bg-gradient-to-br from-[#1877F2] to-[#0f65da] text-white'
                              : isUnsent
                              ? 'rounded-2xl rounded-bl-sm bg-gray-100 border border-gray-200 text-gray-400 dark:bg-gray-800 dark:border-gray-700'
                              : 'rounded-2xl rounded-bl-sm bg-gray-100 border border-gray-200/70 text-gray-900 dark:bg-gray-800 dark:border-gray-700/60 dark:text-gray-100'
                          }`}
                        >
                          {/* Render normal text / voice note clip / GIF image */}
                          {m.mediaType === 'voice' ? (
                            <div className="flex items-center gap-2 text-xs">
                              <Play className="h-4.5 w-4.5 fill-current" />
                              <div className="h-3.5 w-24 bg-white/20 dark:bg-gray-700 rounded-sm overflow-hidden relative flex items-center">
                                <div className="h-1 w-full bg-white/30 dark:bg-gray-600 rounded-sm" />
                                <div className="absolute top-0 bottom-0 left-0 bg-white dark:bg-blue-500 w-[40%]" />
                              </div>
                              <span className="text-[10px] font-bold">Simulated voice</span>
                            </div>
                          ) : m.gif ? (
                            <img loading="lazy" decoding="async" src={m.gif} alt="Giphy" referrerPolicy="no-referrer" className="max-w-44 rounded-lg" />
                          ) : (
                            <span className={isUnsent ? 'italic' : ''}>{m.text}</span>
                          )}

                          {/* Quick Unsend button for sent messages */}
                          {isMe && !isUnsent && (
                            <button
                              onClick={() => handleUnsend(m.id)}
                              className="absolute top-1/2 -translate-y-1/2 -left-8 rounded-full p-1 text-gray-400 bg-white dark:bg-gray-950 border opacity-0 group-hover:opacity-100 hover:text-red-500 hover:bg-red-50 transition cursor-pointer"
                              title="Unsend"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          )}
                        </div>

                        {/* Status detail receipt with exact Seen Time and Sent Time */}
                        <div className={`flex items-center gap-1.5 px-1 ${isMe ? 'justify-end' : 'justify-start'}`}>
                          <span className="text-[9px] text-gray-400 dark:text-gray-500 select-none">
                            {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          {isMe && (
                            <div className="flex items-center gap-1">
                              <CheckCheck className={`h-3 w-3 transition-colors duration-200 ${m.isRead ? 'text-blue-500' : 'text-gray-400'}`} />
                              <span className={`text-[9px] font-semibold transition-colors duration-200 ${m.isRead ? 'text-blue-500 dark:text-blue-400 animate-fade-in' : 'text-gray-400 dark:text-gray-500'}`}>
                                {m.isRead ? (
                                  m.seenAt ? `Seen ${new Date(m.seenAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Seen'
                                ) : (
                                  'Delivered'
                                )}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}

              {/* Real-time Friend Typing Indicator */}
              {(isFriendTyping || typing) && (
                <div className="flex items-center gap-2 max-w-[70%]">
                  <img loading="lazy"
                    src={activeFriend.profilePic || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'}
                    alt={activeFriend.username}
                    referrerPolicy="no-referrer"
                    className="h-7 w-7 rounded-full object-cover"
                  />
                  <div className="rounded-2xl bg-gray-100 px-3.5 py-2 text-xs text-gray-500 dark:bg-gray-800 dark:text-gray-400 flex items-center gap-1 font-bold">
                    <span>{activeFriend.username.split(' ')[0]} is typing</span>
                    <span className="animate-bounce">.</span>
                    <span className="animate-bounce [animation-delay:0.2s]">.</span>
                    <span className="animate-bounce [animation-delay:0.4s]">.</span>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Chat inputs footer bar */}
            <div className="border-t border-gray-100 p-3 dark:border-gray-800 shrink-0 flex items-center gap-2">
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  const url = prompt('Enter a direct Image or GIF link (or cancel):');
                  if (url) {
                    setGifUrl(url);
                    alert('GIF attached! Press send to submit.');
                  }
                }}
                className="rounded-full p-2 hover:bg-gray-100 text-blue-500 dark:hover:bg-gray-800 cursor-pointer"
                title="Send Gif"
              >
                <Smile className="h-5 w-5" />
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  handleToggleVoiceRecord();
                }}
                className={`rounded-full p-2 cursor-pointer transition ${
                  isRecording ? 'bg-red-500 text-white animate-pulse' : 'hover:bg-gray-100 text-red-500 dark:hover:bg-gray-800'
                }`}
                title="Send Voice note"
              >
                <Mic className="h-5 w-5" />
              </button>

              <input
                type="text"
                placeholder={isRecording ? `Recording... click microphone to send (${voiceSeconds}s)` : "Type a message..."}
                disabled={isRecording}
                value={messageText}
                onChange={(e) => {
                  const val = e.target.value;
                  setMessageText(val);

                  if (selectedFriend) {
                    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
                    api.post('/api/messages/typing', { receiverId: selectedFriend.id, isTyping: true }).catch(() => {});
                    typingTimeoutRef.current = setTimeout(() => {
                      api.post('/api/messages/typing', { receiverId: selectedFriend.id, isTyping: false }).catch(() => {});
                    }, 2500);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                className="flex-1 rounded-full border border-gray-200 bg-gray-50 px-4 py-2 text-xs focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-blue-500 dark:border-gray-800 dark:bg-gray-950 dark:text-white"
              />

              {messageText.trim() || gifUrl ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    handleSendMessage();
                  }}
                  className="rounded-full bg-[#1877F2] p-2 text-white hover:bg-blue-600 transition active:scale-95 cursor-pointer"
                >
                  <Send className="h-4 w-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    handleSendMessage('👍');
                  }}
                  className="rounded-full p-2 hover:bg-gray-100 text-[#1877F2] dark:hover:bg-gray-800 cursor-pointer"
                  title="Thumbs Up"
                >
                  <ThumbsUp className="h-5 w-5 fill-current" />
                </button>
              )}
            </div>
          </>
        ) : (
          <div className="flex h-full flex-col items-center justify-center p-8 text-center text-gray-500">
            <MessageSquare className="h-16 w-16 text-gray-300 dark:text-gray-700 mb-3" />
            <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200">No chat selected</h3>
            <p className="text-xs mt-1">Select an active friend from the left sidebar panel to begin conversation.</p>
          </div>
        )}
      </div>

      {/* CALLRING SCREEN VIEW PORTAL (Voice/Video Call overlay) */}
      {activeCall && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/95 p-4 text-white animate-in fade-in duration-200">
          <div className="flex w-full max-w-sm flex-col items-center justify-between rounded-2xl bg-gray-900 p-8 h-96 border border-gray-850 shadow-2xl">
            {/* Top Info */}
            <div className="text-center space-y-1">
              <span className="text-[10px] uppercase font-extrabold tracking-wider text-blue-400">
                {activeCall.type === 'video' ? 'Messenger Video Call' : 'Messenger Audio Call'}
              </span>
              <h3 className="text-xl font-bold mt-2">
                {selectedFriend?.username || 'Active Companion'}
              </h3>
              <p className="text-xs text-gray-400 leading-tight">
                {activeCall.status === 'calling' ? 'Ringing...' : `Connected • ${Math.floor(callTimer / 60)}:${(callTimer % 60).toString().padStart(2, '0')}`}
              </p>
            </div>

            {/* Simulated Live Stage (Mock camera viewport or audio ripples) */}
            {activeCall.type === 'video' && activeCall.status === 'connected' ? (
              <div className="h-36 w-full rounded-xl overflow-hidden bg-black relative border">
                {/* Secondary profile */}
                <img loading="lazy"
                  src={selectedFriend?.profilePic || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'}
                  alt="Caller Profile"
                  className="h-full w-full object-cover"
                />
                <div className="absolute top-2 right-2 h-14 w-11 rounded-lg overflow-hidden bg-gray-850 border border-white/20">
                  <img loading="lazy"
                    src={currentUser.profilePic}
                    alt="Self camera"
                    className="h-full w-full object-cover"
                  />
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-28 w-28 rounded-full bg-blue-500/10 ring-8 ring-blue-500/5 animate-pulse">
                <img loading="lazy"
                  src={selectedFriend?.profilePic || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'}
                  alt="Caller Avatar"
                  className="h-20 w-20 rounded-full object-cover ring-4 ring-blue-500"
                />
              </div>
            )}

            {/* Bottom Actions Row */}
            <div className="flex items-center gap-6">
              <button
                className="rounded-full bg-gray-800 p-3 hover:bg-gray-700 transition"
                title="Mute Volume"
              >
                <Volume2 className="h-5 w-5 text-gray-300" />
              </button>
              
              <button
                onClick={handleEndCall}
                className="rounded-full bg-red-600 p-3.5 hover:bg-red-700 transition active:scale-95 cursor-pointer"
                title="Hang up"
              >
                <PhoneOff className="h-6 w-6 text-white" />
              </button>

              <button
                className="rounded-full bg-gray-800 p-3 hover:bg-gray-700 transition"
                title="Maximize Grid"
              >
                <Maximize2 className="h-5 w-5 text-gray-300" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
