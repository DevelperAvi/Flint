import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { flintApi } from '@/lib/api';

export const AUTH_STORAGE_KEYS = {
  ACCESS_TOKEN: 'flint_access_token',
  REFRESH_TOKEN: 'flint_refresh_token',
  TOKEN_EXPIRES_AT: 'flint_token_expires_at',
  LAST_ACTIVITY: 'flint_last_activity',
  LOGIN_TIME: 'flint_login_time',
} as const;

// Default session inactivity timeout: 15 minutes
export const DEFAULT_INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000;

/**
 * Set authentication cookie for SSR / middleware compatibility
 */
export function setAuthCookie(token: string, maxAgeSeconds = 30 * 86400) {
  if (typeof document === 'undefined') return;
  document.cookie = `${AUTH_STORAGE_KEYS.ACCESS_TOKEN}=${encodeURIComponent(token)}; path=/; max-age=${maxAgeSeconds}; SameSite=Lax`;
}

/**
 * Clear authentication cookie
 */
export function clearAuthCookie() {
  if (typeof document === 'undefined') return;
  document.cookie = `${AUTH_STORAGE_KEYS.ACCESS_TOKEN}=; path=/; max-age=0; SameSite=Lax`;
}

/**
 * Store access & refresh tokens with expiration and activity tracking
 */
export function storeAuthTokens(accessToken: string, refreshToken: string, expiresInSeconds = 900) {
  if (typeof window === 'undefined') return;
  const now = Date.now();
  const expiresAt = now + expiresInSeconds * 1000;

  localStorage.setItem(AUTH_STORAGE_KEYS.ACCESS_TOKEN, accessToken);
  localStorage.setItem(AUTH_STORAGE_KEYS.REFRESH_TOKEN, refreshToken);
  localStorage.setItem(AUTH_STORAGE_KEYS.TOKEN_EXPIRES_AT, expiresAt.toString());
  localStorage.setItem(AUTH_STORAGE_KEYS.LAST_ACTIVITY, now.toString());
  localStorage.setItem(AUTH_STORAGE_KEYS.LOGIN_TIME, now.toString());

  setAuthCookie(accessToken);
}

/**
 * Cleanly clear all tokens and cookies
 */
export function clearAuthTokens() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(AUTH_STORAGE_KEYS.ACCESS_TOKEN);
  localStorage.removeItem(AUTH_STORAGE_KEYS.REFRESH_TOKEN);
  localStorage.removeItem(AUTH_STORAGE_KEYS.TOKEN_EXPIRES_AT);
  localStorage.removeItem(AUTH_STORAGE_KEYS.LAST_ACTIVITY);
  localStorage.removeItem(AUTH_STORAGE_KEYS.LOGIN_TIME);

  clearAuthCookie();
}

interface User {
  id: string;
  username: string;
  email: string;
  displayName?: string;
  avatarUrl?: string;
  bio?: string;
  isVerified?: boolean;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  tokenExpiresAt: number | null;
  lastActivity: number | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  inactivityTimeoutMs: number;

  login: (identifier: string, password: string) => Promise<void>;
  signup: (data: { username: string; email: string; password: string; displayName?: string }) => Promise<void>;
  logout: (reason?: 'manual' | 'timeout') => Promise<void>;
  updateUser: (user: Partial<User>) => void;
  setTokens: (accessToken: string, refreshToken: string, expiresIn?: number) => void;
  recordActivity: () => void;
  checkSessionTimeout: () => boolean;
  initialize: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      tokenExpiresAt: null,
      lastActivity: null,
      isAuthenticated: false,
      isLoading: false,
      inactivityTimeoutMs: DEFAULT_INACTIVITY_TIMEOUT_MS,

      initialize: async () => {
        if (typeof window === 'undefined') return;
        const storedToken = localStorage.getItem(AUTH_STORAGE_KEYS.ACCESS_TOKEN);
        const { accessToken } = get();
        const token = accessToken || storedToken;

        if (!token) {
          clearAuthTokens();
          set({
            user: null,
            accessToken: null,
            refreshToken: null,
            tokenExpiresAt: null,
            lastActivity: null,
            isAuthenticated: false,
          });
          return;
        }

        // Check if session has timed out due to inactivity
        const lastActivityStr = localStorage.getItem(AUTH_STORAGE_KEYS.LAST_ACTIVITY);
        if (lastActivityStr) {
          const lastActivity = parseInt(lastActivityStr, 10);
          if (Date.now() - lastActivity > get().inactivityTimeoutMs) {
            await get().logout('timeout');
            return;
          }
        }

        try {
          set({ isLoading: true });
          const { data } = await flintApi.auth.me();
          const now = Date.now();
          set({
            user: data.data,
            isAuthenticated: true,
            lastActivity: now,
          });
          localStorage.setItem(AUTH_STORAGE_KEYS.LAST_ACTIVITY, now.toString());
        } catch (err: unknown) {
          // Only force logout on a real 401 Unauthorized.
          // Network/server errors should NOT clear the local session.
          const status = (err as { response?: { status?: number } })?.response?.status;
          if (status === 401) {
            await get().logout('timeout');
          } else {
            // Server temporarily unavailable — keep user logged in locally
            console.warn('[Flint] Could not verify session (server may be down):', err);
          }
        } finally {
          set({ isLoading: false });
        }
      },

      login: async (identifier, password) => {
        set({ isLoading: true });
        try {
          const { data } = await flintApi.auth.login({ identifier, password });
          const { accessToken, refreshToken, user, expiresIn } = data.data;

          const expiresInSec = expiresIn ?? 900;
          storeAuthTokens(accessToken, refreshToken, expiresInSec);
          const now = Date.now();
          const tokenExpiresAt = now + expiresInSec * 1000;

          set({
            user,
            accessToken,
            refreshToken,
            tokenExpiresAt,
            lastActivity: now,
            isAuthenticated: true,
          });
        } finally {
          set({ isLoading: false });
        }
      },

      signup: async (signupData) => {
        set({ isLoading: true });
        try {
          const { data } = await flintApi.auth.signup(signupData);
          const { accessToken, refreshToken, user, expiresIn } = data.data;

          const expiresInSec = expiresIn ?? 900;
          storeAuthTokens(accessToken, refreshToken, expiresInSec);
          const now = Date.now();
          const tokenExpiresAt = now + expiresInSec * 1000;

          set({
            user,
            accessToken,
            refreshToken,
            tokenExpiresAt,
            lastActivity: now,
            isAuthenticated: true,
          });
        } finally {
          set({ isLoading: false });
        }
      },

      logout: async (reason = 'manual') => {
        const { refreshToken } = get();
        try {
          if (refreshToken) {
            await flintApi.auth.logout(refreshToken);
          }
        } catch {
          // Best-effort logout - never block local cleanup
        } finally {
          clearAuthTokens();
          set({
            user: null,
            accessToken: null,
            refreshToken: null,
            tokenExpiresAt: null,
            lastActivity: null,
            isAuthenticated: false,
          });

          if (typeof window !== 'undefined') {
            const currentPath = window.location.pathname;
            if (currentPath !== '/login' && currentPath !== '/signup') {
              window.location.href = `/login?reason=${reason}`;
            }
          }
        }
      },

      updateUser: (updates) => {
        set((state) => ({
          user: state.user ? { ...state.user, ...updates } : null,
        }));
      },

      setTokens: (accessToken, refreshToken, expiresIn = 900) => {
        storeAuthTokens(accessToken, refreshToken, expiresIn);
        const now = Date.now();
        set({
          accessToken,
          refreshToken,
          tokenExpiresAt: now + expiresIn * 1000,
          lastActivity: now,
        });
      },

      recordActivity: () => {
        const now = Date.now();
        set({ lastActivity: now });
        if (typeof window !== 'undefined') {
          localStorage.setItem(AUTH_STORAGE_KEYS.LAST_ACTIVITY, now.toString());
        }
      },

      checkSessionTimeout: () => {
        const { isAuthenticated, lastActivity, inactivityTimeoutMs } = get();
        if (!isAuthenticated) return false;

        const storedActivity = typeof window !== 'undefined'
          ? parseInt(localStorage.getItem(AUTH_STORAGE_KEYS.LAST_ACTIVITY) ?? '0', 10)
          : (lastActivity ?? Date.now());

        const effectiveActivity = storedActivity || (lastActivity ?? Date.now());
        const isTimedOut = Date.now() - effectiveActivity > inactivityTimeoutMs;

        if (isTimedOut) {
          get().logout('timeout');
          return true;
        }
        return false;
      },
    }),
    {
      name: 'flint-auth',
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        tokenExpiresAt: state.tokenExpiresAt,
        lastActivity: state.lastActivity,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
