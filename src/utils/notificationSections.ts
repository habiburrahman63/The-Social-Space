/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Notification } from '../types';

export type NotificationSection = 'home' | 'friends' | 'other';

// Post activity (new posts, likes, comments, replies, tags) and general
// account/system notices belong to Home. Friend-request activity (sent,
// received, or accepted) belongs to Friends. Message activity never appears
// here at all - it's tracked entirely separately via Message.isRead /
// GET /api/messages/unread/count, and the Backend never even creates
// 'message'-type Notification records, so it can't leak into this system.
const SECTION_BY_TYPE: Record<string, NotificationSection> = {
  post: 'home',
  like: 'home',
  comment: 'home',
  reply: 'home',
  tag: 'home',
  system: 'home',
  friend_request: 'friends',
  friend_accept: 'friends',
  follow: 'friends',
  invite: 'other',
};

export const HOME_NOTIFICATION_TYPES = Object.keys(SECTION_BY_TYPE).filter(t => SECTION_BY_TYPE[t] === 'home');
export const FRIENDS_NOTIFICATION_TYPES = Object.keys(SECTION_BY_TYPE).filter(t => SECTION_BY_TYPE[t] === 'friends');

export function getNotificationSection(type: string): NotificationSection {
  return SECTION_BY_TYPE[type] || 'other';
}

export function countUnreadInSection(notifications: Notification[], section: NotificationSection): number {
  return notifications.filter(n => !n.isRead && getNotificationSection(n.type) === section).length;
}
