/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface ToastOptions {
  title?: string;
  avatar?: string;
  type?: 'friend_request' | 'info' | 'success' | 'warning' | 'error';
  senderId?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function showToast(message: string, options?: ToastOptions) {
  const event = new CustomEvent('show-toast', {
    detail: { message, options }
  });
  window.dispatchEvent(event);
}
