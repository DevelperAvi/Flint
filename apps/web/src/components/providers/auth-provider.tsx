'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useAuthStore } from '@/store/auth.store';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { initialize, isAuthenticated, recordActivity, checkSessionTimeout } = useAuthStore();
  const lastEventTimeRef = useRef<number>(Date.now());

  // Initialize auth state on mount
  useEffect(() => {
    initialize();
  }, [initialize]);

  // Throttled activity recorder (at most once every 5 seconds)
  const handleUserActivity = useCallback(() => {
    const now = Date.now();
    if (now - lastEventTimeRef.current > 5000) {
      lastEventTimeRef.current = now;
      if (isAuthenticated) {
        recordActivity();
      }
    }
  }, [isAuthenticated, recordActivity]);

  // Attach global activity event listeners when authenticated
  useEffect(() => {
    if (!isAuthenticated) return;

    const events: Array<keyof WindowEventMap> = [
      'mousedown',
      'keydown',
      'touchstart',
      'scroll',
      'click',
    ];

    events.forEach((evt) => {
      window.addEventListener(evt, handleUserActivity, { passive: true });
    });

    return () => {
      events.forEach((evt) => {
        window.removeEventListener(evt, handleUserActivity);
      });
    };
  }, [isAuthenticated, handleUserActivity]);

  // Periodic session timeout checker (runs every 10 seconds)
  useEffect(() => {
    if (!isAuthenticated) return;

    const interval = setInterval(() => {
      checkSessionTimeout();
    }, 10_000);

    return () => clearInterval(interval);
  }, [isAuthenticated, checkSessionTimeout]);

  return <>{children}</>;
}
