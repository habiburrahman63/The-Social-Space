/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Shield, Users, AlertTriangle, ToggleLeft, Check, Trash2, Ban, Award, CheckCircle } from 'lucide-react';
import { User, Post } from '../types';
import { api } from '../utils/api';

interface ReportedPost extends Post {
  reportsCount?: number;
  reportedBy?: string[];
}

export default function AdminPanel() {
  const [users, setUsers] = useState<User[]>([]);
  const [reports, setReports] = useState<ReportedPost[]>([]);
  const [metrics, setMetrics] = useState({
    totalUsers: 0,
    totalPosts: 0,
    activeReports: 0,
  });
  const [loading, setLoading] = useState(true);

  // System Configuration state
  const [allowSignups, setAllowSignups] = useState(true);
  const [allowMedia, setAllowMedia] = useState(true);

  const fetchAdminData = async () => {
    try {
      setLoading(true);
      // Fetch users list from admin route
      const usersRes = await api.get('/api/admin/users');
      const userList = (usersRes.users || []) as User[];
      setUsers(userList);

      // Fetch reported items
      const reportsRes = await api.get('/api/admin/reports');
      const reportList = (reportsRes.reports || []) as ReportedPost[];
      setReports(reportList);

      // Derive metrics
      setMetrics({
        totalUsers: userList.length,
        totalPosts: userList.reduce((acc, curr) => acc + (curr.postsCount || 0), 0),
        activeReports: reportList.length,
      });
    } catch (_) {
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, []);

  const handleToggleLock = async (id: string) => {
    try {
      const res = await api.post(`/api/admin/users/${id}/toggle-lock`);
      if (res) setUsers(prev => prev.map(u => u.id === id ? { ...u, isLocked: !!res.isLocked } : u));
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleToggleVerify = async (id: string) => {
    try {
      const res = await api.post(`/api/admin/users/${id}/toggle-verify`);
      if (res) setUsers(prev => prev.map(u => u.id === id ? { ...u, verifyBadge: !!res.verifyBadge } : u));
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDismissReport = async (postId: string) => {
    try {
      await api.delete(`/api/admin/reports/${postId}/dismiss`);
      setReports(prev => prev.filter(r => r.id !== postId));
      setMetrics(prev => ({ ...prev, activeReports: prev.activeReports - 1 }));
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeleteReportedPost = async (postId: string) => {
    try {
      await api.delete(`/api/admin/reports/${postId}/delete`);
      setReports(prev => prev.filter(r => r.id !== postId));
      setMetrics(prev => ({ ...prev, activeReports: prev.activeReports - 1 }));
    } catch (err: any) {
      alert(err.message);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 p-8 text-center text-sm font-semibold animate-pulse">
        Syncing admin logs & telemetry...
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6 md:px-6 max-w-5xl mx-auto space-y-6 bg-gray-50/30 dark:bg-gray-950 transition-colors">
      
      {/* Header bar */}
      <div className="flex items-center gap-2 border-b border-gray-100 pb-4 dark:border-gray-800">
        <Shield className="h-6 w-6 text-red-600" />
        <h1 className="text-xl font-black text-gray-900 dark:text-white">Admin Management Console</h1>
      </div>

      {/* METRICS DASHBOARD CARDS ROW */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-xs dark:border-gray-850 dark:bg-gray-900 flex items-center gap-3.5">
          <div className="rounded-lg bg-blue-50 p-2 text-blue-600 dark:bg-blue-950/40">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Total Members</span>
            <span className="text-lg font-black text-gray-900 dark:text-white">{metrics.totalUsers}</span>
          </div>
        </div>

        <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-xs dark:border-gray-850 dark:bg-gray-900 flex items-center gap-3.5">
          <div className="rounded-lg bg-green-50 p-2 text-green-600 dark:bg-green-950/40">
            <CheckCircle className="h-5 w-5" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Posts Catalog</span>
            <span className="text-lg font-black text-gray-900 dark:text-white">{metrics.totalPosts}</span>
          </div>
        </div>

        <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-xs dark:border-gray-850 dark:bg-gray-900 flex items-center gap-3.5">
          <div className="rounded-lg bg-red-50 p-2 text-red-600 dark:bg-red-950/40">
            <AlertTriangle className="h-5 w-5 animate-pulse" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Report Queue</span>
            <span className="text-lg font-black text-red-600">{metrics.activeReports}</span>
          </div>
        </div>
      </div>

      {/* MODERATION QUEUE AND SYSTEM TOGGLES */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Reports panel (left cols) */}
        <div className="md:col-span-2 space-y-4">
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-800 dark:bg-gray-900 space-y-3">
            <h3 className="text-sm font-black text-gray-900 dark:text-gray-100 border-b pb-2 flex items-center gap-1.5">
              <AlertTriangle className="h-4.5 w-4.5 text-yellow-500" />
              <span>Reported Content Queue</span>
            </h3>

            {reports.length === 0 ? (
              <div className="py-8 text-center text-xs text-gray-400">
                Excellent! The content queue is completely clear.
              </div>
            ) : (
              <div className="space-y-3.5">
                {reports.map(report => (
                  <div
                    key={report.id}
                    className="rounded-lg border border-red-100 bg-red-50/10 p-3.5 space-y-2 dark:border-red-950/20 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <img loading="lazy" decoding="async"
                          src={report.userAvatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'}
                          alt={report.username}
                          referrerPolicy="no-referrer"
                          className="h-6.5 w-6.5 rounded-full object-cover"
                        />
                        <span className="font-bold text-gray-900 dark:text-white">
                          {report.username}
                        </span>
                      </div>
                      <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-[9px] font-extrabold text-red-600 dark:bg-red-950/50">
                        {report.reportsCount || 1} Reports
                      </span>
                    </div>

                    <p className="text-gray-800 dark:text-gray-200 leading-relaxed font-medium">
                      "{report.text}"
                    </p>

                    <div className="flex gap-2 justify-end pt-1">
                      <button
                        onClick={() => handleDismissReport(report.id)}
                        className="flex items-center gap-1 rounded-lg bg-gray-100 px-3 py-1.5 text-[10px] font-bold text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 cursor-pointer"
                      >
                        <Check className="h-3.5 w-3.5 text-green-500" />
                        <span>Dismiss</span>
                      </button>

                      <button
                        onClick={() => handleDeleteReportedPost(report.id)}
                        className="flex items-center gap-1 rounded-lg bg-red-600 px-3 py-1.5 text-[10px] font-bold text-white hover:bg-red-700 cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span>Delete Content</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Global Settings (right col) */}
        <div className="md:col-span-1 space-y-4">
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-800 dark:bg-gray-900 space-y-4 text-xs">
            <h3 className="text-sm font-black text-gray-900 dark:text-gray-100 border-b pb-2 flex items-center gap-1.5">
              <ToggleLeft className="h-4.5 w-4.5 text-blue-500" />
              <span>System Toggles</span>
            </h3>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-bold block text-gray-800 dark:text-gray-200">Signups Registry</span>
                  <span className="text-[10px] text-gray-400">Allow new users register accounts</span>
                </div>
                <input
                  type="checkbox"
                  checked={allowSignups}
                  onChange={(e) => setAllowSignups(e.target.checked)}
                  className="h-4 w-4 rounded-sm border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <span className="font-bold block text-gray-800 dark:text-gray-200">Media Attachments</span>
                  <span className="text-[10px] text-gray-400">Enable picture/audio uploads</span>
                </div>
                <input
                  type="checkbox"
                  checked={allowMedia}
                  onChange={(e) => setAllowMedia(e.target.checked)}
                  className="h-4 w-4 rounded-sm border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* USER DIRECTORY TABULAR VIEW */}
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-xs dark:border-gray-800 dark:bg-gray-900">
        <div className="p-4 border-b">
          <h3 className="text-sm font-black text-gray-900 dark:text-gray-100">User Management Table</h3>
        </div>

        <div className="overflow-x-auto text-xs">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b dark:bg-gray-950 border-gray-100 dark:border-gray-800 text-gray-400 font-bold uppercase tracking-wider text-[9px]">
                <th className="p-3">User</th>
                <th className="p-3">Email Address</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {users.map(u => (
                <tr key={u.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-900/30">
                  <td className="p-3 flex items-center gap-2.5">
                    <img loading="lazy" decoding="async"
                      src={u.profilePic || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'}
                      alt={u.username}
                      referrerPolicy="no-referrer"
                      className="h-7 w-7 rounded-full object-cover"
                    />
                    <div className="font-bold text-gray-900 dark:text-white flex items-center gap-1">
                      <span>{u.username}</span>
                      {u.verifyBadge && (
                        <span title="Verified Member" className="inline-flex">
                          <Award className="h-3.5 w-3.5 text-blue-500 fill-current" />
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="p-3 text-gray-500 font-medium">{u.email}</td>
                  <td className="p-3">
                    {u.isLocked ? (
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-[9px] font-bold text-red-600 dark:bg-red-950/50">
                        Suspended
                      </span>
                    ) : (
                      <span className="rounded-full bg-green-100 px-2 py-0.5 text-[9px] font-bold text-green-600 dark:bg-green-950/50">
                        Active
                      </span>
                    )}
                  </td>
                  <td className="p-3 text-right space-x-2">
                    <button
                      onClick={() => handleToggleVerify(u.id)}
                      className={`rounded-lg p-1.5 border transition cursor-pointer ${
                        u.verifyBadge
                          ? 'text-gray-400 border-gray-200 dark:border-gray-800'
                          : 'text-blue-600 bg-blue-50/40 border-blue-200 hover:bg-blue-50'
                      }`}
                      title={u.verifyBadge ? "Revoke Verification" : "Grant Verification Badge"}
                    >
                      <Award className="h-4 w-4" />
                    </button>

                    <button
                      onClick={() => handleToggleLock(u.id)}
                      className={`rounded-lg p-1.5 border transition cursor-pointer ${
                        u.isLocked
                          ? 'text-red-600 bg-red-50/40 border-red-200 hover:bg-red-50'
                          : 'text-gray-400 border-gray-200 dark:border-gray-800 hover:text-red-500'
                      }`}
                      title={u.isLocked ? "Unlock Profile" : "Suspend Profile"}
                    >
                      <Ban className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
