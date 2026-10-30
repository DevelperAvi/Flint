import { useInfiniteQuery } from '@tanstack/react-query';
import { flintApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';

export function useFeed() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return useInfiniteQuery({
    queryKey: ['feed'],
    queryFn: ({ pageParam }) =>
      flintApi.feed.getHomeFeed(pageParam as string | undefined).then((r) => r.data.data),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: isAuthenticated,
  });
}
