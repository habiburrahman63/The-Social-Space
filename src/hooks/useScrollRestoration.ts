/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Facebook-style scroll behaviour for SPA navigation: leaving a page (e.g.
 * scrolled halfway down the Feed) and coming back to that same page restores
 * where you were, while navigating to a genuinely different/new page starts
 * at the top instead of wherever the previous page happened to be scrolled
 * to.
 *
 * Positions are kept in a plain module-level Map, not React state or
 * storage - it only needs to live for the current tab session, and a normal
 * browser refresh starting fresh (back at the top) is exactly the desired
 * behaviour anyway.
 */
import { useEffect, useLayoutEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

const scrollPositions = new Map<string, number>();

export function useScrollRestoration() {
  const location = useLocation();
  const prevKeyRef = useRef<string | null>(null);

  // Continuously remember the scroll position of whatever page is
  // currently showing, so it's available if the user navigates away and
  // comes back.
  useEffect(() => {
    const key = location.pathname;
    const handleScroll = () => {
      scrollPositions.set(key, window.scrollY);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [location.pathname]);

  // On route change, restore the remembered position for the page being
  // entered (0 if it's never been visited this session).
  useLayoutEffect(() => {
    if (prevKeyRef.current === location.pathname) return;
    prevKeyRef.current = location.pathname;
    const remembered = scrollPositions.get(location.pathname);
    window.scrollTo(0, remembered ?? 0);
  }, [location.pathname]);
}

export function resetScrollPosition(pathname = '/') {
  scrollPositions.set(pathname, 0);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
