import { useQuery } from '@tanstack/react-query';
import { flintApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';

export function useUnreadNotifications() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: () => flintApi.notifications.unreadCount().then((r) => r.data),
    enabled: isAuthenticated,
    refetchInterval: 30_000, // poll every 30s
  });
}

export function useNotifications(cursor?: string) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return useQuery({
    queryKey: ['notifications', cursor],
    queryFn: () => flintApi.notifications.list(cursor).then((r) => r.data.data),
    enabled: isAuthenticated,
  });
}
