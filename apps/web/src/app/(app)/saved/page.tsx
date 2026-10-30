'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Bookmark, Heart, MessageCircle, Play, Sparkles, Loader2 } from 'lucide-react';
import { flintApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { formatCount } from '@/lib/utils';
import { PostDetailModal } from '@/components/modals/post-detail-modal';

export default function SavedPostsPage() {
  const { isAuthenticated } = useAuthStore();
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);

  const { data: savedData, isLoading } = useQuery({
    queryKey: ['saved-posts'],
    queryFn: () => flintApi.posts.getSaved().then((r) => r.data.data),
    enabled: isAuthenticated,
  });

  const posts = savedData?.items ?? [];

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 pb-24 lg:pb-8 space-y-6">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
          <Bookmark className="w-5 h-5 fill-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold font-display tracking-tight">Saved Posts</h1>
          <p className="text-sm text-muted-foreground">Only you can see what you've saved</p>
        </div>
      </div>

      {/* ── Grid ────────────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="grid grid-cols-3 gap-1 sm:gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="aspect-square bg-secondary rounded-lg animate-pulse" />
          ))}
        </div>
      ) : posts.length === 0 ? (
        <div className="text-center py-24 text-muted-foreground space-y-3">
          <div className="w-16 h-16 rounded-2xl bg-secondary/80 flex items-center justify-center mx-auto">
            <Bookmark className="w-8 h-8 opacity-40" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">Save posts for later</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-xs mx-auto">
              Save photos and videos that inspire you. When you save a post, it will appear here.
            </p>
          </div>
          <Link href="/explore" className="btn-spark inline-flex items-center gap-2 mt-2 text-sm">
            <Sparkles className="w-4 h-4" />
            Discover Posts
          </Link>
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

      <PostDetailModal
        postId={selectedPostId}
        open={!!selectedPostId}
        onClose={() => setSelectedPostId(null)}
      />
    </div>
  );
}

