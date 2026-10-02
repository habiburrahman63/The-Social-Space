/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { User, Notification } from '../types';
import { api } from '../utils/api';
import { isUserOnline, formatLastSeen } from '../utils/presence';
import { UserCheck, UserPlus, Users, Shield, UserMinus } from 'lucide-react';
import { showToast } from '../utils/toast';

interface FriendsProps {
  currentUser: User;
  onNavigate: (view: string, targetId?: string) => void;
  onRefreshUser: () => void;
}

export default function Friends({ currentUser, onNavigate, onRefreshUser }: FriendsProps) {
  const [suggestions, setSuggestions] = useState<User[]>([]);
  const [friends, setFriends] = useState<User[]>([]);
  const [requests, setRequests] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [requestedUserIds, setRequestedUserIds] = useState<string[]>([]);

  const fetchInFlightRef = useRef(false);

  const fetchFriendsData = async (showLoading = false) => {
    // Skip while a previous refresh is still in flight (slow or cold backend)
    // so requests can't pile up on top of each other.
    if (fetchInFlightRef.current) return;
    fetchInFlightRef.current = true;
    try {
      if (showLoading) setLoading(true);
      // These three endpoints are independent - fetch them in parallel instead
      // of as three sequential round-trips.
      const [sugRes, friendsRes, reqsRes] = await Promise.all([
        api.get('/api/friends/suggestions'),
        api.get('/api/friends/list'),
        api.get('/api/friends/requests'),
      ]);
      const suggestionsList = (sugRes.suggestions || []) as User[];
      suggestionsList.sort((a, b) => {
        const aOnline = isUserOnline(a.lastActiveAt);
        const bOnline = isUserOnline(b.lastActiveAt);
        if (aOnline && !bOnline) return -1;
        if (!aOnline && bOnline) return 1;
        return a.username.localeCompare(b.username);
      });
      setSuggestions(suggestionsList);

      const friendsList = (friendsRes.friends || []) as User[];
      friendsList.sort((a, b) => {
        const aOnline = isUserOnline(a.lastActiveAt);
        const bOnline = isUserOnline(b.lastActiveAt);
        if (aOnline && !bOnline) return -1;
        if (!aOnline && bOnline) return 1;
        return a.username.localeCompare(b.username);
      });
      setFriends(friendsList);

      const receivedReqs = (reqsRes.received || []) as Notification[];
      const sentReqs = (reqsRes.sent || []) as Notification[];
      
      setRequests(receivedReqs);
      setRequestedUserIds(sentReqs.map(s => s.recipientId));
    } catch (_) {
    } finally {
      fetchInFlightRef.current = false;
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    fetchFriendsData(true);

    const handleFriendsUpdated = () => {
      fetchFriendsData(false);
    };

    window.addEventListener('friends-updated', handleFriendsUpdated);

    // Refresh every 10s (was every 3s) and only while the tab is visible - a
    // large reduction in background traffic with no visible change for the user.
    let interval: ReturnType<typeof setInterval> | null = null;
    const startPolling = () => {
      if (interval) return;
      interval = setInterval(() => fetchFriendsData(false), 10000);
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
        fetchFriendsData(false);
        startPolling();
      }
    };

    if (!document.hidden) startPolling();
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('friends-updated', handleFriendsUpdated);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      stopPolling();
    };
  }, [currentUser?.id]);

  // Send request
  const handleAddFriend = async (id: string, username: string) => {
    try {
      const res = await api.post(`/api/friends/request/${id}`);
      setRequestedUserIds(prev => Array.from(new Set([...prev, id])));
      showToast(res.message || `Friend request sent to ${username}! 📨`, { type: 'success' });
      window.dispatchEvent(new CustomEvent('friends-updated'));
      window.dispatchEvent(new CustomEvent('notifications-updated'));
      onRefreshUser();
      fetchFriendsData();
    } catch (err: any) {
      showToast(err.message || 'Failed to send friend request', { type: 'error' });
    }
  };

  // Cancel request
  const handleCancelRequest = async (id: string, username: string) => {
    try {
      await api.post(`/api/friends/cancel/${id}`);
      setRequestedUserIds(prev => prev.filter(userId => userId !== id));
      showToast(`Friend request to ${username} cancelled.`, { type: 'info' });
      window.dispatchEvent(new CustomEvent('friends-updated'));
      window.dispatchEvent(new CustomEvent('notifications-updated'));
      fetchFriendsData();
    } catch (err: any) {
      showToast(err.message || 'Failed to cancel friend request', { type: 'error' });
    }
  };

  // Accept request
  const handleAccept = async (req: Notification) => {
    try {
      await api.post(`/api/friends/accept/${req.senderId}`);
      showToast(`You are now friends with ${req.senderName}! 🤝`, { type: 'success' });
      window.dispatchEvent(new CustomEvent('friends-updated'));
      window.dispatchEvent(new CustomEvent('notifications-updated'));
      onRefreshUser();
      fetchFriendsData();
    } catch (err: any) {
      showToast(err.message || 'Failed to accept friend request', { type: 'error' });
    }
  };

  // Decline request
  const handleDecline = async (req: Notification) => {
    try {
      await api.post(`/api/friends/reject/${req.senderId}`);
      showToast(`Declined friend request from ${req.senderName}.`, { type: 'info' });
      window.dispatchEvent(new CustomEvent('friends-updated'));
      window.dispatchEvent(new CustomEvent('notifications-updated'));
      fetchFriendsData();
    } catch (err: any) {
      showToast(err.message || 'Failed to decline friend request', { type: 'error' });
    }
  };

  // Unfriend
  const handleUnfriend = async (id: string) => {
    if (!confirm('Are you sure you want to remove this friend?')) return;
    try {
      await api.post(`/api/friends/unfriend/${id}`);
      showToast('Friend removed from your friends list.', { type: 'info' });
      window.dispatchEvent(new CustomEvent('friends-updated'));
      window.dispatchEvent(new CustomEvent('notifications-updated'));
      onRefreshUser();
      fetchFriendsData();
    } catch (err: any) {
      showToast(err.message || 'Failed to remove friend', { type: 'error' });
    }
  };

  if (loading) {
    return (
      <div className="flex-1 p-8 text-center text-sm font-semibold animate-pulse">
        Loading Friends Ecosystem...
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6 md:px-6 max-w-4xl mx-auto space-y-6 bg-gray-50/30 dark:bg-gray-950 transition-colors">
      
      {/* Pending Requests Banner Section */}
      {requests.length > 0 && (
        <div className="rounded-2xl border border-blue-100 bg-blue-50/20 p-5 dark:border-blue-900/30 dark:bg-blue-950/10 space-y-4">
          <h2 className="text-base font-black text-blue-900 dark:text-blue-400 flex items-center gap-2">
            <UserCheck className="h-5 w-5" />
            <span>Pending Friend Requests ({requests.length})</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {requests.map(req => (
              <div
                key={req.id}
                className="flex items-center justify-between rounded-xl bg-white p-3 shadow-xs border dark:bg-gray-900 dark:border-gray-800"
              >
                <div
                  onClick={() => onNavigate('profile', req.senderId)}
                  className="flex items-center gap-3 cursor-pointer"
                >
                  <img loading="lazy"
                    src={req.senderAvatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'}
                    alt={req.senderName}
                    referrerPolicy="no-referrer"
                    className="h-10 w-10 rounded-full object-cover"
                  />
                  <div>
                    <h4 className="text-xs font-bold text-gray-900 dark:text-white">
                      {req.senderName}
                    </h4>
                    <span className="text-[10px] text-gray-400">
                      Sent {new Date(req.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                <div className="flex gap-2 text-[11px] font-bold">
                  <button
                    onClick={() => handleAccept(req)}
                    className="rounded-lg bg-blue-600 px-3 py-1.5 text-white hover:bg-blue-700 cursor-pointer"
                  >
                    Confirm
                  </button>
                  <button
                    onClick={() => handleDecline(req)}
                    className="rounded-lg bg-gray-100 px-3 py-1.5 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300"
                  >
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actual Mutual Friends grid */}
      <div className="space-y-4">
        <h2 className="text-sm font-black text-gray-900 dark:text-gray-100 flex items-center gap-2 border-b pb-2">
          <Users className="h-4.5 w-4.5 text-blue-500" />
          <span>My Friends ({(currentUser.friends || []).length})</span>
        </h2>

        {(currentUser.friends || []).length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-200 p-8 text-center text-xs text-gray-400">
            No friends added yet. Check out the suggestions below to expand your loop!
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {friends.map(friend => {
              const online = isUserOnline(friend.lastActiveAt);
              return (
                <div
                  key={friend.id}
                  className="rounded-xl border border-gray-200 bg-white p-3 text-center shadow-xs dark:border-gray-800 dark:bg-gray-900 flex flex-col items-center justify-between space-y-3 relative"
                >
                  <div className="relative">
                    <img loading="lazy"
                      src={friend.profilePic || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'}
                      alt={friend.username}
                      referrerPolicy="no-referrer"
                      onClick={() => onNavigate('profile', friend.id)}
                      className="h-16 w-16 rounded-full object-cover border cursor-pointer hover:brightness-95 transition"
                    />
                    {/* Real-time online dot */}
                    <div className={`absolute bottom-0 right-1 h-3.5 w-3.5 rounded-full border-2 border-white dark:border-gray-900 ${
                      online ? 'bg-green-500 animate-pulse' : 'bg-gray-300'
                    }`} title={online ? 'Online' : 'Offline'} />
                  </div>
                <div className="min-w-0 text-center">
                  <h4
                    onClick={() => onNavigate('profile', friend.id)}
                    className="text-xs font-bold text-gray-900 dark:text-white truncate cursor-pointer hover:underline flex items-center justify-center gap-1"
                  >
                    <span>{friend.username}</span>
                    {friend.verifyBadge && <Shield className="h-3 w-3 fill-blue-500 text-white" />}
                  </h4>
                  <span className="text-[10px] text-gray-400 block truncate mt-0.5 max-w-[120px]">
                    {friend.bio || 'No bio specified'}
                  </span>
                </div>
                <button
                  onClick={() => handleUnfriend(friend.id)}
                  className="w-full flex items-center justify-center gap-1 rounded-lg border border-red-200 bg-red-50/10 py-1.5 text-[10px] font-bold text-red-600 hover:bg-red-50 dark:border-red-950/20 dark:text-red-400"
                >
                  <UserMinus className="h-3.5 w-3.5" />
                  <span>Remove</span>
                </button>
              </div>
            );
          })}
          </div>
        )}
      </div>

      {/* Suggested Friends Section */}
      <div className="space-y-4">
        <h2 className="text-sm font-black text-gray-900 dark:text-gray-100 flex items-center gap-2 border-b pb-2">
          <UserPlus className="h-4.5 w-4.5 text-blue-500" />
          <span>People You May Know</span>
        </h2>

        {suggestions.filter(u => !(currentUser.friends || []).includes(u.id)).length === 0 ? (
          <div className="py-4 text-center text-xs text-gray-400">
            You are connected with everyone! Beautiful work!
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {suggestions
              .filter(u => !(currentUser.friends || []).includes(u.id))
              .map(userSug => {
                const isRequested = requestedUserIds.includes(userSug.id);
                return (
                  <div
                    key={userSug.id}
                    className="rounded-xl border border-gray-200 bg-white p-3 text-center shadow-xs dark:border-gray-800 dark:bg-gray-900 flex flex-col items-center justify-between space-y-3"
                  >
                    <img loading="lazy"
                      src={userSug.profilePic || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'}
                      alt={userSug.username}
                      referrerPolicy="no-referrer"
                      onClick={() => onNavigate('profile', userSug.id)}
                      className="h-16 w-16 rounded-full object-cover border cursor-pointer hover:brightness-95 transition animate-in fade-in"
                    />
                    <div className="min-w-0 text-center">
                      <h4
                        onClick={() => onNavigate('profile', userSug.id)}
                        className="text-xs font-bold text-gray-900 dark:text-white truncate cursor-pointer hover:underline flex items-center justify-center gap-1"
                      >
                        <span>{userSug.username}</span>
                        {userSug.verifyBadge && <Shield className="h-3 w-3 fill-blue-500 text-white" />}
                      </h4>
                      <span className="text-[10px] text-gray-400 block truncate mt-0.5 max-w-[120px]">
                        {userSug.bio || 'No bio tagline'}
                      </span>
                    </div>

                    <button
                      onClick={() => {
                        if (isRequested) {
                          handleCancelRequest(userSug.id, userSug.username);
                        } else {
                          handleAddFriend(userSug.id, userSug.username);
                        }
                      }}
                      className={`w-full flex items-center justify-center gap-1.5 rounded-lg py-2 text-[11px] font-bold cursor-pointer transition ${
                        isRequested
                          ? 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
                          : 'bg-blue-600 text-white hover:bg-blue-700'
                      }`}
                    >
                      <UserPlus className="h-3.5 w-3.5" />
                      <span>{isRequested ? 'Cancel Request' : 'Add Friend'}</span>
                    </button>
                  </div>
                );
              })}
          </div>
        )}
      </div>

    </div>
  );
}
