/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Single source of truth mapping the app's internal "view" names (feed,
 * profile, messenger, ...) to real URL paths. Every component already talks
 * to navigation exclusively through `onNavigate(view, targetId)` - this file
 * is what lets App.tsx turn that into an actual react-router `navigate()`
 * call (and back again when reading the current URL) without any child
 * component needing to know a URL scheme exists at all.
 */

export type ViewName =
  | 'feed'
  | 'messenger'
  | 'profile'
  | 'friends'
  | 'marketplace'
  | 'pages'
  | 'groups'
  | 'events'
  | 'admin'
  | 'settings';

// Views that take an optional :targetId in their path (profile of a
// specific user, an open conversation with a specific friend).
const PARAMETERIZED: Partial<Record<ViewName, string>> = {
  profile: '/profile',
  messenger: '/messenger',
};

const STATIC_PATHS: Record<Exclude<ViewName, 'profile' | 'messenger'>, string> = {
  feed: '/',
  friends: '/friends',
  marketplace: '/marketplace',
  pages: '/pages',
  groups: '/groups',
  events: '/events',
  admin: '/admin',
  settings: '/settings',
};

export function pathForView(view: string, targetId?: string): string {
  if (view in PARAMETERIZED) {
    const base = PARAMETERIZED[view as ViewName]!;
    return targetId ? `${base}/${targetId}` : base;
  }
  return STATIC_PATHS[view as Exclude<ViewName, 'profile' | 'messenger'>] || '/';
}

// The inverse of pathForView - given the current pathname, which "view" is
// it (so Header/Sidebar can highlight the right nav item, exactly like the
// old `activeTab` state used to do).
export function viewForPath(pathname: string): ViewName {
  if (pathname === '/' ) return 'feed';
  if (pathname.startsWith('/profile')) return 'profile';
  if (pathname.startsWith('/messenger')) return 'messenger';
  if (pathname.startsWith('/friends')) return 'friends';
  if (pathname.startsWith('/marketplace')) return 'marketplace';
  if (pathname.startsWith('/groups')) return 'groups';
  if (pathname.startsWith('/pages')) return 'pages';
  if (pathname.startsWith('/events')) return 'events';
  if (pathname.startsWith('/admin')) return 'admin';
  if (pathname.startsWith('/settings')) return 'settings';
  return 'feed';
}
