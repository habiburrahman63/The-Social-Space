/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Smile, MapPin, Users, Calendar, BarChart2, MoreHorizontal, MessageCircle, Share2, Pin, Trash2, Edit3, MessageSquareOff, Plus,
  Image as ImageIcon, Heart, Star, Send, ChevronRight, X, User as UserIcon, Shield, Lock, Globe, Flag, Eye
} from 'lucide-react';
import { Post, User, Story, Comment, Reply, ReactionType } from '../types';
import { api } from '../utils/api';
import { getFeedSnapshot, setFeedSnapshot } from '../utils/feedCache';

const FEELINGS = ['happy', 'excited', 'blessed', 'peaceful', 'tired', 'sad', 'motivated'];
// How many posts one feed page holds. Comment bodies are fetched separately, so
// this is the only thing bounding the initial feed payload.
const FEED_PAGE_SIZE = 10;
const LOCATIONS = ['San Francisco, CA', 'New York, NY', 'Portland, OR', 'Seattle, WA', 'London, UK', 'Tokyo, JP'];

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

interface FeedProps {
  currentUser: User;
  onNavigate: (view: string, targetId?: string) => void;
}

export default function Feed({ currentUser, onNavigate }: FeedProps) {
  // Start from whatever the Feed last successfully loaded (if the user is
  // returning here after visiting another page in the same session)
  // instead of an empty list, so navigating Home -> Profile -> Home shows
  // the same posts instantly rather than flashing an empty/loading feed.
  const cachedSnapshot = getFeedSnapshot();

  // Feed posts
  const [posts, setPosts] = useState<Post[]>(cachedSnapshot?.posts || []);
  const [loading, setLoading] = useState(!cachedSnapshot);
  const [activeFilter, setActiveFilter] = useState<'all' | 'drafts' | 'scheduled'>('all');

  // Feed pagination - the first page loads on mount, further pages on demand.
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // Drafts and scheduled posts always belong to their author, so they are
  // fetched separately and in full. That keeps those two tabs complete and
  // their counts accurate no matter how many feed pages are loaded.
  const [mySpecialPosts, setMySpecialPosts] = useState<Post[]>([]);

  // Comments are fetched the first time a post's comment tray is opened.
  const [commentsLoadingPostId, setCommentsLoadingPostId] = useState<string | null>(null);
  const commentsLoadingRef = useRef(false);

  // Stories
  const [stories, setStories] = useState<Story[]>(cachedSnapshot?.stories || []);
  const [activeStoryViewer, setActiveStoryViewer] = useState<Story | null>(null);
  const [showViewersSheet, setShowViewersSheet] = useState(false);

  // Stories Creator Modal States
  const [showCreateStoryModal, setShowCreateStoryModal] = useState(false);
  const [storyImageUrl, setStoryImageUrl] = useState('');
  const [storyUploading, setStoryUploading] = useState(false);
  const storyFileInputRef = useRef<HTMLInputElement>(null);

  // Post Creator State
  const [editorText, setEditorText] = useState('');
  const [editorImage, setEditorImage] = useState('');
  const [editorFeeling, setEditorFeeling] = useState('');
  const [editorLocation, setEditorLocation] = useState('');
  const [editorTags, setEditorTags] = useState<string[]>([]);
  const [editorPrivacy, setEditorPrivacy] = useState<'Public' | 'Friends' | 'Only Me'>('Public');
  const [isDraft, setIsDraft] = useState(false);
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduledTime, setScheduledTime] = useState('');
  // Prevents double-submit: an impatient double-click on "Publish" (or a
  // repeated Enter keypress on a slow connection) used to create two posts.
  const [isPublishing, setIsPublishing] = useState(false);
  
  // File Upload and Drag/Drop State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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
          setEditorImage(compressedUrl);
        });
      };
      reader.readAsDataURL(file);
    }
  };
  
  // Poll Options State
  const [showPollBuilder, setShowPollBuilder] = useState(false);
  const [pollOptions, setPollOptions] = useState<string[]>(['', '']);

  // Active Dropdowns
  const [showFeelingSelector, setShowFeelingSelector] = useState(false);
  const [showLocationSelector, setShowLocationSelector] = useState(false);
  const [showTagSelector, setShowTagSelector] = useState(false);
  const [hoveredReactionPostId, setHoveredReactionPostId] = useState<string | null>(null);
  const [openPostSettingsId, setOpenPostSettingsId] = useState<string | null>(null);

  // Active Comment Trays
  const [openCommentPostId, setOpenCommentPostId] = useState<string | null>(null);
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});
  const [replyInputs, setReplyInputs] = useState<Record<string, string>>({});
  const [activeReplyCommentId, setActiveReplyCommentId] = useState<string | null>(null);
  // In-flight guards, so a double-click can't post the same comment or the
  // same reaction twice (a reaction is a toggle, so two overlapping requests
  // would immediately undo each other).
  const commentSubmitInFlightRef = useRef(false);
  const reactInFlightRef = useRef(false);

  // Toast Notification
  const [toastMessage, setToastMessage] = useState('');

  // Fetch initial posts and stories
  const fetchFeedData = async () => {
    try {
      // Only show the blocking loading state on a genuinely first load.
      // When we already have a cached snapshot to show (returning to Home
      // from another page), this runs as a silent background refresh so
      // the user isn't staring at a spinner over content they can already
      // see.
      if (!getFeedSnapshot()) setLoading(true);

      // All three are independent, so fetch them together.
      // `includeComments=0` keeps every comment on the page out of the feed
      // payload - a post's comments are only fetched when its tray is opened.
      const [postsRes, storiesRes, ownRes] = await Promise.all([
        api.get(`/api/posts?page=1&limit=${FEED_PAGE_SIZE}&includeComments=0`),
        api.get('/api/stories'),
        api.get('/api/posts?scope=own&limit=100&includeComments=0'),
      ]);

      const nextPosts = ((postsRes.posts || []) as Post[]).map((p) => ({ ...p, commentsLoaded: false }));
      const nextStories = storiesRes.stories || [];
      setPosts(nextPosts);
      setMySpecialPosts(((ownRes.posts || []) as Post[]).map((p) => ({ ...p, commentsLoaded: false })));
      setPage(1);
      setHasMore(!!postsRes.hasMore);
      setStories(nextStories);
      setFeedSnapshot(nextPosts, nextStories);
    } catch (_) {
    } finally {
      setLoading(false);
    }
  };

  // Load the next page of the feed. Posts are de-duplicated by id so a post
  // that shifts between pages (e.g. a newly pinned post) can't appear twice.
  const handleLoadMore = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const res = await api.get(`/api/posts?page=${nextPage}&limit=${FEED_PAGE_SIZE}&includeComments=0`);
      const incoming = (res.posts || []) as Post[];
      setPosts(prev => {
        const seen = new Set(prev.map((p) => p.id));
        const merged = [...prev];
        for (const p of incoming) {
          if (seen.has(p.id)) continue;
          seen.add(p.id);
          merged.push({ ...p, commentsLoaded: false });
        }
        return merged;
      });
      setPage(nextPage);
      setHasMore(!!res.hasMore);
    } catch (_) {
    } finally {
      setLoadingMore(false);
    }
  };

  // Open/close a post's comment tray, fetching its comments on first open so
  // the feed itself never has to carry every comment on the page.
  const handleToggleComments = async (postId: string) => {
    const opening = openCommentPostId !== postId;
    setOpenCommentPostId(opening ? postId : null);
    if (!opening) return;

    const target = posts.find((p) => p.id === postId);
    if (target?.commentsLoaded || commentsLoadingRef.current) return;

    commentsLoadingRef.current = true;
    setCommentsLoadingPostId(postId);
    try {
      const res = await api.get(`/api/posts/${postId}/comments`);
      patchPost(postId, {
        comments: (res?.comments || []) as Comment[],
        commentsCount: typeof res?.commentsCount === 'number' ? res.commentsCount : target?.commentsCount,
        commentsLoaded: true,
      });
    } catch (_) {
    } finally {
      commentsLoadingRef.current = false;
      setCommentsLoadingPostId(null);
    }
  };

  // A post can live in either the paginated feed or the own-posts list
  // (drafts / scheduled), so every in-place update has to touch both.
  const patchPost = (postId: string, patch: Partial<Post>) => {
    setPosts(prev => prev.map(p => (p.id === postId ? { ...p, ...patch } : p)));
    setMySpecialPosts(prev => prev.map(p => (p.id === postId ? { ...p, ...patch } : p)));
  };

  useEffect(() => {
    fetchFeedData();
  }, []);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3000);
  };

  // Create Story Dialog Trigger
  const handleCreateStory = () => {
    setStoryImageUrl('');
    setShowCreateStoryModal(true);
  };

  // Story file upload change handler
  const handleStoryFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        alert('Please select an image file.');
        return;
      }
      const reader = new FileReader();
      setStoryUploading(true);
      reader.onloadend = () => {
        const base64Url = reader.result as string;
        compressImage(base64Url, 1000, 1000, 0.8).then((compressedUrl) => {
          setStoryImageUrl(compressedUrl);
          setStoryUploading(false);
        }).catch(() => {
          setStoryUploading(false);
        });
      };
      reader.onerror = () => {
        setStoryUploading(false);
      };
      reader.readAsDataURL(file);
    }
  };

  // Publish Story
  const handlePublishStory = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalUrl = storyImageUrl.trim();
    if (!finalUrl) {
      alert('Please upload an image or provide an image URL.');
      return;
    }
    try {
      setStoryUploading(true);
      await api.post('/api/stories', { mediaUrl: finalUrl, type: 'image' });
      fetchFeedData();
      triggerToast('Story created! Active for 24 hours.');
      setShowCreateStoryModal(false);
      setStoryImageUrl('');
    } catch (err: any) {
      alert(err.message || 'Failed to create story.');
    } finally {
      setStoryUploading(false);
    }
  };

  // View Story
  const handleViewStory = async (story: Story) => {
    setActiveStoryViewer(story);
    try {
      const res = await api.post(`/api/stories/${story.id}/view`);
      if (res?.success) {
        const updatedStory = {
          ...story,
          seenBy: res.seenBy || story.seenBy,
          seenDetails: res.seenDetails || story.seenDetails
        };
        setActiveStoryViewer(updatedStory);
        setStories(prev => prev.map(s => s.id === story.id ? updatedStory : s));
      }
    } catch (_) {}
  };

  // Toggle editor tags
  const handleToggleTag = (username: string) => {
    setEditorTags(prev =>
      prev.includes(username) ? prev.filter(u => u !== username) : [...prev, username]
    );
  };

  // Publish Post
  const handlePublishPost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isPublishing) return;
    if (!editorText.trim() && !editorImage) {
      alert('Cannot publish empty post. Write some text or insert an image.');
      return;
    }
    setIsPublishing(true);

    try {
      const payload = {
        text: editorText,
        mediaUrls: editorImage ? [editorImage] : [],
        mediaType: editorImage ? 'image' : undefined,
        feeling: editorFeeling || undefined,
        location: editorLocation || undefined,
        tags: editorTags.length > 0 ? editorTags : undefined,
        privacy: editorPrivacy,
        isDraft: isDraft ? true : undefined,
        scheduledTime: isScheduled && scheduledTime ? scheduledTime : undefined,
        pollOptions: showPollBuilder ? pollOptions.filter(o => o.trim() !== '') : undefined
      };

      const createRes = await api.post('/api/posts', payload);

      // Reset Editor
      setEditorText('');
      setEditorImage('');
      setEditorFeeling('');
      setEditorLocation('');
      setEditorTags([]);
      setEditorPrivacy('Public');
      setIsDraft(false);
      setIsScheduled(false);
      setScheduledTime('');
      setShowPollBuilder(false);
      setPollOptions(['', '']);

      // Show the newly created post instantly using the complete object the
      // server just returned (already has reactions/comments/pollOptions in
      // the right shape), instead of waiting on a second round-trip.
      if (createRes?.post) {
        setPosts(prev => [{ ...createRes.post, commentsLoaded: true }, ...prev.filter(p => p.id !== createRes.post.id)]);
      }
      fetchFeedData();
      triggerToast(isDraft ? 'Post saved as draft!' : 'Post published successfully!');
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsPublishing(false);
    }
  };

  // Delete post
  const handleDeletePost = async (id: string) => {
    if (!confirm('Are you sure you want to delete this post?')) return;
    try {
      await api.delete(`/api/posts/${id}`);
      setPosts(prev => prev.filter(p => p.id !== id));
      setMySpecialPosts(prev => prev.filter(p => p.id !== id));
      triggerToast('Post deleted successfully.');
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Toggle Pinned
  const handleTogglePin = async (post: Post) => {
    try {
      const res = await api.put(`/api/posts/${post.id}`, { isPinned: !post.isPinned });
      if (res?.post) patchPost(post.id, { ...res.post, commentsLoaded: true });
      triggerToast(post.isPinned ? 'Post unpinned.' : 'Post pinned to top of feed.');
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Disable Commenting
  const handleToggleCommenting = async (post: Post) => {
    try {
      const res = await api.put(`/api/posts/${post.id}`, { commentsDisabled: !post.commentsDisabled });
      if (res?.post) patchPost(post.id, { ...res.post, commentsLoaded: true });
      triggerToast(post.commentsDisabled ? 'Comments enabled.' : 'Comments turned off for this post.');
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Toggle React
  const handleReactToPost = async (postId: string, reaction: ReactionType) => {
    if (reactInFlightRef.current) return;
    reactInFlightRef.current = true;
    try {
      const res = await api.post(`/api/posts/${postId}/react`, { type: reaction });
      if (res?.reactions) patchPost(postId, { reactions: res.reactions });
      setHoveredReactionPostId(null);
    } catch (_) {
    } finally {
      reactInFlightRef.current = false;
    }
  };

  // Submit Comment / Reply
  const handleSubmitComment = async (postId: string, parentCommentId?: string) => {
    const text = parentCommentId ? replyInputs[parentCommentId] : commentInputs[postId];
    if (!text || !text.trim()) return;
    if (commentSubmitInFlightRef.current) return;
    commentSubmitInFlightRef.current = true;

    try {
      const res = await api.post(`/api/posts/${postId}/comment`, {
        text,
        parentCommentId
      });

      // Update posts locally. The response carries the full comment list, so
      // this also marks that post's comments as loaded.
      if (res?.comments) {
        patchPost(postId, {
          comments: res.comments,
          commentsCount: res.comments.length,
          commentsLoaded: true,
        });
      }

      if (parentCommentId) {
        setReplyInputs(prev => ({ ...prev, [parentCommentId]: '' }));
        setActiveReplyCommentId(null);
      } else {
        setCommentInputs(prev => ({ ...prev, [postId]: '' }));
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      commentSubmitInFlightRef.current = false;
    }
  };

  // Vote on Poll Option
  const handleVotePoll = async (postId: string, optionIdx: number) => {
    try {
      const res = await api.post(`/api/posts/${postId}/poll/vote`, { optionIdx });
      if (res?.pollOptions) setPosts(prev => prev.map(p => p.id === postId ? { ...p, pollOptions: res.pollOptions } : p));
      triggerToast('Vote recorded!');
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Copy post link
  const handleCopyLink = (id: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/post/${id}`);
    triggerToast('Post link copied to clipboard!');
  };

  // Create Post Report
  const handleReportPost = async (postId: string) => {
    const reason = prompt('Please describe why you are reporting this post:');
    if (!reason || !reason.trim()) return;
    try {
      await api.post('/api/reports', { reportedId: postId, type: 'post', reason });
      triggerToast('Post has been reported to site administrators.');
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Filter posts list based on drafts/schedules. The Drafts/Scheduled tabs read
  // from the dedicated own-posts fetch, so their contents (and the counts on
  // the tab buttons) stay complete however few feed pages are loaded.
  const filteredPosts = (activeFilter === 'all' ? posts : mySpecialPosts).filter(p => {
    if (activeFilter === 'drafts') return !!p.isDraft;
    if (activeFilter === 'scheduled') return !!p.scheduledTime;
    return !p.isDraft && !p.scheduledTime;
  });
  const draftsCount = mySpecialPosts.filter(p => p.isDraft).length;
  const scheduledCount = mySpecialPosts.filter(p => !!p.scheduledTime).length;

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6 md:px-6 max-w-2xl mx-auto space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-5 left-5 z-50 rounded-xl bg-gray-900 px-4 py-3 text-sm font-semibold text-white shadow-xl dark:bg-white dark:text-gray-900 animate-bounce">
          {toastMessage}
        </div>
      )}

      {/* 1. STORIES SHELF */}
      <div className="relative flex w-full gap-2 overflow-x-auto pb-2 scrollbar-thin select-none">
        {/* Create Story trigger */}
        <div
          onClick={handleCreateStory}
          className="relative flex h-40 w-28 shrink-0 cursor-pointer flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white hover:shadow-md dark:border-gray-800 dark:bg-gray-900 group"
        >
          <img loading="lazy"
            src={currentUser.profilePic || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'}
            alt="My Profile"
            referrerPolicy="no-referrer"
            className="h-28 w-full object-cover group-hover:scale-105 transition duration-200"
          />
          <div className="absolute top-[96px] left-[34px] flex h-9 w-9 items-center justify-center rounded-full bg-[#1877F2] text-white border-4 border-white dark:border-gray-900 shadow-xs">
            <Plus className="h-5 w-5" />
          </div>
          <div className="flex flex-1 items-end justify-center pb-2">
            <span className="text-[10px] font-bold text-gray-700 dark:text-gray-300">Create Story</span>
          </div>
        </div>

        {/* Stories list */}
        {stories.map((story, idx) => {
          const hasSeen = (story.seenBy || []).includes(currentUser.id);
          return (
            <div
              key={story.id ? `${story.id}-${idx}` : `story-${idx}`}
              onClick={() => handleViewStory(story)}
              className="relative flex h-40 w-28 shrink-0 cursor-pointer flex-col overflow-hidden rounded-2xl bg-gray-950 shadow-xs group"
            >
              <img loading="lazy"
                src={story.mediaUrl}
                alt={story.username}
                referrerPolicy="no-referrer"
                className="absolute inset-0 h-full w-full object-cover opacity-80 group-hover:scale-105 transition duration-200"
              />
              <div className="absolute top-3 left-3">
                <img loading="lazy"
                  src={(story.userId === currentUser.id ? (currentUser.profilePic || story.userAvatar) : story.userAvatar) || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'}
                  alt={story.username}
                  referrerPolicy="no-referrer"
                  className={`h-9 w-9 rounded-full object-cover border-2 ${
                    hasSeen ? 'border-gray-300' : 'border-blue-500 animate-pulse'
                  }`}
                />
              </div>
              <div className="absolute bottom-3 left-3">
                <span className="text-[11px] font-bold text-white drop-shadow-sm truncate max-w-[90px] block">
                  {story.username}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* 2. POST CREATOR */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          const file = e.dataTransfer.files?.[0];
          if (file) {
            if (!file.type.startsWith('image/')) {
              alert('Please drag and drop an image file.');
              return;
            }
            const reader = new FileReader();
            reader.onloadend = () => {
              const base64Url = reader.result as string;
              compressImage(base64Url, 1000, 1000, 0.8).then((compressedUrl) => {
                setEditorImage(compressedUrl);
              });
            };
            reader.readAsDataURL(file);
          }
        }}
        className={`rounded-2xl border p-4 shadow-xs transition-all duration-200 ${
          isDragging
            ? 'border-blue-500 bg-blue-50/15 dark:bg-blue-950/20 shadow-lg scale-[1.01]'
            : 'border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900'
        }`}
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept="image/*"
          className="hidden"
        />
        <form onSubmit={handlePublishPost} className="space-y-4">
          <div className="flex gap-3">
            <img loading="lazy"
              src={currentUser.profilePic || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'}
              alt={currentUser.username}
              referrerPolicy="no-referrer"
              className="h-10 w-10 rounded-full object-cover"
            />
            <div className="flex-1">
              <textarea
                placeholder={isDragging ? "Drop your photo here!" : `What's on your mind, ${currentUser.username.split(' ')[0]}?`}
                value={editorText}
                onChange={(e) => setEditorText(e.target.value)}
                className="w-full resize-none rounded-xl border border-gray-100 bg-gray-50/50 p-3 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-blue-500 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-100 dark:placeholder-gray-500 dark:focus:border-blue-500 dark:focus:bg-gray-900"
                rows={3}
              />
            </div>
          </div>

          {/* Upload preview */}
          {editorImage && (
            <div className="relative rounded-xl overflow-hidden border border-gray-200 dark:border-gray-800 max-h-48 bg-gray-50 dark:bg-gray-950">
              <img src={editorImage} alt="Upload preview" referrerPolicy="no-referrer" className="w-full max-h-48 object-contain" />
              <button
                type="button"
                onClick={() => setEditorImage('')}
                className="absolute top-2 right-2 rounded-full bg-gray-900/60 p-1.5 text-white hover:bg-gray-900 transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Quick tags row */}
          <div className="flex flex-wrap gap-2 text-xs">
            {editorFeeling && (
              <span className="flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400">
                <Smile className="h-3.5 w-3.5" />
                <span>Feeling {editorFeeling}</span>
                <X className="h-3 w-3 cursor-pointer" onClick={() => setEditorFeeling('')} />
              </span>
            )}
            {editorLocation && (
              <span className="flex items-center gap-1.5 rounded-full bg-red-50 px-3 py-1 text-red-700 dark:bg-red-950/20 dark:text-red-400">
                <MapPin className="h-3.5 w-3.5" />
                <span>at {editorLocation}</span>
                <X className="h-3 w-3 cursor-pointer" onClick={() => setEditorLocation('')} />
              </span>
            )}
            {editorTags.map(tag => (
              <span key={tag} className="flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-blue-700 dark:bg-blue-950/20 dark:text-blue-400">
                <Users className="h-3.5 w-3.5" />
                <span>with {tag}</span>
                <X className="h-3 w-3 cursor-pointer" onClick={() => handleToggleTag(tag)} />
              </span>
            ))}
          </div>

          {/* Dynamic Builders */}
          {showPollBuilder && (
            <div className="rounded-xl border border-dashed border-gray-200 p-3 space-y-2 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-950/20 animate-in fade-in duration-150">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-500">Create Poll Options</span>
                <button
                  type="button"
                  onClick={() => {
                    setShowPollBuilder(false);
                    setPollOptions(['', '']);
                  }}
                  className="text-[10px] text-red-500 hover:underline cursor-pointer"
                >
                  Remove Poll
                </button>
              </div>
              {pollOptions.map((opt, idx) => (
                <input
                  key={idx}
                  type="text"
                  placeholder={`Option ${idx + 1}`}
                  value={opt}
                  onChange={(e) => {
                    const next = [...pollOptions];
                    next[idx] = e.target.value;
                    setPollOptions(next);
                  }}
                  className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-xs focus:outline-hidden focus:ring-1 focus:ring-blue-500 dark:border-gray-800 dark:bg-gray-900"
                />
              ))}
              <button
                type="button"
                onClick={() => setPollOptions([...pollOptions, ''])}
                className="text-xs font-semibold text-blue-600 hover:underline cursor-pointer"
              >
                + Add Option
              </button>
            </div>
          )}

          {isScheduled && (
            <div className="flex items-center gap-2 rounded-xl border border-gray-200 p-3 dark:border-gray-800 animate-in fade-in duration-150 bg-gray-50/30">
              <Calendar className="h-4 w-4 text-pink-500" />
              <div className="flex flex-col flex-1">
                <label className="text-[10px] font-bold text-gray-500">Schedule Posting Date</label>
                <input
                  type="datetime-local"
                  value={scheduledTime}
                  onChange={(e) => setScheduledTime(e.target.value)}
                  className="border-0 bg-transparent p-0 text-xs text-gray-800 dark:text-white focus:outline-hidden focus:ring-0"
                />
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsScheduled(false);
                  setScheduledTime('');
                }}
                className="text-xs font-bold text-red-500 hover:underline cursor-pointer"
              >
                Cancel
              </button>
            </div>
          )}

          <div className="border-t border-gray-100 pt-3 dark:border-gray-800 flex items-center justify-between flex-wrap gap-2">
            {/* Publisher Tools */}
            <div className="flex items-center gap-1 flex-wrap">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex h-8 items-center gap-1.5 rounded-lg px-2 text-xs text-green-600 hover:bg-green-50 dark:hover:bg-green-950/20 transition cursor-pointer"
                title="Add Image from Device"
              >
                <ImageIcon className="h-4.5 w-4.5" />
                <span className="hidden sm:inline">Photo</span>
              </button>

              <button
                type="button"
                onClick={() => setShowFeelingSelector(!showFeelingSelector)}
                className="relative flex h-8 items-center gap-1.5 rounded-lg px-2 text-xs text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/20 transition cursor-pointer"
                title="Add Feeling"
              >
                <Smile className="h-4.5 w-4.5" />
                <span className="hidden sm:inline">Feeling</span>

                {showFeelingSelector && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowFeelingSelector(false)} />
                    <div className="absolute top-9 left-0 z-50 w-44 rounded-xl border border-gray-200 bg-white p-2 shadow-lg dark:border-gray-800 dark:bg-gray-900 grid grid-cols-2 gap-1">
                      {FEELINGS.map(f => (
                        <div
                          key={f}
                          onClick={() => {
                            setEditorFeeling(f);
                            setShowFeelingSelector(false);
                          }}
                          className="px-2 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg text-left capitalize cursor-pointer text-[11px]"
                        >
                          {f}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => setShowLocationSelector(!showLocationSelector)}
                className="relative flex h-8 items-center gap-1.5 rounded-lg px-2 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition cursor-pointer"
                title="Add Location"
              >
                <MapPin className="h-4.5 w-4.5" />
                <span className="hidden sm:inline">Check-in</span>

                {showLocationSelector && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowLocationSelector(false)} />
                    <div className="absolute top-9 left-0 z-50 w-48 rounded-xl border border-gray-200 bg-white p-2 shadow-lg dark:border-gray-800 dark:bg-gray-900 flex flex-col max-h-48 overflow-y-auto">
                      {LOCATIONS.map(l => (
                        <div
                          key={l}
                          onClick={() => {
                            setEditorLocation(l);
                            setShowLocationSelector(false);
                          }}
                          className="px-2 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg text-left cursor-pointer text-xs"
                        >
                          {l}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => setShowPollBuilder(!showPollBuilder)}
                className="flex h-8 items-center gap-1.5 rounded-lg px-2 text-xs text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-950/20 transition cursor-pointer"
                title="Create Poll"
              >
                <BarChart2 className="h-4.5 w-4.5" />
                <span className="hidden sm:inline">Poll</span>
              </button>

              <button
                type="button"
                onClick={() => setIsScheduled(!isScheduled)}
                className="flex h-8 items-center gap-1.5 rounded-lg px-2 text-xs text-pink-500 hover:bg-pink-50 dark:hover:bg-pink-950/20 transition cursor-pointer"
                title="Schedule Post"
              >
                <Calendar className="h-4.5 w-4.5" />
                <span className="hidden sm:inline">Schedule</span>
              </button>
            </div>

            {/* Privacy and Posting */}
            <div className="flex items-center gap-2">
              <select
                value={editorPrivacy}
                onChange={(e: any) => setEditorPrivacy(e.target.value)}
                className="rounded-lg border border-gray-200 bg-transparent px-2.5 py-1 text-xs text-gray-500 focus:outline-hidden dark:border-gray-800 dark:text-gray-400"
              >
                <option value="Public">🌎 Public</option>
                <option value="Friends">👥 Friends</option>
                <option value="Only Me">🔒 Only Me</option>
              </select>

              <button
                type="button"
                onClick={() => setIsDraft(!isDraft)}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold cursor-pointer border ${
                  isDraft
                    ? 'border-orange-500 text-orange-500 bg-orange-50/10'
                    : 'border-gray-200 text-gray-500 dark:border-gray-800'
                }`}
              >
                {isDraft ? '✓ Draft' : 'Save Draft'}
              </button>

              <button
                type="submit"
                disabled={isPublishing}
                className="rounded-lg bg-[#1877F2] px-4 py-1 text-xs font-bold text-white hover:bg-blue-600 cursor-pointer active:scale-95 transition disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:bg-[#1877F2]"
              >
                {isPublishing ? 'Publishing...' : 'Publish'}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* 3. POST FILTER SELECTORS */}
      <div className="flex items-center justify-between border-b border-gray-200 pb-2 dark:border-gray-800">
        <div className="flex gap-1.5">
          <button
            onClick={() => setActiveFilter('all')}
            className={`rounded-lg px-3 py-1 text-xs font-bold cursor-pointer transition ${
              activeFilter === 'all'
                ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400'
                : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-900'
            }`}
          >
            All Feed
          </button>
          <button
            onClick={() => setActiveFilter('drafts')}
            className={`rounded-lg px-3 py-1 text-xs font-bold cursor-pointer transition ${
              activeFilter === 'drafts'
                ? 'bg-orange-50 text-orange-600 dark:bg-orange-950/40 dark:text-orange-400'
                : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-900'
            }`}
          >
            Drafts ({draftsCount})
          </button>
          <button
            onClick={() => setActiveFilter('scheduled')}
            className={`rounded-lg px-3 py-1 text-xs font-bold cursor-pointer transition ${
              activeFilter === 'scheduled'
                ? 'bg-pink-50 text-pink-600 dark:bg-pink-950/40 dark:text-pink-400'
                : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-900'
            }`}
          >
            Scheduled ({scheduledCount})
          </button>
        </div>
        <span className="text-[10px] font-semibold text-gray-400">
          Showing {filteredPosts.length} posts
        </span>
      </div>

      {/* 4. POST FEED LIST */}
      <div className="space-y-4">
        {loading ? (
          <div className="space-y-4 animate-pulse">
            {[1, 2].map(n => (
              <div key={n} className="rounded-2xl bg-white p-4 dark:bg-gray-900 h-44 border border-gray-200 dark:border-gray-800" />
            ))}
          </div>
        ) : filteredPosts.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-200 p-8 text-center text-sm text-gray-500 dark:border-gray-800">
            No posts found in this section. Put something amazing on your mind!
          </div>
        ) : (
          filteredPosts.map((post) => {
            const reactions = post.reactions || {};
            const hasReacted = reactions[currentUser.id];
            const reactionKeys = Object.values(reactions);
            const totalReactions = reactionKeys.length;

            return (
              <div
                key={post.id}
                className="relative rounded-2xl border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-800 dark:bg-gray-900 transition-colors duration-200"
              >
                {/* Post Header */}
                <div className="flex items-start justify-between">
                  <div
                    onClick={() => onNavigate('profile', post.userId)}
                    className="flex cursor-pointer gap-3"
                  >
                    <img loading="lazy"
                      src={(post.userId === currentUser.id ? (currentUser.profilePic || post.userAvatar) : post.userAvatar) || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'}
                      alt={post.username}
                      referrerPolicy="no-referrer"
                      className="h-10 w-10 rounded-full object-cover border border-gray-100 dark:border-gray-800"
                    />
                    <div>
                      <div className="flex items-center gap-1 text-sm font-semibold text-gray-900 dark:text-gray-100">
                        <span>{post.username}</span>
                        {post.verifyBadge && (
                          <Shield className="h-3.5 w-3.5 fill-blue-500 text-white" />
                        )}
                        {post.feeling && (
                          <span className="text-xs font-normal text-gray-500 dark:text-gray-400">
                            is feeling <span className="font-medium text-amber-600 capitalize">{post.feeling}</span>
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">
                        <span>
                          {new Date(post.createdAt).toLocaleDateString()} at{' '}
                          {new Date(post.createdAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                        <span>•</span>
                        {post.privacy === 'Public' && <Globe className="h-3 w-3" />}
                        {post.privacy === 'Friends' && <Users className="h-3 w-3" />}
                        {post.privacy === 'Only Me' && <Lock className="h-3 w-3" />}
                        {post.isPinned && (
                          <span className="flex items-center gap-0.5 rounded-sm bg-blue-50 px-1 py-0.2 text-blue-600 dark:bg-blue-950/40">
                            <Pin className="h-2.5 w-2.5 fill-blue-600" /> Pinned
                          </span>
                        )}
                        {post.scheduledTime && (
                          <span className="rounded-sm bg-pink-50 px-1 py-0.2 text-pink-600 dark:bg-pink-950/40">
                            Scheduled
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Settings toggle */}
                  <div className="relative">
                    <button
                      onClick={() => setOpenPostSettingsId(openPostSettingsId === post.id ? null : post.id)}
                      className="rounded-full p-1.5 hover:bg-gray-100 text-gray-500 dark:hover:bg-gray-800 dark:text-gray-400"
                    >
                      <MoreHorizontal className="h-4.5 w-4.5" />
                    </button>

                    {openPostSettingsId === post.id && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setOpenPostSettingsId(null)} />
                        <div className="absolute right-0 top-8 z-50 w-52 rounded-xl border border-gray-200 bg-white p-1.5 shadow-lg dark:border-gray-800 dark:bg-gray-900 flex flex-col">
                          <button
                            onClick={() => {
                              handleCopyLink(post.id);
                              setOpenPostSettingsId(null);
                            }}
                            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800 cursor-pointer"
                          >
                            <Share2 className="h-3.5 w-3.5 text-gray-500" />
                            <span>Copy post link</span>
                          </button>

                          {(post.userId === currentUser.id || currentUser.role === 'admin') && (
                            <>
                              <button
                                onClick={() => {
                                  handleTogglePin(post);
                                  setOpenPostSettingsId(null);
                                }}
                                className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800 cursor-pointer"
                              >
                                <Pin className="h-3.5 w-3.5 text-gray-500" />
                                <span>{post.isPinned ? 'Unpin post' : 'Pin post to top'}</span>
                              </button>

                              <button
                                onClick={() => {
                                  handleToggleCommenting(post);
                                  setOpenPostSettingsId(null);
                                }}
                                className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800 cursor-pointer"
                              >
                                <MessageSquareOff className="h-3.5 w-3.5 text-gray-500" />
                                <span>
                                  {post.commentsDisabled ? 'Enable comments' : 'Turn off comments'}
                                </span>
                              </button>

                              <button
                                onClick={() => {
                                  handleDeletePost(post.id);
                                  setOpenPostSettingsId(null);
                                }}
                                className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/20 cursor-pointer"
                              >
                                <Trash2 className="h-3.5 w-3.5 text-red-500" />
                                <span>Delete post</span>
                              </button>
                            </>
                          )}

                          {post.userId !== currentUser.id && (
                            <button
                              onClick={() => {
                                handleReportPost(post.id);
                                setOpenPostSettingsId(null);
                              }}
                              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs text-orange-600 hover:bg-orange-50 dark:text-orange-400 dark:hover:bg-orange-950/20 cursor-pointer"
                            >
                              <Flag className="h-3.5 w-3.5 text-orange-500" />
                              <span>Report post</span>
                            </button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Post content */}
                <div className="my-3 space-y-3">
                  <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-line leading-relaxed">
                    {post.text}
                  </p>

                  {/* Location Tag */}
                  {post.location && !post.location.startsWith('Group:') && !post.location.startsWith('Page:') && (
                    <div className="flex items-center gap-1 text-xs text-red-600 dark:text-red-400 font-medium">
                      <MapPin className="h-3 w-3" />
                      <span>{post.location}</span>
                    </div>
                  )}

                  {/* Poll viewer */}
                  {post.pollOptions && post.pollOptions.length > 0 && (
                    <div className="rounded-xl border border-gray-200 p-3 space-y-2 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-950/20">
                      <span className="text-[10px] font-bold tracking-wider text-gray-400 uppercase">Poll Questionnaire</span>
                      {post.pollOptions.map((opt, oIdx) => {
                        const voters = opt.votes || [];
                        const totalVotes = post.pollOptions!.reduce((acc, c) => acc + (c.votes?.length || 0), 0);
                        const percent = totalVotes > 0 ? Math.round((voters.length / totalVotes) * 100) : 0;
                        const userVoted = voters.includes(currentUser.id);

                        return (
                          <div
                            key={oIdx}
                            onClick={() => handleVotePoll(post.id, oIdx)}
                            className={`relative overflow-hidden rounded-lg border py-2 px-3 text-xs font-semibold cursor-pointer select-none transition-all duration-150 ${
                              userVoted
                                ? 'border-blue-300 bg-blue-50/30 text-blue-700 dark:border-blue-900/50 dark:text-blue-400'
                                : 'border-gray-200 bg-white hover:bg-gray-100/50 dark:border-gray-800 dark:bg-gray-900 dark:hover:bg-gray-850'
                            }`}
                          >
                            {/* Percent fill layer */}
                            <div
                              className="absolute top-0 left-0 bottom-0 bg-blue-200/15 dark:bg-blue-800/15 transition-all duration-500"
                              style={{ width: `${percent}%` }}
                            />
                            <div className="relative flex justify-between items-center">
                              <span>{opt.text}</span>
                              <span className="text-[10px] text-gray-500">
                                {voters.length} ({percent}%)
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Media attachment */}
                  {post.mediaUrls && post.mediaUrls.length > 0 && (
                    <div className="rounded-xl overflow-hidden border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950">
                      <img loading="lazy"
                        src={post.mediaUrls[0]}
                        alt="Attachment"
                        referrerPolicy="no-referrer"
                        className="max-h-96 w-full object-contain"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800';
                        }}
                      />
                    </div>
                  )}
                </div>

                {/* Stats Counters */}
                <div className="flex items-center justify-between border-b border-gray-100 pb-2.5 text-xs text-gray-500 dark:border-gray-800/80 dark:text-gray-400">
                  <div className="flex items-center gap-1.5">
                    {totalReactions > 0 && (
                      <div className="flex -space-x-1">
                        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-500 text-[10px] text-white ring-2 ring-white dark:ring-gray-900">
                          👍
                        </div>
                        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] text-white ring-2 ring-white dark:ring-gray-900">
                          ❤️
                        </div>
                      </div>
                    )}
                    <span>
                      {totalReactions === 0
                        ? 'Be the first to react'
                        : `${totalReactions} reaction${totalReactions > 1 ? 's' : ''}`}
                    </span>
                  </div>
                  <div className="flex gap-3">
                    <span>{(post.comments || []).length} comment{(post.comments || []).length !== 1 ? 's' : ''}</span>
                    <span>0 shares</span>
                  </div>
                </div>

                {/* Actions Bar */}
                <div className="relative flex justify-between py-1 border-b border-gray-100 dark:border-gray-800/80 select-none">
                  {/* Reaction Button with Floating Picker */}
                  <div
                    onMouseEnter={() => setHoveredReactionPostId(post.id)}
                    onMouseLeave={() => setHoveredReactionPostId(null)}
                    className="relative flex-1"
                  >
                    <button
                      onClick={() => handleReactToPost(post.id, 'like')}
                      className={`flex w-full h-8 items-center justify-center gap-2 rounded-xl text-xs font-bold transition cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-850 ${
                        hasReacted
                          ? 'text-[#1877F2]'
                          : 'text-gray-600 dark:text-gray-300'
                      }`}
                    >
                      <span className="text-base">{hasReacted ? '👍' : '👍'}</span>
                      <span className="capitalize">{hasReacted || 'Like'}</span>
                    </button>

                    {hoveredReactionPostId === post.id && (
                      <div className="absolute -top-11 left-1/2 z-50 flex -translate-x-1/2 gap-1.5 rounded-full border border-gray-200 bg-white p-1.5 shadow-lg dark:border-gray-800 dark:bg-gray-900 animate-in fade-in zoom-in-95 duration-150">
                        {(['like', 'love', 'care', 'haha', 'wow', 'sad', 'angry'] as ReactionType[]).map(r => {
                          const iconMap: Record<ReactionType, string> = {
                            like: '👍', love: '❤️', care: '🥰', haha: '😆', wow: '😮', sad: '😢', angry: '😡'
                          };
                          return (
                            <button
                              key={r}
                              onClick={() => handleReactToPost(post.id, r)}
                              className="text-xl transition hover:scale-130 active:scale-95 duration-100 cursor-pointer"
                              title={r}
                            >
                              {iconMap[r]}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => handleToggleComments(post.id)}
                    className="flex flex-1 h-8 items-center justify-center gap-2 rounded-xl text-xs font-bold text-gray-600 dark:text-gray-300 transition cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-850"
                  >
                    <MessageCircle className="h-4 w-4" />
                    <span>Comment</span>
                    {(post.commentsCount || 0) > 0 && (
                      <span className="text-[10px] text-gray-400 dark:text-gray-500">({post.commentsCount})</span>
                    )}
                  </button>

                  <button
                    onClick={() => handleCopyLink(post.id)}
                    className="flex flex-1 h-8 items-center justify-center gap-2 rounded-xl text-xs font-bold text-gray-600 dark:text-gray-300 transition cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-850"
                  >
                    <Share2 className="h-4 w-4" />
                    <span>Share</span>
                  </button>
                </div>

                {/* Comments Shelf */}
                {openCommentPostId === post.id && (
                  <div className="mt-4 space-y-4 animate-in fade-in duration-200">
                    {/* List comments */}
                    <div className="space-y-3.5 max-h-80 overflow-y-auto pr-1">
                      {commentsLoadingPostId === post.id && (
                        <div className="space-y-2.5 animate-pulse">
                          <div className="h-9 w-2/3 rounded-2xl bg-gray-100 dark:bg-gray-800" />
                          <div className="h-9 w-1/2 rounded-2xl bg-gray-100 dark:bg-gray-800" />
                        </div>
                      )}
                      {(post.comments || []).map((comment, cIdx) => (
                        <div key={comment.id ? `${comment.id}-${cIdx}` : `cmt-${cIdx}`} className="space-y-2">
                          <div className="flex items-start gap-2.5">
                            <img loading="lazy"
                              src={(comment.userId === currentUser.id ? (currentUser.profilePic || comment.userAvatar) : comment.userAvatar) || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'}
                              alt={comment.username}
                              referrerPolicy="no-referrer"
                              className="h-8 w-8 rounded-full object-cover mt-0.5"
                            />
                            <div className="flex-1">
                              <div className="inline-block rounded-2xl bg-gray-100 px-3 py-2 text-xs dark:bg-gray-800 text-gray-900 dark:text-gray-100 max-w-full">
                                <span className="font-bold cursor-pointer hover:underline block mb-0.5" onClick={() => onNavigate('profile', comment.userId)}>
                                  {comment.username}
                                </span>
                                <span className="whitespace-pre-line leading-relaxed">{comment.text}</span>
                              </div>

                              {/* Comment Action Links */}
                              <div className="flex items-center gap-3 text-[10px] text-gray-400 dark:text-gray-500 mt-1 pl-1">
                                <button
                                  onClick={() => setActiveReplyCommentId(activeReplyCommentId === comment.id ? null : comment.id)}
                                  className="font-bold hover:underline cursor-pointer"
                                >
                                  Reply
                                </button>
                                <span>•</span>
                                <span>
                                  {new Date(comment.createdAt).toLocaleTimeString([], {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Nested Replies */}
                          <div className="pl-10 space-y-2.5">
                            {comment.replies && comment.replies.map((reply, rIdx) => (
                              <div key={reply.id ? `${reply.id}-${rIdx}` : `rpl-${rIdx}`} className="flex items-start gap-2.5">
                                <img loading="lazy"
                                  src={(reply.userId === currentUser.id ? (currentUser.profilePic || reply.userAvatar) : reply.userAvatar) || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'}
                                  alt={reply.username}
                                  referrerPolicy="no-referrer"
                                  className="h-7 w-7 rounded-full object-cover mt-0.5"
                                />
                                <div>
                                  <div className="inline-block rounded-2xl bg-gray-50 px-3 py-2 text-xs dark:bg-gray-850 text-gray-900 dark:text-gray-100">
                                    <span className="font-bold cursor-pointer hover:underline block mb-0.5" onClick={() => onNavigate('profile', reply.userId)}>
                                      {reply.username}
                                    </span>
                                    <span className="whitespace-pre-line leading-relaxed">{reply.text}</span>
                                  </div>
                                  <span className="block text-[10px] text-gray-400 dark:text-gray-500 mt-0.5 pl-1">
                                    {new Date(reply.createdAt).toLocaleTimeString([], {
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    })}
                                  </span>
                                </div>
                              </div>
                            ))}

                            {/* Reply Input Box */}
                            {activeReplyCommentId === comment.id && (
                              <div className="flex items-center gap-2 pt-1 animate-in slide-in-from-top-1 duration-150">
                                <input
                                  type="text"
                                  placeholder={`Reply to ${comment.username.split(' ')[0]}...`}
                                  value={replyInputs[comment.id] || ''}
                                  onChange={(e) =>
                                    setReplyInputs({ ...replyInputs, [comment.id]: e.target.value })
                                  }
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleSubmitComment(post.id, comment.id);
                                  }}
                                  className="flex-1 rounded-full border border-gray-200 bg-gray-50 px-3.5 py-1.5 text-xs focus:bg-white focus:outline-hidden dark:border-gray-800 dark:bg-gray-900 dark:text-white"
                                />
                                <button
                                  onClick={() => handleSubmitComment(post.id, comment.id)}
                                  className="rounded-full bg-blue-500 p-1.5 text-white hover:bg-blue-600 cursor-pointer"
                                >
                                  <Send className="h-3 w-3" />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* New Comment Input */}
                    {post.commentsDisabled ? (
                      <div className="rounded-xl bg-gray-50 p-3 text-center text-xs font-semibold text-gray-500 dark:bg-gray-950">
                        🔒 Commenting has been turned off for this post.
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 border-t border-gray-100 pt-3 dark:border-gray-800">
                        <img loading="lazy"
                          src={currentUser.profilePic || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'}
                          alt={currentUser.username}
                          referrerPolicy="no-referrer"
                          className="h-8 w-8 rounded-full object-cover"
                        />
                        <input
                          type="text"
                          placeholder="Write a comment..."
                          value={commentInputs[post.id] || ''}
                          onChange={(e) =>
                            setCommentInputs({ ...commentInputs, [post.id]: e.target.value })
                          }
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSubmitComment(post.id);
                          }}
                          className="flex-1 rounded-full border border-gray-200 bg-gray-50 px-3.5 py-2 text-xs focus:bg-white focus:outline-hidden dark:border-gray-800 dark:bg-gray-900 dark:text-white"
                        />
                        <button
                          onClick={() => handleSubmitComment(post.id)}
                          className="rounded-full bg-[#1877F2] p-2 text-white hover:bg-blue-600 cursor-pointer"
                        >
                          <Send className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}

        {activeFilter === 'all' && hasMore && (
          <div className="flex justify-center pt-1">
            <button
              onClick={handleLoadMore}
              disabled={loadingMore}
              className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-xs font-bold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              {loadingMore ? 'Loading...' : 'Load more posts'}
            </button>
          </div>
        )}
      </div>

      {/* 5. STORY VIEWER PORTAL */}
      {activeStoryViewer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-sm rounded-2xl overflow-hidden bg-gray-900 aspect-9/16 shadow-2xl flex flex-col justify-between">
            {/* Story bar timeline indicator */}
            <div className="absolute top-3 left-3 right-3 flex gap-1 z-50">
              <div className="h-1 flex-1 rounded-full bg-white animate-progress" style={{ animationDuration: '5s' }} />
            </div>

            {/* Story header with embedded close button to fix UI overlay issue */}
            <div className="absolute top-6 left-4 right-4 z-50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <img loading="lazy"
                  src={activeStoryViewer.userAvatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'}
                  alt={activeStoryViewer.username}
                  referrerPolicy="no-referrer"
                  className="h-10 w-10 rounded-full object-cover border border-white"
                />
                <div className="text-left">
                  <h4 className="text-sm font-bold text-white drop-shadow-sm">{activeStoryViewer.username}</h4>
                  <span className="text-[10px] text-white/70 block">
                    {new Date(activeStoryViewer.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>

              {/* Secure Close Button - Inside story card to prevent screen overlay bugs */}
              <button
                onClick={() => {
                  setActiveStoryViewer(null);
                  setShowViewersSheet(false);
                }}
                className="rounded-full bg-black/40 p-1.5 text-white hover:bg-black/60 transition cursor-pointer"
                title="Close Story"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Main story asset */}
            <img loading="lazy"
              src={activeStoryViewer.mediaUrl}
              alt="Story main content"
              className="w-full h-full object-cover"
            />

            {/* Viewer count footer - Clicking on this shows the Viewers list if current user is owner */}
            <button
              onClick={() => {
                if (activeStoryViewer.userId === currentUser.id) {
                  setShowViewersSheet(true);
                }
              }}
              className={`absolute bottom-4 left-4 text-xs font-bold text-white drop-shadow-sm flex items-center gap-1.5 bg-black/40 px-3 py-2 rounded-full hover:bg-black/60 transition cursor-pointer ${
                activeStoryViewer.userId === currentUser.id ? 'hover:scale-105 active:scale-95' : ''
              }`}
            >
              <Eye className="h-3.5 w-3.5" />
              <span>{activeStoryViewer.seenBy.length} {activeStoryViewer.seenBy.length === 1 ? 'view' : 'views'}</span>
              {activeStoryViewer.userId === currentUser.id && (
                <span className="text-[9px] bg-blue-500/80 text-white px-1.5 py-0.5 rounded-full font-medium ml-1">
                  Viewers List
                </span>
              )}
            </button>

            {/* Slide-up viewers list sheet for story owner */}
            {showViewersSheet && activeStoryViewer.userId === currentUser.id && (
              <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gray-900 border-t border-gray-800 text-white rounded-t-2xl z-50 flex flex-col p-4 animate-in slide-in-from-bottom duration-250">
                <div className="flex items-center justify-between border-b border-gray-800 pb-2 mb-3">
                  <h5 className="font-bold text-sm text-gray-100 flex items-center gap-1.5">
                    <Users className="h-4 w-4 text-blue-400" />
                    <span>Story Viewers ({activeStoryViewer.seenBy.length})</span>
                  </h5>
                  <button 
                    onClick={() => setShowViewersSheet(false)}
                    className="p-1 text-gray-400 hover:text-white rounded-full bg-gray-800/60 cursor-pointer"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto space-y-3 pr-1 scrollbar-thin scrollbar-thumb-gray-800 text-left">
                  {(!activeStoryViewer.seenDetails || activeStoryViewer.seenDetails.length === 0) ? (
                    <div className="flex flex-col items-center justify-center h-full text-center p-4">
                      <Eye className="h-8 w-8 text-gray-600 mb-2" />
                      <p className="text-xs text-gray-400">No viewers yet</p>
                    </div>
                  ) : (
                    activeStoryViewer.seenDetails.map((viewer) => (
                      <div key={viewer.userId} className="flex items-center justify-between p-1 hover:bg-white/5 rounded-lg transition">
                        <div className="flex items-center gap-2.5">
                          <img loading="lazy" 
                            src={viewer.userAvatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'} 
                            alt={viewer.username} 
                            className="h-8 w-8 rounded-full object-cover border border-gray-700"
                            referrerPolicy="no-referrer"
                          />
                          <div>
                            <span className="text-xs font-semibold block text-gray-200">{viewer.username}</span>
                            <span className="text-[10px] text-gray-400 block">
                              {new Date(viewer.seenAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {new Date(viewer.seenAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 6. STORY CREATOR MODAL */}
      {showCreateStoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-2xl border border-gray-100 bg-white p-5 shadow-2xl dark:border-gray-800 dark:bg-gray-900 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-4 dark:border-gray-800">
              <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">Create a Story</h3>
              <button
                type="button"
                onClick={() => setShowCreateStoryModal(false)}
                className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300 transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handlePublishStory} className="space-y-4">
              {/* Option 1: File Upload */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-gray-500 block">Upload Story Photo</span>
                <input
                  type="file"
                  ref={storyFileInputRef}
                  onChange={handleStoryFileChange}
                  accept="image/*"
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => storyFileInputRef.current?.click()}
                  className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-gray-200 bg-gray-50/50 py-6 hover:bg-gray-100 dark:border-gray-800 dark:bg-gray-950/40 dark:hover:bg-gray-950/80 transition cursor-pointer"
                >
                  <ImageIcon className="h-6 w-6 text-blue-500" />
                  <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                    Click to select an image file
                  </span>
                  <span className="text-[10px] text-gray-400">PNG, JPG or WEBP formats</span>
                </button>
              </div>

              {/* Or Divider */}
              <div className="relative flex py-2 items-center">
                <div className="flex-grow border-t border-gray-100 dark:border-gray-850"></div>
                <span className="flex-shrink mx-3 text-gray-400 text-[10px] font-bold uppercase tracking-wider">or</span>
                <div className="flex-grow border-t border-gray-100 dark:border-gray-850"></div>
              </div>

              {/* Option 2: Image URL */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-500 block">Image URL</label>
                <input
                  type="text"
                  placeholder="Paste any web image URL (e.g. from Unsplash)..."
                  value={storyImageUrl}
                  onChange={(e) => setStoryImageUrl(e.target.value)}
                  className="w-full rounded-xl border border-gray-100 bg-gray-50/50 px-3.5 py-2.5 text-xs focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-blue-500 dark:border-gray-800 dark:bg-gray-950 dark:text-white"
                />
              </div>

              {/* Preview image */}
              {storyImageUrl && (
                <div className="relative rounded-xl overflow-hidden border border-gray-200 dark:border-gray-800 max-h-48 bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
                  <img src={storyImageUrl} alt="Story preview" referrerPolicy="no-referrer" className="max-h-48 object-contain rounded-lg" />
                  <button
                    type="button"
                    onClick={() => setStoryImageUrl('')}
                    className="absolute top-2 right-2 rounded-full bg-gray-900/60 p-1.5 text-white hover:bg-gray-900 transition cursor-pointer"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}

              {/* Footer Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-gray-100 dark:border-gray-800">
                <button
                  type="button"
                  onClick={() => setShowCreateStoryModal(false)}
                  className="rounded-xl border border-gray-200 px-4 py-2.5 text-xs font-bold text-gray-700 hover:bg-gray-50 dark:border-gray-800 dark:text-gray-300 dark:hover:bg-gray-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={storyUploading || !storyImageUrl}
                  className={`rounded-xl px-5 py-2.5 text-xs font-bold text-white shadow-sm transition-all duration-150 flex items-center gap-1.5 ${
                    storyUploading || !storyImageUrl
                      ? 'bg-blue-300 cursor-not-allowed dark:bg-blue-900/40 dark:text-gray-500'
                      : 'bg-blue-600 hover:bg-blue-700 active:scale-95 cursor-pointer'
                  }`}
                >
                  {storyUploading ? 'Processing...' : 'Share to Story'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
