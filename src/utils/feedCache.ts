/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Deliberately not a general-purpose data-fetching cache or a new state
 * management dependency - just a plain module-level variable holding the
 * last posts/stories the Feed successfully loaded. Since it lives outside
 * React state, it survives Feed unmounting when the user navigates away and
 * remounting when they come back (Home -> Profile -> Home), so the return
 * trip can render instantly from the last known data instead of a blank
 * loading state, while a normal background refetch (already the existing
 * fetchFeedData behaviour) brings it up to date right after.
 */
import { Post, Story } from '../types';

interface FeedSnapshot {
  posts: Post[];
  stories: Story[];
}

let snapshot: FeedSnapshot | null = null;

export function getFeedSnapshot(): FeedSnapshot | null {
  return snapshot;
}

export function setFeedSnapshot(posts: Post[], stories: Story[]) {
  snapshot = { posts, stories };
}
