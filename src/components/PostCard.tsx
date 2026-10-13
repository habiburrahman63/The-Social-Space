/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useCallback } from 'react';
import {
  Shield, Globe, Users, Lock, Pin, MoreHorizontal, Share2, MessageSquareOff,
  Trash2, Flag, MapPin, MessageCircle, Send, X
} from 'lucide-react';
import { Post, User, ReactionType } from '../types';

interface PostCardProps {
  post: Post;
  currentUser: User;
  onNavigate: (view: string, targetId?: string) => void;
  onReact: (postId: string, reaction: ReactionType) => void;
  onToggleComments: (postId: string) => void;
  onSubmitComment: (postId: string, parentCommentId?: string, text?: string) => void;
  onDelete: (postId: string) => void;
  onTogglePin: (post: Post) => void;
  onToggleCommenting: (post: Post) => void;
  onReport: (postId: string) => void;
  onVotePoll: (postId: string, optionIdx: number) => void;
  onCopyLink: (postId: string) => void;
  isCommentsOpen: boolean;
  isCommentsLoading: boolean;
}

const REACTION_ICONS: Record<ReactionType, string> = {
  like: '👍',
  love: '❤️',
  care: '🥰',
  haha: '😆',
  wow: '😮',
  sad: '😢',
  angry: '😡',
};

const REACTION_LIST: ReactionType[] = ['like', 'love', 'care', 'haha', 'wow', 'sad', 'angry'];

function PostCardComponent({
  post,
  currentUser,
  onNavigate,
  onReact,
  onToggleComments,
  onSubmitComment,
  onDelete,
  onTogglePin,
  onToggleCommenting,
  onReport,
  onVotePoll,
  onCopyLink,
  isCommentsOpen,
  isCommentsLoading,
}: PostCardProps) {
  // Localized UI state - changes here will ONLY re-render this specific post!
  const [isHoveredReaction, setIsHoveredReaction] = useState(false);
  const [isOpenSettings, setIsOpenSettings] = useState(false);
  const [commentInput, setCommentInput] = useState('');
  const [replyInputs, setReplyInputs] = useState<Record<string, string>>({});
  const [activeReplyCommentId, setActiveReplyCommentId] = useState<string | null>(null);

  const reactions = post.reactions || {};
  const hasReacted = reactions[currentUser.id];
  const reactionValues = Object.values(reactions);
  const totalReactions = reactionValues.length;

  const handleCommentSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!commentInput.trim()) return;
    onSubmitComment(post.id, undefined, commentInput);
    setCommentInput('');
  };

  const handleReplySubmit = (parentCommentId: string) => {
    const text = replyInputs[parentCommentId];
    if (!text || !text.trim()) return;
    onSubmitComment(post.id, parentCommentId, text);
    setReplyInputs(prev => ({ ...prev, [parentCommentId]: '' }));
    setActiveReplyCommentId(null);
  };

  return (
    <article
      className="relative rounded-2xl border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-800 dark:bg-gray-900 transition-colors duration-200"
      style={{ contentVisibility: 'auto', containIntrinsicSize: '1px 350px' }}
    >
      {/* Post Header */}
      <div className="flex items-start justify-between">
        <div
          onClick={() => onNavigate('profile', post.userId)}
          className="flex cursor-pointer gap-3"
        >
          <img
            loading="lazy"
            decoding="async"
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
            onClick={() => setIsOpenSettings(!isOpenSettings)}
            className="rounded-full p-1.5 hover:bg-gray-100 text-gray-500 dark:hover:bg-gray-800 dark:text-gray-400 cursor-pointer"
            aria-label="Post options"
          >
            <MoreHorizontal className="h-4.5 w-4.5" />
          </button>

          {isOpenSettings && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setIsOpenSettings(false)} />
              <div className="absolute right-0 top-8 z-50 w-52 rounded-xl border border-gray-200 bg-white p-1.5 shadow-lg dark:border-gray-800 dark:bg-gray-900 flex flex-col">
                <button
                  onClick={() => {
                    onCopyLink(post.id);
                    setIsOpenSettings(false);
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
                        onTogglePin(post);
                        setIsOpenSettings(false);
                      }}
                      className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800 cursor-pointer"
                    >
                      <Pin className="h-3.5 w-3.5 text-gray-500" />
                      <span>{post.isPinned ? 'Unpin post' : 'Pin post to top'}</span>
                    </button>

                    <button
                      onClick={() => {
                        onToggleCommenting(post);
                        setIsOpenSettings(false);
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
                        onDelete(post.id);
                        setIsOpenSettings(false);
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
                      onReport(post.id);
                      setIsOpenSettings(false);
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
        {post.text && (
          <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-line leading-relaxed">
            {post.text}
          </p>
        )}

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
              const pollTotal = post.pollOptions!.reduce((acc, c) => acc + (c.votes?.length || 0), 0);
              const percent = pollTotal > 0 ? Math.round((voters.length / pollTotal) * 100) : 0;
              const userVoted = voters.includes(currentUser.id);

              return (
                <div
                  key={oIdx}
                  onClick={() => onVotePoll(post.id, oIdx)}
                  className={`relative overflow-hidden rounded-lg border py-2 px-3 text-xs font-semibold cursor-pointer select-none transition-all duration-150 ${
                    userVoted
                      ? 'border-blue-300 bg-blue-50/30 text-blue-700 dark:border-blue-900/50 dark:text-blue-400'
                      : 'border-gray-200 bg-white hover:bg-gray-100/50 dark:border-gray-800 dark:bg-gray-900 dark:hover:bg-gray-850'
                  }`}
                >
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
            <img
              loading="lazy"
              decoding="async"
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
          <span>{post.commentsCount ?? (post.comments || []).length} comment{(post.commentsCount ?? (post.comments || []).length) !== 1 ? 's' : ''}</span>
          <span>0 shares</span>
        </div>
      </div>

      {/* Actions Bar */}
      <div className="relative flex justify-between py-1 border-b border-gray-100 dark:border-gray-800/80 select-none">
        {/* Reaction Button with Floating Picker */}
        <div
          onMouseEnter={() => setIsHoveredReaction(true)}
          onMouseLeave={() => setIsHoveredReaction(false)}
          className="relative flex-1"
        >
          <button
            onClick={() => onReact(post.id, 'like')}
            className={`flex w-full h-8 items-center justify-center gap-2 rounded-xl text-xs font-bold transition cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-850 ${
              hasReacted
                ? 'text-[#1877F2]'
                : 'text-gray-600 dark:text-gray-300'
            }`}
          >
            <span className="text-base">{hasReacted ? (REACTION_ICONS[hasReacted] || '👍') : '👍'}</span>
            <span className="capitalize">{hasReacted || 'Like'}</span>
          </button>

          {isHoveredReaction && (
            <div className="absolute -top-11 left-1/2 z-50 flex -translate-x-1/2 gap-1.5 rounded-full border border-gray-200 bg-white p-1.5 shadow-lg dark:border-gray-800 dark:bg-gray-900 animate-in fade-in zoom-in-95 duration-150">
              {REACTION_LIST.map(r => (
                <button
                  key={r}
                  onClick={() => {
                    onReact(post.id, r);
                    setIsHoveredReaction(false);
                  }}
                  className="text-xl transition hover:scale-130 active:scale-95 duration-100 cursor-pointer"
                  title={r}
                >
                  {REACTION_ICONS[r]}
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={() => onToggleComments(post.id)}
          className="flex flex-1 h-8 items-center justify-center gap-2 rounded-xl text-xs font-bold text-gray-600 dark:text-gray-300 transition cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-850"
        >
          <MessageCircle className="h-4 w-4" />
          <span>Comment</span>
          {(post.commentsCount || 0) > 0 && (
            <span className="text-[10px] text-gray-400 dark:text-gray-500">({post.commentsCount})</span>
          )}
        </button>

        <button
          onClick={() => onCopyLink(post.id)}
          className="flex flex-1 h-8 items-center justify-center gap-2 rounded-xl text-xs font-bold text-gray-600 dark:text-gray-300 transition cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-850"
        >
          <Share2 className="h-4 w-4" />
          <span>Share</span>
        </button>
      </div>

      {/* Comments Shelf */}
      {isCommentsOpen && (
        <div className="mt-4 space-y-4 animate-in fade-in duration-200">
          {/* List comments */}
          <div className="space-y-3.5 max-h-80 overflow-y-auto pr-1">
            {isCommentsLoading && (
              <div className="space-y-2.5 animate-pulse">
                <div className="h-9 w-2/3 rounded-2xl bg-gray-100 dark:bg-gray-800" />
                <div className="h-9 w-1/2 rounded-2xl bg-gray-100 dark:bg-gray-800" />
              </div>
            )}
            {(post.comments || []).map((comment, cIdx) => (
              <div key={comment.id ? `${comment.id}-${cIdx}` : `cmt-${cIdx}`} className="space-y-2">
                <div className="flex items-start gap-2.5">
                  <img
                    loading="lazy"
                    decoding="async"
                    src={(comment.userId === currentUser.id ? (currentUser.profilePic || comment.userAvatar) : comment.userAvatar) || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'}
                    alt={comment.username}
                    referrerPolicy="no-referrer"
                    className="h-8 w-8 rounded-full object-cover mt-0.5"
                  />
                  <div className="flex-1">
                    <div className="inline-block rounded-2xl bg-gray-100 px-3 py-2 text-xs dark:bg-gray-800 text-gray-900 dark:text-gray-100 max-w-full">
                      <span
                        className="font-bold cursor-pointer hover:underline block mb-0.5"
                        onClick={() => onNavigate('profile', comment.userId)}
                      >
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
                      <img
                        loading="lazy"
                        decoding="async"
                        src={(reply.userId === currentUser.id ? (currentUser.profilePic || reply.userAvatar) : reply.userAvatar) || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'}
                        alt={reply.username}
                        referrerPolicy="no-referrer"
                        className="h-7 w-7 rounded-full object-cover mt-0.5"
                      />
                      <div>
                        <div className="inline-block rounded-2xl bg-gray-50 px-3 py-2 text-xs dark:bg-gray-855 text-gray-900 dark:text-gray-100">
                          <span
                            className="font-bold cursor-pointer hover:underline block mb-0.5"
                            onClick={() => onNavigate('profile', reply.userId)}
                          >
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
                          setReplyInputs(prev => ({ ...prev, [comment.id]: e.target.value }))
                        }
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleReplySubmit(comment.id);
                        }}
                        className="flex-1 rounded-full border border-gray-200 bg-gray-50 px-3.5 py-1.5 text-xs focus:bg-white focus:outline-hidden dark:border-gray-800 dark:bg-gray-900 dark:text-white"
                      />
                      <button
                        onClick={() => handleReplySubmit(comment.id)}
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
            <form onSubmit={handleCommentSubmit} className="flex items-center gap-2 border-t border-gray-100 pt-3 dark:border-gray-800">
              <img
                loading="lazy"
                decoding="async"
                src={currentUser.profilePic || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'}
                alt={currentUser.username}
                referrerPolicy="no-referrer"
                className="h-8 w-8 rounded-full object-cover"
              />
              <input
                type="text"
                placeholder="Write a comment..."
                value={commentInput}
                onChange={(e) => setCommentInput(e.target.value)}
                className="flex-1 rounded-full border border-gray-200 bg-gray-50 px-3.5 py-2 text-xs focus:bg-white focus:outline-hidden dark:border-gray-800 dark:bg-gray-900 dark:text-white"
              />
              <button
                type="submit"
                className="rounded-full bg-[#1877F2] p-2 text-white hover:bg-blue-600 cursor-pointer"
              >
                <Send className="h-3.5 w-3.5" />
              </button>
            </form>
          )}
        </div>
      )}
    </article>
  );
}

export const PostCard = React.memo(PostCardComponent);
export default PostCard;

