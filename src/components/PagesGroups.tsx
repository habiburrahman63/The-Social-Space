/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Flag, Users, Plus, Shield, Globe, Lock, X } from 'lucide-react';
import { Page, Group, User } from '../types';
import { api } from '../utils/api';

interface PagesGroupsProps {
  currentUser: User;
  onNavigate: (view: string, targetId?: string) => void;
  initialSection?: 'pages' | 'groups';
}

export default function PagesGroups({ currentUser, onNavigate, initialSection = 'pages' }: PagesGroupsProps) {
  const [activeTab, setActiveTab] = useState<'pages' | 'groups'>(initialSection);
  const [pages, setPages] = useState<Page[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals state
  const [showPageModal, setShowPageModal] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);

  // Page Form State
  const [pageName, setPageName] = useState('');
  const [pageCategory, setPageCategory] = useState('Design & Tech');
  const [pageBio, setPageBio] = useState('');
  const [pagePic, setPagePic] = useState('');

  // Group Form State
  const [groupName, setGroupName] = useState('');
  const [groupDesc, setGroupDesc] = useState('');
  const [groupPrivacy, setGroupPrivacy] = useState<'public' | 'private'>('public');

  const fetchData = async () => {
    try {
      setLoading(true);
      const pagesRes = await api.get('/api/pages');
      setPages(pagesRes.pages || []);

      const groupsRes = await api.get('/api/groups');
      setGroups(groupsRes.groups || []);
    } catch (_) {
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreatePage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pageName) return;

    try {
      await api.post('/api/pages', {
        name: pageName,
        category: pageCategory,
        bio: pageBio,
        profilePic: pagePic || undefined
      });

      setPageName('');
      setPageBio('');
      setPagePic('');
      setShowPageModal(false);
      fetchData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupName) return;

    try {
      await api.post('/api/groups', {
        name: groupName,
        description: groupDesc,
        privacy: groupPrivacy
      });

      setGroupName('');
      setGroupDesc('');
      setShowGroupModal(false);
      fetchData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleFollowPage = async (id: string) => {
    try {
      const res = await api.post(`/api/pages/${id}/follow`);
      if (res?.followers) {
        setPages(prev => prev.map(p => p.id === id ? { ...p, followers: res.followers, followersCount: res.followers.length } : p));
      }
    } catch (_) {}
  };

  const handleJoinGroup = async (id: string) => {
    try {
      const res = await api.post(`/api/groups/${id}/join`);
      if (res?.members) {
        setGroups(prev => prev.map(g => g.id === id ? { ...g, members: res.members } : g));
      }
    } catch (_) {}
  };

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6 md:px-6 max-w-4xl mx-auto space-y-6 bg-gray-50/30 dark:bg-gray-950 transition-colors">
      
      {/* Tab Selectors Row */}
      <div className="flex items-center justify-between border-b border-gray-100 pb-2.5 dark:border-gray-800">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('pages')}
            className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold transition shrink-0 cursor-pointer ${
              activeTab === 'pages'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-900'
            }`}
          >
            <Flag className="h-4 w-4" />
            <span>Pages Discover</span>
          </button>
          
          <button
            onClick={() => setActiveTab('groups')}
            className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold transition shrink-0 cursor-pointer ${
              activeTab === 'groups'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-900'
            }`}
          >
            <Users className="h-4 w-4" />
            <span>Groups Hub</span>
          </button>
        </div>

        {activeTab === 'pages' ? (
          <button
            onClick={() => setShowPageModal(true)}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-blue-700 cursor-pointer"
          >
            <Plus className="h-4.5 w-4.5" />
            <span>Create Page</span>
          </button>
        ) : (
          <button
            onClick={() => setShowGroupModal(true)}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-blue-700 cursor-pointer"
          >
            <Plus className="h-4.5 w-4.5" />
            <span>Create Group</span>
          </button>
        )}
      </div>

      {/* Pages tab stage */}
      {loading ? (
        <div className="py-12 text-center text-sm font-semibold animate-pulse">
          Syncing hubs metadata...
        </div>
      ) : activeTab === 'pages' ? (
        <div className="space-y-4 animate-in fade-in">
          {pages.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-200 p-12 text-center text-sm text-gray-400 dark:border-gray-800">
              No pages have been registered yet. Create your custom brand page above!
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {pages.map(page => {
                const isFollowing = (page.followers || []).includes(currentUser.id);
                return (
                  <div
                    key={page.id}
                    className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-xs dark:border-gray-800 dark:bg-gray-900 flex flex-col justify-between"
                  >
                    <div className="h-24 bg-gray-100 dark:bg-gray-950 relative">
                      <img loading="lazy"
                        src={page.coverPhoto || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800'}
                        alt="Page cover"
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                      <img loading="lazy"
                        src={page.profilePic || `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(page.name)}`}
                        alt="Page profile"
                        referrerPolicy="no-referrer"
                        className="absolute -bottom-6 left-4 h-14 w-14 rounded-xl border-2 border-white object-cover shadow-xs bg-white dark:border-gray-900"
                      />
                    </div>

                    <div className="p-4 pt-8 space-y-2 flex-1 flex flex-col justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1">
                          <h4 className="text-sm font-black text-gray-900 dark:text-white">
                            {page.name}
                          </h4>
                          <Shield className="h-4 w-4 fill-blue-500 text-white" />
                        </div>
                        <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                          {page.category}
                        </span>
                        <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 leading-relaxed">
                          {page.bio}
                        </p>
                      </div>

                      <div className="border-t pt-3 flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-gray-400">
                          {page.followersCount} Follower{page.followersCount !== 1 ? 's' : ''}
                        </span>

                        <button
                          onClick={() => handleFollowPage(page.id)}
                          className={`rounded-lg px-4 py-1.5 text-xs font-bold cursor-pointer transition ${
                            isFollowing
                              ? 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                              : 'bg-blue-600 text-white hover:bg-blue-700'
                          }`}
                        >
                          {isFollowing ? '✓ Liked' : 'Like Page'}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* Groups tab stage */
        <div className="space-y-4 animate-in fade-in">
          {groups.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-200 p-12 text-center text-sm text-gray-400 dark:border-gray-800">
              No groups have been registered yet. Start a custom interest group above!
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {groups.map(group => {
                const isMember = (group.members || []).includes(currentUser.id);
                return (
                  <div
                    key={group.id}
                    className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-xs dark:border-gray-800 dark:bg-gray-900 flex flex-col justify-between"
                  >
                    <div className="h-24 bg-gray-100 dark:bg-gray-950 relative">
                      <img loading="lazy"
                        src={group.coverPhoto || 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800'}
                        alt="Group cover"
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    </div>

                    <div className="p-4 space-y-2 flex-1 flex flex-col justify-between">
                      <div className="space-y-1">
                        <h4 className="text-sm font-black text-gray-900 dark:text-white">
                          {group.name}
                        </h4>
                        <div className="flex items-center gap-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                          {group.privacy === 'public' ? (
                            <>
                              <Globe className="h-3 w-3" />
                              <span>Public Group</span>
                            </>
                          ) : (
                            <>
                              <Lock className="h-3 w-3" />
                              <span>Private Group</span>
                            </>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 leading-relaxed">
                          {group.description}
                        </p>
                      </div>

                      <div className="border-t pt-3 flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-gray-400">
                          {(group.members || []).length} Member{(group.members || []).length !== 1 ? 's' : ''}
                        </span>

                        <button
                          onClick={() => handleJoinGroup(group.id)}
                          className={`rounded-lg px-4 py-1.5 text-xs font-bold cursor-pointer transition ${
                            isMember
                              ? 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                              : 'bg-blue-600 text-white hover:bg-blue-700'
                          }`}
                        >
                          {isMember ? '✓ Joined' : 'Join Group'}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* CREATE NEW PAGE DIALOG MODAL */}
      {showPageModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl dark:bg-gray-900 border">
            <button
              onClick={() => setShowPageModal(false)}
              className="absolute top-4 right-4 rounded-full p-1 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <X className="h-5 w-5" />
            </button>

            <h2 className="text-base font-black text-gray-900 dark:text-white border-b pb-2 mb-4">Create Page Portfolio</h2>

            <form onSubmit={handleCreatePage} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-gray-500 mb-1">Page Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Gourmet Bytes, PixelVibe Studio"
                  value={pageName}
                  onChange={(e) => setPageName(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 focus:outline-hidden focus:ring-1 focus:ring-blue-500 dark:border-gray-800 dark:bg-gray-950"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-500 mb-1">Category</label>
                  <select
                    value={pageCategory}
                    onChange={(e) => setPageCategory(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 focus:outline-hidden focus:ring-1 focus:ring-blue-500 dark:border-gray-800 dark:bg-gray-950"
                  >
                    <option>Design & Tech</option>
                    <option>Food & Cooking</option>
                    <option>Hobbies & Travel</option>
                    <option>Business & Finance</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-gray-500 mb-1">Avatar Photo URL</label>
                  <input
                    type="url"
                    placeholder="https://images.unsplash.com/..."
                    value={pagePic}
                    onChange={(e) => setPagePic(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 focus:outline-hidden focus:ring-1 focus:ring-blue-500 dark:border-gray-800 dark:bg-gray-950"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-gray-500 mb-1">Brand Bio Description</label>
                <textarea
                  placeholder="Tell your brand followers what your page is all about..."
                  value={pageBio}
                  onChange={(e) => setPageBio(e.target.value)}
                  className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 focus:outline-hidden focus:ring-1 focus:ring-blue-500 dark:border-gray-800 dark:bg-gray-950"
                  rows={3}
                />
              </div>

              <div className="flex justify-end gap-2 border-t pt-4">
                <button
                  type="button"
                  onClick={() => setShowPageModal(false)}
                  className="rounded-lg bg-gray-100 px-4 py-2 font-bold hover:bg-gray-200 dark:bg-gray-800 text-gray-800 dark:text-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-blue-600 px-5 py-2 font-bold text-white hover:bg-blue-700 cursor-pointer"
                >
                  Create Page
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE NEW GROUP DIALOG MODAL */}
      {showGroupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl dark:bg-gray-900 border">
            <button
              onClick={() => setShowGroupModal(false)}
              className="absolute top-4 right-4 rounded-full p-1 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <X className="h-5 w-5" />
            </button>

            <h2 className="text-base font-black text-gray-900 dark:text-white border-b pb-2 mb-4">Create Group Forum</h2>

            <form onSubmit={handleCreateGroup} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block font-bold text-gray-500 mb-1">Group Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Hiking Lovers, React Pioneers"
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 focus:outline-hidden focus:ring-1 focus:ring-blue-500 dark:border-gray-800 dark:bg-gray-950"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block font-bold text-gray-500 mb-1">Privacy Mode</label>
                  <select
                    value={groupPrivacy}
                    onChange={(e) => setGroupPrivacy(e.target.value as any)}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 focus:outline-hidden focus:ring-1 focus:ring-blue-500 dark:border-gray-800 dark:bg-gray-950"
                  >
                    <option value="public">🌎 Public Group</option>
                    <option value="private">🔒 Private Group</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-gray-500 mb-1">Forum Description</label>
                <textarea
                  placeholder="Set boundaries, guidelines, topics of discussions for your members..."
                  value={groupDesc}
                  onChange={(e) => setGroupDesc(e.target.value)}
                  className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 focus:outline-hidden focus:ring-1 focus:ring-blue-500 dark:border-gray-800 dark:bg-gray-950"
                  rows={3}
                />
              </div>

              <div className="flex justify-end gap-2 border-t pt-4">
                <button
                  type="button"
                  onClick={() => setShowGroupModal(false)}
                  className="rounded-lg bg-gray-100 px-4 py-2 font-bold hover:bg-gray-200 dark:bg-gray-800 text-gray-800 dark:text-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-blue-600 px-5 py-2 font-bold text-white hover:bg-blue-700 cursor-pointer"
                >
                  Create Group
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
