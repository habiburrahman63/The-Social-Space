/**
 * Presence utility functions for Social Space
 */

export function isUserOnline(lastActiveAt?: string | null): boolean {
  if (!lastActiveAt) return false;
  const lastActive = new Date(lastActiveAt).getTime();
  const now = Date.now();
  // Active within the last 20 seconds is considered online
  return (now - lastActive) < 20000;
}

export function formatLastSeen(lastActiveAt?: string | null): string {
  if (!lastActiveAt) return 'Offline';
  
  const lastActive = new Date(lastActiveAt);
  const now = new Date();
  const diffMs = now.getTime() - lastActive.getTime();
  
  if (diffMs < 20000) {
    return 'Online';
  }

  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) {
    return 'Last seen just now';
  }
  if (diffMins < 60) {
    return `Last seen ${diffMins} ${diffMins === 1 ? 'minute' : 'minutes'} ago`;
  }

  const diffHours = Math.floor(diffMins / 60);
  const isSameDay = lastActive.getDate() === now.getDate() && 
                    lastActive.getMonth() === now.getMonth() && 
                    lastActive.getFullYear() === now.getFullYear();

  const timeStr = lastActive.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  if (diffHours < 24 && isSameDay) {
    return `Last seen today at ${timeStr}`;
  }

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = lastActive.getDate() === yesterday.getDate() && 
                      lastActive.getMonth() === yesterday.getMonth() && 
                      lastActive.getFullYear() === yesterday.getFullYear();

  if (isYesterday) {
    return `Last seen yesterday at ${timeStr}`;
  }

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) {
    return `Last seen ${diffDays} days ago`;
  }

  return `Last seen on ${lastActive.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}`;
}
