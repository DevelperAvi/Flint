'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, X, Flame, Heart, MessageCircle, Play,
  BadgeCheck, Tag, Loader2, Sparkles, User,
} from 'lucide-react';
import { flintApi } from '@/lib/api';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { formatCount } from '@/lib/utils';
import { PostDetailModal } from '@/components/modals/post-detail-modal';

const POPULAR_TAGS = ['all', 'photography', 'art', 'design', 'minimalism', 'travel', 'nature', 'vibes'];

export default function ExplorePage() {
  return (
    <Suspense fallback={<div className="max-w-5xl mx-auto p-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>}>
      <ExploreContent />
    </Suspense>
  );
}

function ExploreContent() {
  const searchParams = useSearchParams();
  const urlTag = searchParams.get('tag');
  const urlQuery = searchParams.get('q');

  const [query, setQuery] = useState(urlQuery ?? '');
  const [debouncedQuery, setDebouncedQuery] = useState(urlQuery ?? '');
  const [selectedTag, setSelectedTag] = useState(urlTag ?? 'all');
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);

  useEffect(() => {
    if (urlTag) setSelectedTag(urlTag);
    if (urlQuery) {
      setQuery(urlQuery);
      setDebouncedQuery(urlQuery);
    }
  }, [urlTag, urlQuery]);

  // Debounce search query
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, 300);
    return () => clearTimeout(handler);
  }, [query]);

  // Fetch explore data
  const { data: exploreData, isLoading } = useQuery({
    queryKey: ['explore', debouncedQuery, selectedTag],
    queryFn: async () => {
      if (debouncedQuery) {
        return flintApi.explore.search(debouncedQuery).then((r) => r.data.data);
      }
      if (selectedTag && selectedTag !== 'all') {
        return flintApi.explore.getByTag(selectedTag).then((r) => r.data.data);
      }
      return flintApi.explore.getTrending().then((r) => r.data.data);
    },
  });

  const users = exploreData?.users ?? [];
  const tags = exploreData?.tags ?? [];
  const posts = exploreData?.posts ?? [];

  return (
    <div className="max-w-5xl mx-auto px-4 py-4 pb-24 lg:pb-6 space-y-6">
      {/* ── Search Bar ──────────────────────────────────────────────── */}
      <div className="relative max-w-xl mx-auto">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search creators, hashtags, or inspiration..."
          className="input-flint pl-11 pr-10 py-3 text-sm rounded-2xl w-full bg-secondary/60 focus:bg-background"
        />
        {query && (
          <button
            onClick={() => setQuery('')}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5 rounded-full"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* ── Tag Pills (When not actively searching text) ─────────────── */}
      {!debouncedQuery && (
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {POPULAR_TAGS.map((t) => {
            const isActive = selectedTag === t;
            return (
              <button
                key={t}
                onClick={() => setSelectedTag(t)}
                className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all duration-150 flex items-center gap-1.5 ${
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20'
                    : 'bg-secondary hover:bg-secondary/80 text-muted-foreground hover:text-foreground'
                }`}
              >
                {t === 'all' ? (
                  <Sparkles className="w-3.5 h-3.5" />
                ) : (
                  <Tag className="w-3.5 h-3.5" />
                )}
                <span className="capitalize">{t}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* ── Search Results (Users & Tags) ───────────────────────────── */}
      {debouncedQuery && (
        <div className="space-y-6">
          {/* User Results */}
          {users.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Accounts
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {users.map((u: any) => (
                  <Link
                    key={u.id}
                    href={`/@${u.username}`}
                    className="flex items-center gap-3 p-3 rounded-2xl card-flint hover:bg-secondary/70 transition-colors"
                  >
                    <Avatar className="w-11 h-11">
                      <AvatarImage src={u.avatarUrl} alt={u.username} />
                      <AvatarFallback>{u.username[0]?.toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1">
                        <span className="font-semibold text-sm truncate">{u.displayName || u.username}</span>
                        {u.isVerified && <BadgeCheck className="w-3.5 h-3.5 text-primary flex-shrink-0" />}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">@{u.username}</p>
                    </div>
                    <span className="text-xs text-muted-foreground font-medium">
                      {formatCount(u.followersCount ?? 0)} followers
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Tag Results */}
          {tags.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Hashtags
              </h3>
              <div className="flex flex-wrap gap-2">
                {tags.map((t: any) => (
                  <button
                    key={t.id}
                    onClick={() => {
                      setQuery('');
                      setSelectedTag(t.name);
                    }}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-secondary card-flint hover:bg-secondary/80 text-sm font-medium transition-colors"
                  >
                    <Tag className="w-4 h-4 text-primary" />
                    <span>#{t.name}</span>
                    <span className="text-xs text-muted-foreground font-normal">
                      {formatCount(t.postsCount)} posts
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {users.length === 0 && tags.length === 0 && (
            <div className="text-center py-16 text-muted-foreground space-y-2">
              <Search className="w-8 h-8 mx-auto opacity-50" />
              <p>No results found for "{debouncedQuery}"</p>
            </div>
          )}
        </div>
      )}

      {/* ── Trending / Tag Posts Grid ────────────────────────────────── */}
      <div>
        {!debouncedQuery && (
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold flex items-center gap-2">
              {selectedTag === 'all' ? (
                <>
                  <Flame className="w-4 h-4 text-primary" />
                  Trending on Flint
                </>
              ) : (
                <>
                  <Tag className="w-4 h-4 text-primary" />
                  #{selectedTag}
                </>
              )}
            </h2>
          </div>
        )}

        {isLoading ? (
          <div className="grid grid-cols-3 gap-1 sm:gap-2">
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="aspect-square bg-secondary animate-pulse rounded-lg" />
            ))}
          </div>
        ) : posts.length === 0 && !debouncedQuery ? (
          <div className="text-center py-20 text-muted-foreground space-y-2">
            <Flame className="w-8 h-8 mx-auto opacity-40" />
            <p className="text-sm">No posts to discover right now. Be the first to spark!</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-1 sm:gap-2">
            {posts.map((post: any) => (
              <div
                key={post.id}
                onClick={() => setSelectedPostId(post.id)}
                className="relative aspect-square bg-secondary rounded-lg overflow-hidden cursor-pointer group"
              >
                <Image
                  src={post.thumbnailUrl ?? post.mediaUrl}
                  alt=""
                  fill
                  className="object-cover transition-transform duration-300 group-hover:scale-105"
                  sizes="(max-width: 768px) 33vw, 300px"
                />

                {/* Video indicator */}
                {post.mediaType === 'VIDEO' && (
                  <div className="absolute top-2 right-2">
                    <Play className="w-4 h-4 text-white fill-white drop-shadow-md" />
                  </div>
                )}

                {/* Hover overlay with like & comment counts */}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center gap-4">
                  <div className="flex items-center gap-1.5 text-white text-xs sm:text-sm font-bold">
                    <Heart className="w-4 h-4 fill-white" />
                    {formatCount(post.likesCount)}
                  </div>
                  <div className="flex items-center gap-1.5 text-white text-xs sm:text-sm font-bold">
                    <MessageCircle className="w-4 h-4 fill-white" />
                    {formatCount(post.commentsCount)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <PostDetailModal
        postId={selectedPostId}
        open={!!selectedPostId}
        onClose={() => setSelectedPostId(null)}
      />
    </div>
  );
}

