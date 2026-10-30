import axios, { type InternalAxiosRequestConfig } from 'axios';
import { AUTH_STORAGE_KEYS, clearAuthTokens, storeAuthTokens } from '@/store/auth.store';

const getBaseUrl = (): string => {
  const envUrl = process.env.NEXT_PUBLIC_API_URL;
  if (process.env.NODE_ENV === 'development') {
    return envUrl ?? 'http://localhost:3001';
  }
  if (!envUrl || envUrl.includes('flint-api.onrender.com')) {
    return 'https://flint-qmxy.onrender.com';
  }
  return envUrl;
};

export const api = axios.create({
  baseURL: getBaseUrl(),
  timeout: 15_000,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: false,
});

// ── Request interceptor: attach access token & track activity ─────────────────
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem(AUTH_STORAGE_KEYS.ACCESS_TOKEN);
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Refresh last activity timestamp on any user-initiated API interaction
    const now = Date.now();
    localStorage.setItem(AUTH_STORAGE_KEYS.LAST_ACTIVITY, now.toString());
  }
  return config;
});

// ── Response interceptor: handle token refresh ───────────────────────────────
let isRefreshing = false;
let refreshQueue: Array<(token: string) => void> = [];

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    if (!original) return Promise.reject(error);

    // If an auth endpoint like /logout gets 401, never retry or loop
    if (original.url?.includes('/api/v1/auth/logout')) {
      clearAuthTokens();
      return Promise.resolve({ data: { message: 'Logged out successfully' } });
    }

    // Don't retry refresh endpoint failures
    if (original.url?.includes('/api/v1/auth/refresh') || original.url?.includes('/api/v1/auth/login')) {
      return Promise.reject(error);
    }

    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;

      if (isRefreshing) {
        // Queue the request until the refresh completes
        return new Promise((resolve) => {
          refreshQueue.push((token) => {
            original.headers.Authorization = `Bearer ${token}`;
            resolve(api(original));
          });
        });
      }

      isRefreshing = true;
      const refreshToken = typeof window !== 'undefined'
        ? localStorage.getItem(AUTH_STORAGE_KEYS.REFRESH_TOKEN)
        : null;

      if (!refreshToken) {
        clearAuthTokens();
        if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
          window.location.href = '/login?reason=timeout';
        }
        return Promise.reject(error);
      }

      try {
        const { data } = await api.post('/api/v1/auth/refresh', { refreshToken });
        const { accessToken: newToken, refreshToken: newRefreshToken, expiresIn } = data.data;

        storeAuthTokens(newToken, newRefreshToken ?? refreshToken, expiresIn ?? 900);

        // Drain the queue
        refreshQueue.forEach((cb) => cb(newToken));
        refreshQueue = [];

        original.headers.Authorization = `Bearer ${newToken}`;
        return api(original);
      } catch {
        clearAuthTokens();
        if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
          window.location.href = '/login?reason=timeout';
        }
        return Promise.reject(error);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

// ── Typed API methods ─────────────────────────────────────────────────────────
export const flintApi = {
  auth: {
    signup: (body: { username: string; email: string; password: string; displayName?: string }) =>
      api.post('/api/v1/auth/signup', body),
    login: (body: { identifier: string; password: string }) =>
      api.post('/api/v1/auth/login', body),
    refresh: (refreshToken: string) =>
      api.post('/api/v1/auth/refresh', { refreshToken }),
    logout: (refreshToken: string) =>
      api.post('/api/v1/auth/logout', { refreshToken }),
    me: () => api.get('/api/v1/auth/me'),
  },

  media: {
    getUploadUrl: async (mimeType: string, folder = 'posts') => {
      const res = await api.get<{ data: { uploadUrl: string; key: string; publicUrl: string; expiresIn: number } }>(
        `/api/v1/media/upload-url?mimeType=${encodeURIComponent(mimeType)}&folder=${folder}`
      );
      if (process.env.NODE_ENV !== 'development' && res.data?.data) {
        if (res.data.data.uploadUrl?.includes('localhost:3001')) {
          res.data.data.uploadUrl = res.data.data.uploadUrl.replace(
            'http://localhost:3001',
            'https://flint-qmxy.onrender.com'
          );
        }
        if (res.data.data.publicUrl?.includes('localhost:3001')) {
          res.data.data.publicUrl = res.data.data.publicUrl.replace(
            'http://localhost:3001',
            'https://flint-qmxy.onrender.com'
          );
        }
      }
      return res;
    },
    uploadToS3: (uploadUrl: string, file: File, onProgress?: (pct: number) => void) => {
      const effectiveUrl =
        process.env.NODE_ENV !== 'development' && uploadUrl.includes('localhost:3001')
          ? uploadUrl.replace('http://localhost:3001', 'https://flint-qmxy.onrender.com')
          : uploadUrl;
      return axios.put(effectiveUrl, file, {
        headers: { 'Content-Type': file.type },
        onUploadProgress: (evt) => {
          if (evt.total) onProgress?.(Math.round((evt.loaded / evt.total) * 100));
        },
      });
    },
  },

  feed: {
    getHomeFeed: (cursor?: string, limit = 20) =>
      api.get(`/api/v1/feed?limit=${limit}${cursor ? `&cursor=${cursor}` : ''}`),
  },

  posts: {
    create: (body: Record<string, unknown>) => api.post('/api/v1/posts', body),
    get: (id: string) => api.get(`/api/v1/posts/${id}`),
    delete: (id: string) => api.delete(`/api/v1/posts/${id}`),
    like: (id: string) => api.post(`/api/v1/posts/${id}/like`),
    unlike: (id: string) => api.delete(`/api/v1/posts/${id}/like`),
    save: (id: string) => api.post(`/api/v1/posts/${id}/save`),
    unsave: (id: string) => api.delete(`/api/v1/posts/${id}/save`),
    getSaved: (cursor?: string, limit = 20) =>
      api.get(`/api/v1/posts/saved?limit=${limit}${cursor ? `&cursor=${cursor}` : ''}`),
    getComments: (id: string, cursor?: string) =>
      api.get(`/api/v1/posts/${id}/comments${cursor ? `?cursor=${cursor}` : ''}`),
    addComment: (id: string, content: string, parentId?: string) =>
      api.post(`/api/v1/posts/${id}/comments`, { content, parentId }),
  },

  users: {
    getProfile: (username: string) => api.get(`/api/v1/users/${username}`),
    getPosts: (username: string, cursor?: string) =>
      api.get(`/api/v1/users/${username}/posts${cursor ? `?cursor=${cursor}` : ''}`),
    getFollowers: (username: string) => api.get(`/api/v1/users/${username}/followers`),
    getFollowing: (username: string) => api.get(`/api/v1/users/${username}/following`),
    follow: (username: string) => api.post(`/api/v1/users/${username}/follow`),
    unfollow: (username: string) => api.delete(`/api/v1/users/${username}/follow`),
    search: (q: string) => api.get(`/api/v1/users/search?q=${encodeURIComponent(q)}`),
    updateProfile: (body: Record<string, unknown>) => api.patch('/api/v1/users/me', body),
  },

  explore: {
    getTrending: () => api.get('/api/v1/explore'),
    search: (q: string) => api.get(`/api/v1/explore?q=${encodeURIComponent(q)}`),
    getByTag: (tag: string) => api.get(`/api/v1/explore?tag=${encodeURIComponent(tag)}`),
  },

  notifications: {
    list: (cursor?: string) => api.get(`/api/v1/notifications${cursor ? `?cursor=${cursor}` : ''}`),
    readAll: () => api.post('/api/v1/notifications/read-all'),
    unreadCount: () => api.get('/api/v1/notifications/unread-count'),
  },
};
