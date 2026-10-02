/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// URL of the Backend API. Configure via VITE_API_URL in .env, e.g.:
//   VITE_API_URL=http://localhost:3000
// Falls back to same-origin ('') if not set, e.g. when Frontend and Backend
// are served together behind a reverse proxy in production.
const BASE_URL = import.meta.env.VITE_API_URL || '';

interface FetchOptions extends RequestInit {
  body?: any;
}

async function request(endpoint: string, options: FetchOptions = {}) {
  const token = localStorage.getItem('social_token');
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const config: RequestInit = {
    ...options,
    headers,
  };

  if (options.body && typeof options.body === 'object') {
    config.body = JSON.stringify(options.body);
  }

  const response = await fetch(`${BASE_URL}${endpoint}`, config);

  if (!response.ok) {
    let errorMsg = 'Something went wrong';
    try {
      const errData = await response.json();
      errorMsg = errData.error || errorMsg;
    } catch (_) {}
    throw new Error(errorMsg);
  }

  try {
    return await response.json();
  } catch (_) {
    return null;
  }
}

export const api = {
  get: (endpoint: string) => request(endpoint, { method: 'GET' }),
  post: (endpoint: string, body?: any) => request(endpoint, { method: 'POST', body }),
  put: (endpoint: string, body?: any) => request(endpoint, { method: 'PUT', body }),
  delete: (endpoint: string) => request(endpoint, { method: 'DELETE' }),
};
