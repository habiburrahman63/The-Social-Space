/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  MapPin, Briefcase, GraduationCap, Heart, Link as LinkIcon, Phone, Calendar, Mail, User as UserIcon, Shield, Edit, Camera, X, Plus, Image,
  MessageCircle, Send, Share2
} from 'lucide-react';
import { User, Post, Notification, ReactionType } from '../types';
import { api } from '../utils/api';
import PostCard from './PostCard';

interface ProfileProps {
  currentUser: User;
  profileUserId: string;
  onNavigate: (view: string, targetId?: string) => void;
  onProfileUpdated: () => void;
}

const compressImage = (base64Str: string, maxWidth: number, maxHeight: number, quality = 0.75): Promise<string> => {
  return new Promise((resolve) => {
    const img = document.createElement('img');
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }
      }

      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(base64Str);
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => {
      resolve(base64Str);
    };
    img.src = base64Str;
  });
};

export default function Profile({
  currentUser,
  profileUserId,
  onNavigate,
  onProfileUpdated,
}: ProfileProps) {
  const [user, setUser] = useState<User | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [openCommentPostId, setOpenCommentPostId] = useState<string | null>(null);
  const [hoveredReactionPostId, setHoveredReactionPostId] = useState<string | null>(null);
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});
  const [replyInputs, setReplyInputs] = useState<Record<string, string>>({});
  const [activeReplyCommentId, setActiveReplyCommentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isBlockedByMe, setIsBlockedByMe] = useState(false);
  const [hasBlockedMe, setHasBlockedMe] = useState(false);
  const [isBlockedMutual, setIsBlockedMutual] = useState(false);
  const [hasReceivedReq, setHasReceivedReq] = useState(false);
  const [hasSentReq, setHasSentReq] = useState(false);

  // Edit Profile modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [work, setWork] = useState('');
  const [education, setEducation] = useState('');
  const [city, setCity] = useState('');
  const [hometown, setHometown] = useState('');
  const [relationship, setRelationship] = useState<any>('Single');
  const [website, setWebsite] = useState('');
  const [phone, setPhone] = useState('');
  const [birthday, setBirthday] = useState('');
  const [gender, setGender] = useState<any>('Prefer not to say');
  const [profilePic, setProfilePic] = useState('');
  const [coverPhoto, setCoverPhoto] = useState('');

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const handleAvatarFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        alert('Please select an image file.');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64Url = reader.result as string;
        compressImage(base64Url, 400, 400, 0.8).then((compressedUrl) => {
          setProfilePic(compressedUrl);
          api.put('/api/auth/profile', { profilePic: compressedUrl }).then(() => {
            fetchProfileData(true);
            onProfileUpdated();
          }).catch(() => {
            alert('Failed to save profile picture. The image might be too large or there was a network issue.');
          });
        }).catch(() => {});
      };
      reader.readAsDataURL(file);
    }
    e.target.value = '';
  };

  const handleCoverFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        alert('Please select an image file.');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64Url = reader.result as string;
        compressImage(base64Url, 1200, 600, 0.8).then((compressedUrl) => {
          setCoverPhoto(compressedUrl);
          api.put('/api/auth/profile', { coverPhoto: compressedUrl }).then(() => {
            fetchProfileData(true);
            onProfileUpdated();
          }).catch(() => {
            alert('Failed to save cover photo. The image might be too large or there was a network issue.');
          });
        }).catch(() => {});
      };
      reader.readAsDataURL(file);
    }
    e.target.value = '';
  };

  // Post Creator State (for own profile)
  const [profileEditorText, setProfileEditorText] = useState('');
  const [profileEditorImage, setProfileEditorImage] = useState('');
  const profilePostFileInputRef = useRef<HTMLInputElement>(null);
  const [publishingPost, setPublishingPost] = useState(false);

  const handlePostFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        alert('Please select an image file.');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64Url = reader.result as string;
        compressImage(base64Url, 1000, 1000, 0.8).then((compressedUrl) => {
          setProfileEditorImage(compressedUrl);
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCreateProfilePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileEditorText.trim() && !profileEditorImage) {
      alert('Cannot publish empty post. Write some text or insert an image.');
      return;
    }
    try {
      setPublishingPost(true);
      const payload = {
        text: profileEditorText,
        mediaUrls: profileEditorImage ? [profileEditorImage] : [],
        mediaType: profileEditorImage ? 'image' : undefined,
        privacy: 'Public'
      };

      await api.post('/api/posts', payload);
      setProfileEditorText('');
      setProfileEditorImage('');
      
      // Refresh posts list
      if (user) {
        const postsRes = await api.get(`/api/posts?userId=${user.id}`);
        setPosts(postsRes.posts || []);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to publish post');
    } finally {
      setPublishingPost(false);
    }
  };

  const patchPost = (postId: string, patch: Partial<Post>) => {
    setPosts(prev => prev.map(p => (p.id === postId ? { ...p, ...patch } : p)));
  };

  const handleReactToPost = async (postId: string, reaction: ReactionType) => {
    try {
      const res = await api.post(`/api/posts/${postId}/react`, { type: reaction });
      if (res?.reactions) patchPost(postId, { reactions: res.reactions });
    } catch (_) {}
  };

  const handleToggleComments = (postId: string) => {
    setOpenCommentPostId(prev => (prev === postId ? null : postId));
  };

  const handleSubmitProfileComment = async (postId: string, parentCommentId?: string, text?: string) => {
    if (!text || !text.trim()) return;
    try {
      const res = await api.post(`/api/posts/${postId}/comment`, { text, parentCommentId });
      if (res?.comments) {
        patchPost(postId, {
          comments: res.comments,
          commentsCount: res.comments.length
        });
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleTogglePin = async (post: Post) => {
    try {
      const res = await api.put(`/api/posts/${post.id}`, { isPinned: !post.isPinned });
      if (res?.post) patchPost(post.id, { isPinned: res.post.isPinned });
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleToggleCommenting = async (post: Post) => {
    try {
      const res = await api.put(`/api/posts/${post.id}`, { commentsDisabled: !post.commentsDisabled });
      if (res?.post) patchPost(post.id, { commentsDisabled: res.post.commentsDisabled });
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleReportPost = async (postId: string) => {
    const reason = prompt('Please describe why you are reporting this post:');
    if (!reason || !reason.trim()) return;
    try {
      await api.post('/api/reports', { reportedId: postId, type: 'post', reason });
      alert('Post has been reported to site administrators.');
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleVotePollProfile = async (postId: string, optionIdx: number) => {
    try {
      const res = await api.post(`/api/posts/${postId}/poll/vote`, { optionIdx });
      if (res?.pollOptions) patchPost(postId, { pollOptions: res.pollOptions });
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleCopyPostLink = (id: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/post/${id}`);
    alert('Post link copied to clipboard!');
  };

  const handleDeleteProfilePost = async (id: string) => {
    if (!confirm('Are you sure you want to delete this post?')) return;
    try {
      await api.delete(`/api/posts/${id}`);
      setPosts(prev => prev.filter(p => p.id !== id));
    } catch (err: any) {
      alert(err.message);
    }
  };

  const isOwnProfile = currentUser.id === profileUserId;

  const fetchProfileData = async (silent = false) => {
    try {
      if (!silent) {
        setLoading(true);
      }
      // Parallelize profile, posts, and friend requests fetch to eliminate request waterfall
      const [userRes, postsRes, reqsRes] = await Promise.all([
        api.get(`/api/users/${profileUserId}`),
        api.get(`/api/posts?userId=${profileUserId}`),
        currentUser.id !== profileUserId ? api.get('/api/friends/requests').catch(() => null) : Promise.resolve(null),
      ]);

      const foundUser = userRes?.user as User;

      if (foundUser) {
        setUser(foundUser);
        setIsBlockedByMe(userRes.isBlockedByMe || false);
        setHasBlockedMe(userRes.hasBlockedMe || false);
        setIsBlockedMutual(userRes.isBlockedMutual || false);
        
        // Initialize form fields only if edit modal is not currently open, to avoid overwriting typed fields
        if (!showEditModal) {
          setUsername(foundUser.username);
          setBio(foundUser.bio || '');
          setWork(foundUser.work || '');
          setEducation(foundUser.education || '');
          setCity(foundUser.city || '');
          setHometown(foundUser.hometown || '');
          setRelationship(foundUser.relationship || 'Single');
          setWebsite(foundUser.website || '');
          setPhone(foundUser.phone || '');
          setBirthday(foundUser.birthday || '');
          setGender(foundUser.gender || 'Prefer not to say');
          setProfilePic(foundUser.profilePic || '');
          setCoverPhoto(foundUser.coverPhoto || '');
        } else {
          // If modal is open, we still update the media paths
          setProfilePic(foundUser.profilePic || '');
          setCoverPhoto(foundUser.coverPhoto || '');
        }

        // Set posts if not blocked
        if (!userRes.isBlockedMutual) {
          setPosts(postsRes?.posts || []);
        } else {
          setPosts([]);
        }

        // Set friend requests status if viewing another user's profile
        if (reqsRes) {
          const received = (reqsRes.received || []) as Notification[];
          const sent = (reqsRes.sent || []) as Notification[];

          setHasReceivedReq(received.some(r => r.senderId === foundUser.id));
          setHasSentReq(sent.some(s => s.recipientId === foundUser.id));
        }
      }
    } catch (_) {
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  };

  const handleBlockUser = async () => {
    if (!user) return;
    const confirmBlock = window.confirm(`Are you sure you want to block ${user.username}? You will not be able to send messages, view stories, or interact with each other.`);
    if (!confirmBlock) return;
    try {
      await api.post(`/api/users/${user.id}/block`);
      setIsBlockedByMe(true);
      setIsBlockedMutual(true);
      onProfileUpdated();
      fetchProfileData();
    } catch (err: any) {
      alert(err.message || 'Failed to block user');
    }
  };

  const handleUnblockUser = async () => {
    if (!user) return;
    try {
      await api.post(`/api/users/${user.id}/unblock`);
      setIsBlockedByMe(false);
      setIsBlockedMutual(hasBlockedMe);
      onProfileUpdated();
      fetchProfileData();
    } catch (err: any) {
      alert(err.message || 'Failed to unblock user');
    }
  };

  const handleAddFriend = async () => {
    if (!user) return;
    try {
      await api.post(`/api/friends/request/${user.id}`);
      setHasSentReq(true);
      window.dispatchEvent(new CustomEvent('friends-updated'));
      window.dispatchEvent(new CustomEvent('notifications-updated'));
      onProfileUpdated();
      fetchProfileData(true);
    } catch (err: any) {
      alert(err.message || 'Failed to send friend request');
    }
  };

  const handleCancelRequest = async () => {
    if (!user) return;
    try {
      await api.post(`/api/friends/cancel/${user.id}`);
      setHasSentReq(false);
      window.dispatchEvent(new CustomEvent('friends-updated'));
      window.dispatchEvent(new CustomEvent('notifications-updated'));
      fetchProfileData(true);
    } catch (err: any) {
      alert(err.message || 'Failed to cancel request');
    }
  };

  const handleAcceptRequest = async () => {
    if (!user) return;
    try {
      await api.post(`/api/friends/accept/${user.id}`);
      setHasReceivedReq(false);
      window.dispatchEvent(new CustomEvent('friends-updated'));
      window.dispatchEvent(new CustomEvent('notifications-updated'));
      onProfileUpdated();
      fetchProfileData(true);
    } catch (err: any) {
      alert(err.message || 'Failed to accept friend request');
    }
  };

  const handleDeclineRequest = async () => {
    if (!user) return;
    try {
      await api.post(`/api/friends/reject/${user.id}`);
      setHasReceivedReq(false);
      window.dispatchEvent(new CustomEvent('friends-updated'));
      window.dispatchEvent(new CustomEvent('notifications-updated'));
      fetchProfileData(true);
    } catch (err: any) {
      alert(err.message || 'Failed to decline friend request');
    }
  };

  const handleUnfriend = async () => {
    if (!user) return;
    if (!window.confirm(`Are you sure you want to remove ${user.username} from your friends?`)) return;
    try {
      await api.post(`/api/friends/unfriend/${user.id}`);
      window.dispatchEvent(new CustomEvent('friends-updated'));
      window.dispatchEvent(new CustomEvent('notifications-updated'));
      onProfileUpdated();
      fetchProfileData(true);
    } catch (err: any) {
      alert(err.message || 'Failed to remove friend');
    }
  };

  useEffect(() => {
    fetchProfileData();

    const handleFriendsUpdated = () => {
      fetchProfileData(true);
    };

    window.addEventListener('friends-updated', handleFriendsUpdated);
    return () => {
      window.removeEventListener('friends-updated', handleFriendsUpdated);
    };
  }, [profileUserId, currentUser?.id]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await api.put('/api/auth/profile', {
        username,
        bio,
        work,
        education,
        city,
        hometown,
        relationship,
        website,
        phone,
        birthday,
        gender,
        profilePic,
        coverPhoto,
      });

      if (res?.success) {
        setShowEditModal(false);
        onProfileUpdated();
        fetchProfileData();
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Follow trigger helper
  const handleFollowToggle = async () => {
    if (!user) return;
    const isFollowing = (currentUser.following || []).includes(user.id);
    try {
      if (isFollowing) {
        await api.post(`/api/unfollow/${user.id}`);
      } else {
        await api.post(`/api/follow/${user.id}`);
      }
      onProfileUpdated();
      fetchProfileData();
    } catch (_) {}
  };

  if (loading) {
    return (
      <div className="flex-1 p-8 text-center text-sm font-semibold animate-pulse">
        Loading Profile Dashboard...
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex-1 p-8 text-center text-sm font-semibold text-red-500">
        User profile not found.
      </div>
    );
  }

  const isFollowing = (currentUser.following || []).includes(user.id);

  return (
    <div className="flex-1 overflow-y-auto pb-12 bg-gray-50/30 dark:bg-gray-950 transition-colors">
      <input
        type="file"
        ref={avatarInputRef}
        onChange={handleAvatarFileChange}
        accept="image/*"
        className="hidden"
      />
      <input
        type="file"
        ref={coverInputRef}
        onChange={handleCoverFileChange}
        accept="image/*"
        className="hidden"
      />
      <input
        type="file"
        ref={profilePostFileInputRef}
        onChange={handlePostFileChange}
        accept="image/*"
        className="hidden"
      />
      
      {/* HEADER SECTION: COVER & AVATAR */}
      <div className="relative bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 pb-4 shadow-xs">
        {/* Cover banner */}
        <div 
          onClick={isOwnProfile ? () => coverInputRef.current?.click() : undefined}
          className={`relative h-48 w-full md:h-64 overflow-hidden bg-gray-200 dark:bg-gray-950 group ${isOwnProfile ? 'cursor-pointer' : ''}`}
        >
          <img loading="lazy"
            src={user.coverPhoto || 'https://images.unsplash.com/photo-1557683316-973673baf926?w=1200'}
            alt="Cover banner"
            referrerPolicy="no-referrer"
            className={`w-full h-full object-cover transition duration-200 ${isOwnProfile ? 'group-hover:brightness-90 group-hover:scale-[1.01]' : ''}`}
          />
          {isOwnProfile && (
            <>
              <div className="absolute inset-0 bg-black/25 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center pointer-events-none">
                <div className="flex items-center gap-2 rounded-xl bg-black/60 backdrop-blur-xs px-4 py-2 text-xs font-black text-white shadow-lg">
                  <Camera className="h-4 w-4 text-blue-400" />
                  <span>Click to Change Cover Photo</span>
                </div>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  coverInputRef.current?.click();
                }}
                className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-lg bg-black/60 px-3 py-1.5 text-xs font-bold text-white hover:bg-black/80 transition cursor-pointer z-10"
              >
                <Camera className="h-4 w-4" />
                <span>Edit Cover Photo</span>
              </button>
            </>
          )}
        </div>

        {/* Profile Avatar and Info row */}
        <div className="max-w-4xl mx-auto px-4 flex flex-col md:flex-row items-center md:items-end gap-4 -mt-16 md:-mt-10 relative z-10 text-center md:text-left">
          {/* Avatar Container */}
          <div className="relative h-32 w-32 md:h-36 md:w-36 rounded-full overflow-hidden border-4 border-white bg-gray-100 shadow-md dark:border-gray-900 shrink-0">
            <img loading="lazy"
              src={user.profilePic || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'}
              alt={user.username}
              referrerPolicy="no-referrer"
              className={`h-full w-full object-cover transition duration-150 ${isOwnProfile ? 'cursor-pointer hover:brightness-90' : ''}`}
              onClick={isOwnProfile ? () => avatarInputRef.current?.click() : undefined}
            />
            {isOwnProfile && (
              <div
                onClick={() => avatarInputRef.current?.click()}
                className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition duration-150 cursor-pointer text-white"
              >
                <Camera className="h-5 w-5" />
              </div>
            )}
          </div>

          {/* User Details metadata */}
          <div className="flex-1 space-y-1">
            <h1 className="text-2xl font-black text-gray-900 dark:text-white flex items-center justify-center md:justify-start gap-1.5">
              <span>{user.username}</span>
              {user.verifyBadge && (
                <span title="Verified Creator" className="inline-flex">
                  <Shield className="h-5 w-5 fill-blue-500 text-white" />
                </span>
              )}
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400 font-medium max-w-md mx-auto md:mx-0">
              {user.bio || 'No profile bio specified.'}
            </p>
            <div className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 flex justify-center md:justify-start gap-3 mt-2">
              <span>{posts.length} Post{posts.length !== 1 ? 's' : ''}</span>
              <span>{user.friends.length} Friend{user.friends.length !== 1 ? 's' : ''}</span>
              <span>{user.followers.length} Follower{user.followers.length !== 1 ? 's' : ''}</span>
            </div>
          </div>

          {/* User Action buttons */}
          <div className="flex gap-2 shrink-0 pb-1.5 mt-3 md:mt-0">
            {isOwnProfile ? (
              <button
                onClick={() => setShowEditModal(true)}
                className="flex items-center gap-1.5 rounded-lg bg-gray-100 px-4 py-2 text-xs font-bold text-gray-800 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700 transition cursor-pointer"
              >
                <Edit className="h-4 w-4" />
                <span>Edit Profile</span>
              </button>
            ) : (
              <>
                {!isBlockedMutual ? (
                  <>
                    <button
                      onClick={() => onNavigate('messenger', user.id)}
                      className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 transition active:scale-95 cursor-pointer"
                    >
                      Send Message
                    </button>

                    {(currentUser.friends || []).includes(user.id) ? (
                      <button
                        onClick={handleUnfriend}
                        className="rounded-lg bg-gray-200 dark:bg-gray-800 text-gray-800 dark:text-gray-200 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-950/50 dark:hover:text-red-400 px-4 py-2 text-xs font-bold transition cursor-pointer"
                        title="Click to remove friend"
                      >
                        ✓ Friends
                      </button>
                    ) : hasReceivedReq ? (
                      <div className="flex gap-1.5">
                        <button
                          onClick={handleAcceptRequest}
                          className="rounded-lg bg-blue-600 text-white hover:bg-blue-700 px-3 py-2 text-xs font-bold transition cursor-pointer"
                        >
                          Confirm
                        </button>
                        <button
                          onClick={handleDeclineRequest}
                          className="rounded-lg bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-300 px-3 py-2 text-xs font-bold transition cursor-pointer"
                        >
                          Decline
                        </button>
                      </div>
                    ) : hasSentReq ? (
                      <button
                        onClick={handleCancelRequest}
                        className="rounded-lg bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 px-4 py-2 text-xs font-bold transition cursor-pointer"
                      >
                        Cancel Request
                      </button>
                    ) : (
                      <button
                        onClick={handleAddFriend}
                        className="rounded-lg bg-blue-600 text-white hover:bg-blue-700 px-4 py-2 text-xs font-bold transition cursor-pointer"
                      >
                        + Add Friend
                      </button>
                    )}

                    <button
                      onClick={handleFollowToggle}
                      className={`rounded-lg px-4 py-2 text-xs font-bold cursor-pointer transition ${
                        isFollowing
                          ? 'bg-gray-200 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
                          : 'bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 text-gray-800 dark:text-gray-200'
                      }`}
                    >
                      {isFollowing ? '✓ Following' : '+ Follow'}
                    </button>
                    <button
                      onClick={handleBlockUser}
                      className="rounded-lg bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 px-4 py-2 text-xs font-bold transition cursor-pointer"
                    >
                      Block
                    </button>
                  </>
                ) : (
                  <>
                    {isBlockedByMe ? (
                      <button
                        onClick={handleUnblockUser}
                        className="rounded-lg bg-red-600 text-white hover:bg-red-700 px-4 py-2 text-xs font-bold transition cursor-pointer"
                      >
                        Unblock User
                      </button>
                    ) : (
                      <span className="text-xs text-red-500 font-bold bg-red-50 dark:bg-red-950/40 px-3 py-1.5 rounded-lg">
                        Unavailable
                      </span>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* BODY COLUMN SECTIONS */}
      {isBlockedMutual ? (
        <div className="max-w-4xl mx-auto px-4 mt-6">
          <div className="rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-950/20 p-8 text-center space-y-4">
            <Shield className="h-12 w-12 text-red-500 mx-auto" />
            <h3 className="text-lg font-black text-gray-900 dark:text-white">
              {isBlockedByMe ? 'You have blocked this user' : 'Profile is currently unavailable'}
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 max-w-md mx-auto leading-relaxed">
              {isBlockedByMe 
                ? 'You blocked this user. To view their posts or send messages, you must first unblock them.' 
                : 'This user has restricted access or a block is in place. Interactions and profile details are completely disabled.'}
            </p>
            {isBlockedByMe && (
              <button
                onClick={handleUnblockUser}
                className="rounded-lg bg-red-600 px-6 py-2 text-xs font-bold text-white hover:bg-red-700 transition"
              >
                Unblock User
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="max-w-4xl mx-auto px-4 mt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* LEFT COLUMN: INTRO CARD */}
        <div className="md:col-span-1 space-y-4">
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-800 dark:bg-gray-900 space-y-3">
            <h3 className="text-sm font-black text-gray-900 dark:text-gray-100 border-b pb-2">Intro</h3>
            
            <div className="space-y-2 text-xs text-gray-700 dark:text-gray-300">
              {user.work && (
                <div className="flex items-center gap-2.5">
                  <Briefcase className="h-4.5 w-4.5 text-gray-400 shrink-0" />
                  <span>Works at <span className="font-semibold">{user.work}</span></span>
                </div>
              )}
              {user.education && (
                <div className="flex items-center gap-2.5">
                  <GraduationCap className="h-4.5 w-4.5 text-gray-400 shrink-0" />
                  <span>Studied at <span className="font-semibold">{user.education}</span></span>
                </div>
              )}
              {user.city && (
                <div className="flex items-center gap-2.5">
                  <MapPin className="h-4.5 w-4.5 text-gray-400 shrink-0" />
                  <span>Lives in <span className="font-semibold">{user.city}</span></span>
                </div>
              )}
              {user.hometown && (
                <div className="flex items-center gap-2.5">
                  <MapPin className="h-4.5 w-4.5 text-gray-400 shrink-0" />
                  <span>From <span className="font-semibold">{user.hometown}</span></span>
                </div>
              )}
              {user.relationship && (
                <div className="flex items-center gap-2.5">
                  <Heart className="h-4.5 w-4.5 text-gray-400 shrink-0" />
                  <span>Relationship: <span className="font-semibold">{user.relationship}</span></span>
                </div>
              )}
              {user.website && (
                <div className="flex items-center gap-2.5 text-blue-600 dark:text-blue-400 truncate">
                  <LinkIcon className="h-4.5 w-4.5 text-gray-400 shrink-0" />
                  <a href={user.website} target="_blank" rel="noopener noreferrer" className="hover:underline">
                    {user.website}
                  </a>
                </div>
              )}
              {user.phone && (
                <div className="flex items-center gap-2.5">
                  <Phone className="h-4.5 w-4.5 text-gray-400 shrink-0" />
                  <span>{user.phone}</span>
                </div>
              )}
              <div className="flex items-center gap-2.5">
                <Mail className="h-4.5 w-4.5 text-gray-400 shrink-0" />
                <span>{user.email}</span>
              </div>
            </div>
          </div>

          {/* Featured Photos Widget */}
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-800 dark:bg-gray-900 space-y-3">
            <h3 className="text-sm font-black text-gray-900 dark:text-gray-100 border-b pb-2">Featured Photos</h3>
            <div className="grid grid-cols-2 gap-2">
              {(user.featuredPhotos && user.featuredPhotos.length > 0) ? (
                user.featuredPhotos.map((photo, i) => (
                  <img loading="lazy"
                    key={i}
                    src={photo}
                    alt={`Featured ${i}`}
                    referrerPolicy="no-referrer"
                    className="h-28 w-full rounded-lg object-cover border"
                  />
                ))
              ) : (
                <>
                  <img src="https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=300" referrerPolicy="no-referrer" className="h-24 w-full rounded-lg object-cover" />
                  <img src="https://images.unsplash.com/photo-1531297484001-80022131f5a1?w=300" referrerPolicy="no-referrer" className="h-24 w-full rounded-lg object-cover" />
                </>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: USER POSTS */}
        <div className="md:col-span-2 space-y-4">
          {isOwnProfile && (
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-800 dark:bg-gray-900 space-y-4">
              <div className="flex gap-3">
                <img loading="lazy"
                  src={currentUser.profilePic || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'}
                  alt={currentUser.username}
                  className="h-9 w-9 rounded-full object-cover shrink-0"
                />
                <div className="flex-1">
                  <textarea
                    rows={3}
                    value={profileEditorText}
                    onChange={(e) => setProfileEditorText(e.target.value)}
                    placeholder={`What's on your mind, ${currentUser.username.split(' ')[0]}?`}
                    className="w-full resize-none rounded-xl border border-gray-100 bg-gray-50/50 p-3 text-xs text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-blue-500 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-100 dark:placeholder-gray-500 dark:focus:border-blue-500 dark:focus:bg-gray-900"
                  />
                </div>
              </div>

              {profileEditorImage && (
                <div className="relative mt-2 rounded-lg overflow-hidden border max-h-48 bg-gray-50 dark:bg-gray-950">
                  <img loading="lazy"
                    src={profileEditorImage}
                    alt="Uploaded preview"
                    className="w-full max-h-44 object-contain"
                  />
                  <button
                    type="button"
                    onClick={() => setProfileEditorImage('')}
                    className="absolute top-2 right-2 rounded-full bg-black/60 p-1 text-white hover:bg-black/80 transition cursor-pointer"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}

              <div className="flex items-center justify-between border-t border-gray-100 pt-3 dark:border-gray-800">
                <button
                  type="button"
                  onClick={() => profilePostFileInputRef.current?.click()}
                  className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-green-600 hover:bg-green-50 dark:hover:bg-green-950/20 transition cursor-pointer"
                >
                  <Image className="h-4 w-4" />
                  <span className="font-semibold">Add Photo</span>
                </button>

                <button
                  onClick={handleCreateProfilePost}
                  disabled={publishingPost}
                  className="rounded-lg bg-[#1877F2] px-4 py-1.5 text-xs font-bold text-white hover:bg-blue-600 cursor-pointer active:scale-95 transition disabled:opacity-55"
                >
                  {publishingPost ? 'Publishing...' : 'Publish'}
                </button>
              </div>
            </div>
          )}

          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-800 dark:bg-gray-900">
            <h3 className="text-sm font-black text-gray-900 dark:text-gray-100">Posts Feed</h3>
          </div>

          <div className="space-y-4">
            {posts.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-200 p-8 text-center text-xs text-gray-400 dark:border-gray-800">
                {isOwnProfile ? "You haven't published any posts yet." : "This user has not published any posts."}
              </div>
            ) : (
              posts.map(post => (
                <PostCard
                  key={post.id}
                  post={post}
                  currentUser={currentUser}
                  onNavigate={onNavigate}
                  onReact={handleReactToPost}
                  onToggleComments={handleToggleComments}
                  onSubmitComment={handleSubmitProfileComment}
                  onDelete={handleDeleteProfilePost}
                  onTogglePin={handleTogglePin}
                  onToggleCommenting={handleToggleCommenting}
                  onReport={handleReportPost}
                  onVotePoll={handleVotePollProfile}
                  onCopyLink={handleCopyPostLink}
                  isCommentsOpen={openCommentPostId === post.id}
                  isCommentsLoading={false}
                />
              ))
            )}
          </div>
        </div>
      </div>
    )}

      {/* EDIT PROFILE DIALOG OVERLAY */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl dark:bg-gray-900 border max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setShowEditModal(false)}
              className="absolute top-4 right-4 rounded-full p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
            
            <h2 className="text-lg font-black text-gray-900 dark:text-white border-b pb-3 mb-4">Edit Profile details</h2>

            <form onSubmit={handleUpdateProfile} className="space-y-4 text-xs">
              {/* Profile Pic & Cover Photo Editors inside the Edit Modal */}
              <div className="border-b border-gray-150 pb-4 mb-4 grid grid-cols-1 md:grid-cols-2 gap-4 dark:border-gray-800">
                <div className="flex flex-col items-center justify-center p-3 border border-gray-150 rounded-xl bg-gray-50/50 dark:bg-gray-950/10 dark:border-gray-800">
                  <span className="block font-bold text-gray-500 mb-2 text-center">Profile Picture</span>
                  <div className="relative h-16 w-16 rounded-full overflow-hidden border border-gray-200 bg-gray-100 dark:border-gray-800 mb-2">
                    <img loading="lazy"
                      src={profilePic || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'}
                      alt="Profile preview"
                      referrerPolicy="no-referrer"
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => avatarInputRef.current?.click()}
                    className="flex items-center gap-1 rounded-md bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700 px-2.5 py-1 text-[10px] font-bold text-gray-700 transition cursor-pointer"
                  >
                    <Camera className="h-3 w-3" />
                    Upload Photo
                  </button>
                </div>
                <div className="flex flex-col items-center justify-center p-3 border border-gray-150 rounded-xl bg-gray-50/50 dark:bg-gray-950/10 dark:border-gray-800">
                  <span className="block font-bold text-gray-500 mb-2 text-center">Cover Photo</span>
                  <div 
                    onClick={() => coverInputRef.current?.click()}
                    className="relative h-10 w-full max-w-[150px] rounded-lg overflow-hidden border border-gray-200 bg-gray-100 dark:border-gray-800 mb-2 cursor-pointer hover:opacity-90 transition"
                  >
                    <img loading="lazy"
                      src={coverPhoto || 'https://images.unsplash.com/photo-1557683316-973673baf926?w=1200'}
                      alt="Cover preview"
                      referrerPolicy="no-referrer"
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => coverInputRef.current?.click()}
                    className="flex items-center gap-1 rounded-md bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700 px-2.5 py-1 text-[10px] font-bold text-gray-700 transition cursor-pointer"
                  >
                    <Camera className="h-3 w-3" />
                    Upload Cover
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-gray-500 mb-1">Full Name</label>
                  <input
                    type="text"
                    placeholder="Full Name"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 focus:outline-hidden focus:ring-1 focus:ring-blue-500 dark:border-gray-800 dark:bg-gray-950"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-500 mb-1">Bio tagline</label>
                  <input
                    type="text"
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 focus:outline-hidden focus:ring-1 focus:ring-blue-500 dark:border-gray-800 dark:bg-gray-950"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-500 mb-1">Occupation / Work</label>
                  <input
                    type="text"
                    value={work}
                    onChange={(e) => setWork(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 focus:outline-hidden focus:ring-1 focus:ring-blue-500 dark:border-gray-800 dark:bg-gray-950"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-500 mb-1">Education / School</label>
                  <input
                    type="text"
                    value={education}
                    onChange={(e) => setEducation(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 focus:outline-hidden focus:ring-1 focus:ring-blue-500 dark:border-gray-800 dark:bg-gray-950"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-500 mb-1">Current City</label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 focus:outline-hidden focus:ring-1 focus:ring-blue-500 dark:border-gray-800 dark:bg-gray-950"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-500 mb-1">Hometown</label>
                  <input
                    type="text"
                    value={hometown}
                    onChange={(e) => setHometown(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 focus:outline-hidden focus:ring-1 focus:ring-blue-500 dark:border-gray-800 dark:bg-gray-950"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-500 mb-1">Relationship Status</label>
                  <select
                    value={relationship}
                    onChange={(e) => setRelationship(e.target.value as any)}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 focus:outline-hidden focus:ring-1 focus:ring-blue-500 dark:border-gray-800 dark:bg-gray-950"
                  >
                    <option>Single</option>
                    <option>In a relationship</option>
                    <option>Engaged</option>
                    <option>Married</option>
                    <option>It's complicated</option>
                    <option>Separated</option>
                    <option>Divorced</option>
                    <option>Widowed</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-gray-500 mb-1">Website URL</label>
                  <input
                    type="url"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 focus:outline-hidden focus:ring-1 focus:ring-blue-500 dark:border-gray-800 dark:bg-gray-950"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-500 mb-1">Telephone / Phone</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 focus:outline-hidden focus:ring-1 focus:ring-blue-500 dark:border-gray-800 dark:bg-gray-950"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-500 mb-1">Birthday Date</label>
                  <input
                    type="date"
                    value={birthday}
                    onChange={(e) => setBirthday(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 focus:outline-hidden focus:ring-1 focus:ring-blue-500 dark:border-gray-800 dark:bg-gray-950"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-500 mb-1">Gender</label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value as any)}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 focus:outline-hidden focus:ring-1 focus:ring-blue-500 dark:border-gray-800 dark:bg-gray-950"
                  >
                    <option>Male</option>
                    <option>Female</option>
                    <option>Custom</option>
                    <option>Prefer not to say</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t pt-4 mt-6">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="rounded-lg bg-gray-100 px-4 py-2 font-bold hover:bg-gray-200 dark:bg-gray-800 text-gray-800 dark:text-gray-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-[#1877F2] px-5 py-2 font-bold text-white hover:bg-blue-600 cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
