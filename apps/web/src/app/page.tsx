'use client';

import { useEffect, useRef, useState } from 'react';
import { useInView } from 'react-intersection-observer';
import { motion } from 'framer-motion';
import { Loader2, Flame, Sparkles } from 'lucide-react';
import { PostCard } from '@/components/post/post-card';
import { Sidebar } from '@/components/layout/sidebar';
import { PostDetailModal } from '@/components/modals/post-detail-modal';
import { useFeed } from '@/hooks/use-feed';
import { useAuthStore } from '@/store/auth.store';

export default function HomePage() {
  const { isAuthenticated, user } = useAuthStore();
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const { ref: loadMoreRef, inView } = useInView({ threshold: 0.1 });
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
  } = useFeed();

  useEffect(() => {
    if (inView && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage]);

  const posts = data?.pages.flatMap((p) => p.items) ?? [];

  if (!isAuthenticated) {
    return <LandingPage />;
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 lg:ml-60 pt-4 flex justify-center px-4 pb-24 lg:pb-8">
        <div className="w-full max-w-[468px]">
          {/* Stories bar placeholder */}
          <StoriesBar />

          {/* Feed */}
          {isLoading ? (
            <FeedSkeleton />
          ) : isError ? (
            <div className="text-center py-12 text-muted-foreground">
              Failed to load feed. Please try again.
            </div>
          ) : posts.length === 0 ? (
            <EmptyFeed />
          ) : (
            <div className="space-y-1">
              {posts.map((post, i) => (
                <motion.div
                  key={post.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.05, 0.3) }}
                >
                  <PostCard
                    post={post}
                    priority={i < 2}
                    onCommentClick={() => setSelectedPostId(post.id)}
                  />
                </motion.div>
              ))}
            </div>
          )}

          {/* Infinite scroll trigger */}
          <div ref={loadMoreRef} className="py-8 flex justify-center">
            {isFetchingNextPage && (
              <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
            )}
            {!hasNextPage && posts.length > 0 && (
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                You're all caught up!
              </p>
            )}
          </div>
        </div>
      </main>

      <PostDetailModal
        postId={selectedPostId}
        open={!!selectedPostId}
        onClose={() => setSelectedPostId(null)}
      />
    </div>
  );
}

function StoriesBar() {
  return (
    <div className="flex gap-3 px-1 py-4 overflow-x-auto scrollbar-hide">
      {Array.from({ length: 7 }).map((_, i) => (
        <div key={i} className="flex flex-col items-center gap-1.5 flex-shrink-0">
          <div
            className="w-14 h-14 rounded-full p-[2px]"
            style={{
              background: i === 0 ? '#e5e7eb' : 'linear-gradient(135deg, #f97316, #e11d48)',
            }}
          >
            <div className="w-full h-full rounded-full bg-secondary" />
          </div>
          <span className="text-[11px] text-muted-foreground w-14 text-center truncate">
            {i === 0 ? 'Your story' : `user_${i}`}
          </span>
        </div>
      ))}
    </div>
  );
}

function FeedSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="card-flint animate-pulse">
          <div className="flex items-center gap-3 p-4">
            <div className="w-9 h-9 rounded-full bg-secondary" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-24 bg-secondary rounded" />
              <div className="h-2 w-16 bg-secondary rounded" />
            </div>
          </div>
          <div className="aspect-square bg-secondary" />
          <div className="p-4 space-y-2">
            <div className="h-3 w-32 bg-secondary rounded" />
            <div className="h-3 w-full bg-secondary rounded" />
            <div className="h-3 w-3/4 bg-secondary rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyFeed() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
      <div className="w-20 h-20 spark-gradient rounded-2xl flex items-center justify-center shadow-lg shadow-spark-500/20">
        <Flame className="w-10 h-10 text-white" />
      </div>
      <div>
        <h2 className="text-lg font-bold mb-2">Your feed is empty</h2>
        <p className="text-sm text-muted-foreground max-w-xs">
          Follow people to see their posts here. Explore trending content to get started.
        </p>
      </div>
      <a href="/explore" className="btn-spark mt-2">
        Explore Flint
      </a>
    </div>
  );
}

function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-16 text-center space-y-8">
      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="space-y-6"
      >
        <div className="w-20 h-20 spark-gradient rounded-3xl flex items-center justify-center mx-auto shadow-2xl shadow-spark-500/30 animate-pulse-spark">
          <Flame className="w-10 h-10 text-white" strokeWidth={2.5} />
        </div>
        <h1 className="text-5xl sm:text-7xl font-bold font-display tracking-tight">
          <span className="spark-text">Flint</span>
        </h1>
        <p className="text-xl sm:text-2xl text-muted-foreground max-w-lg font-light">
          Share your spark. Connect through moments.
        </p>
        <div className="flex items-center justify-center gap-4 flex-wrap">
          <a href="/signup" className="btn-spark text-base px-8 py-3" id="hero-signup-btn">
            Get started
          </a>
          <a href="/login" className="btn-ghost border border-border text-base px-8 py-3" id="hero-login-btn">
            Log in
          </a>
        </div>
      </motion.div>
    </div>
  );
}
