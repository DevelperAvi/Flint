'use client';

import { useState, useRef, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Heart, MessageCircle, Share2, Bookmark,
  Volume2, VolumeX, MoreHorizontal, Play,
  BadgeCheck,
} from 'lucide-react';
import { cn, formatRelativeTime, formatCount, getAspectRatioClass, truncateText } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { flintApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { toast } from '@/components/ui/toaster';

export interface PostData {
  id: string;
  mediaType: 'IMAGE' | 'VIDEO';
  mediaUrl: string;
  thumbnailUrl?: string;
  caption?: string;
  aspectRatio: 'SQUARE' | 'PORTRAIT' | 'REEL' | 'LANDSCAPE';
  duration?: number;
  likesCount: number;
  commentsCount: number;
  isLiked?: boolean;
  isSaved?: boolean;
  user: {
    id: string;
    username: string;
    displayName?: string;
    avatarUrl?: string;
    isVerified?: boolean;
  };
  tags?: string[];
  createdAt: string;
}

interface PostCardProps {
  post: PostData;
  onCommentClick?: () => void;
  priority?: boolean;
}

export function PostCard({ post, onCommentClick, priority = false }: PostCardProps) {
  const { isAuthenticated } = useAuthStore();
  const [isLiked, setIsLiked] = useState(post.isLiked ?? false);
  const [likesCount, setLikesCount] = useState(post.likesCount);
  const [isSaved, setIsSaved] = useState(post.isSaved ?? false);
  const [isMuted, setIsMuted] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [captionExpanded, setCaptionExpanded] = useState(false);
  const [heartAnim, setHeartAnim] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const tapTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTapRef = useRef<number>(0);

  // Double-tap to like
  const handleMediaTap = useCallback(() => {
    if (!isAuthenticated) return;
    const now = Date.now();
    const DOUBLE_TAP_DELAY = 300;

    if (now - lastTapRef.current < DOUBLE_TAP_DELAY) {
      if (tapTimeoutRef.current) clearTimeout(tapTimeoutRef.current);
      handleDoubleTap();
    } else {
      tapTimeoutRef.current = setTimeout(() => {
        // Single tap — toggle video play
        if (post.mediaType === 'VIDEO' && videoRef.current) {
          if (videoRef.current.paused) {
            videoRef.current.play();
            setIsPlaying(true);
          } else {
            videoRef.current.pause();
            setIsPlaying(false);
          }
        }
      }, DOUBLE_TAP_DELAY);
    }
    lastTapRef.current = now;
  }, [isAuthenticated, post.mediaType]);

  const handleDoubleTap = useCallback(async () => {
    if (!isLiked) {
      setIsLiked(true);
      setLikesCount((n) => n + 1);
      setHeartAnim(true);
      setTimeout(() => setHeartAnim(false), 700);
      try {
        await flintApi.posts.like(post.id);
      } catch {
        // Revert optimistic update on error
        setIsLiked(false);
        setLikesCount((n) => n - 1);
      }
    }
  }, [isLiked, post.id]);

  const handleLikeToggle = useCallback(async () => {
    if (!isAuthenticated) return;
    const prevLiked = isLiked;
    const prevCount = likesCount;

    // Optimistic update
    setIsLiked(!isLiked);
    setLikesCount((n) => (isLiked ? n - 1 : n + 1));

    try {
      if (prevLiked) {
        await flintApi.posts.unlike(post.id);
      } else {
        await flintApi.posts.like(post.id);
        setHeartAnim(true);
        setTimeout(() => setHeartAnim(false), 350);
      }
    } catch {
      // Revert
      setIsLiked(prevLiked);
      setLikesCount(prevCount);
    }
  }, [isAuthenticated, isLiked, likesCount, post.id]);

  const handleSaveToggle = useCallback(async () => {
    if (!isAuthenticated) return;
    const prevSaved = isSaved;
    setIsSaved(!isSaved);

    try {
      if (prevSaved) {
        await flintApi.posts.unsave(post.id);
      } else {
        await flintApi.posts.save(post.id);
      }
    } catch {
      setIsSaved(prevSaved);
    }
  }, [isAuthenticated, isSaved, post.id]);

  const handleShare = useCallback(async () => {
    const postUrl = typeof window !== 'undefined' ? `${window.location.origin}/p/${post.id}` : '';
    const shareData = {
      title: `Post by ${post.user.displayName || post.user.username} on Flint`,
      text: post.caption || 'Check out this post on Flint 🔥',
      url: postUrl,
    };

    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share(shareData);
        return;
      } catch (err: any) {
        if (err.name === 'AbortError') return;
      }
    }

    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(postUrl);
        toast({ title: 'Link copied to clipboard! 📋', variant: 'success' });
      } else {
        toast({ title: 'Sharing not supported on this browser', variant: 'error' });
      }
    } catch {
      toast({ title: 'Failed to copy link', variant: 'error' });
    }
  }, [post.id, post.caption, post.user.displayName, post.user.username]);

  const caption = post.caption ?? '';
  const shouldTruncate = caption.length > 125;
  const displayCaption = shouldTruncate && !captionExpanded
    ? truncateText(caption, 125)
    : caption;

  return (
    <article className="card-flint mb-4 max-w-[468px] w-full mx-auto" id={`post-${post.id}`}>
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-3">
        <Link
          href={`/@${post.user.username}`}
          className="flex items-center gap-3 group"
        >
          <Avatar className="w-9 h-9 ring-2 ring-transparent group-hover:ring-primary/40 transition-all">
            <AvatarImage src={post.user.avatarUrl ?? undefined} alt={post.user.username} />
            <AvatarFallback className="bg-spark-500/20 text-spark-400 text-sm font-bold">
              {post.user.username[0].toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div>
            <div className="flex items-center gap-1">
              <span className="text-sm font-semibold leading-none group-hover:text-primary transition-colors">
                {post.user.displayName ?? post.user.username}
              </span>
              {post.user.isVerified && (
                <BadgeCheck className="w-3.5 h-3.5 text-primary flex-shrink-0" />
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {formatRelativeTime(post.createdAt)}
            </p>
          </div>
        </Link>
        <button className="btn-ghost p-2 rounded-lg -mr-2">
          <MoreHorizontal className="w-5 h-5" />
        </button>
      </div>

      {/* ── Media ──────────────────────────────────────────────────────── */}
      <div
        className={cn(
          'relative overflow-hidden bg-secondary cursor-pointer select-none',
          getAspectRatioClass(post.aspectRatio)
        )}
        onClick={handleMediaTap}
      >
        {post.mediaType === 'IMAGE' ? (
          <Image
            src={post.mediaUrl}
            alt={caption || `Post by ${post.user.username}`}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 468px"
            priority={priority}
            draggable={false}
          />
        ) : (
          <>
            <video
              ref={videoRef}
              src={post.mediaUrl}
              poster={post.thumbnailUrl}
              muted={isMuted}
              loop
              playsInline
              preload="metadata"
              className="w-full h-full object-cover"
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
            />
            {/* Play overlay */}
            <AnimatePresence>
              {!isPlaying && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 flex items-center justify-center bg-black/20"
                >
                  <div className="glass w-14 h-14 rounded-full flex items-center justify-center">
                    <Play className="w-6 h-6 text-white fill-white ml-1" />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            {/* Mute toggle */}
            <button
              onClick={(e) => { e.stopPropagation(); setIsMuted(!isMuted); }}
              className="absolute bottom-3 right-3 glass w-8 h-8 rounded-full flex items-center justify-center text-white transition-opacity hover:opacity-80"
            >
              {isMuted
                ? <VolumeX className="w-3.5 h-3.5" />
                : <Volume2 className="w-3.5 h-3.5" />
              }
            </button>
          </>
        )}

        {/* Double-tap heart overlay */}
        <AnimatePresence>
          {heartAnim && (
            <motion.div
              key="heart-overlay"
              initial={{ scale: 0, opacity: 1 }}
              animate={{ scale: [0, 1.6, 1.2], opacity: [1, 1, 0] }}
              transition={{ duration: 0.7, times: [0, 0.5, 1] }}
              className="absolute inset-0 flex items-center justify-center pointer-events-none"
            >
              <Heart className="w-24 h-24 text-white fill-white drop-shadow-2xl" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Action Bar ─────────────────────────────────────────────────── */}
      <div className="px-4 py-2">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1">
            {/* Like */}
            <motion.button
              onClick={handleLikeToggle}
              whileTap={{ scale: 0.85 }}
              className={cn(
                'flex items-center gap-1.5 p-2.5 sm:p-2 rounded-xl transition-colors touch-manipulation',
                isLiked
                  ? 'text-red-500 hover:bg-red-500/10'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
              )}
              aria-label={isLiked ? 'Unlike post' : 'Like post'}
              id={`like-btn-${post.id}`}
            >
              <motion.div
                animate={isLiked ? { scale: [1, 1.3, 1] } : { scale: 1 }}
                transition={{ duration: 0.35 }}
              >
                <Heart
                  className="w-6 h-6"
                  fill={isLiked ? 'currentColor' : 'none'}
                  strokeWidth={isLiked ? 0 : 1.8}
                />
              </motion.div>
            </motion.button>

            {/* Comment */}
            <button
              onClick={onCommentClick}
              className="flex items-center gap-1.5 p-2.5 sm:p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors touch-manipulation"
              aria-label="Comment on post"
              id={`comment-btn-${post.id}`}
            >
              <MessageCircle className="w-6 h-6" strokeWidth={1.8} />
            </button>

            {/* Share */}
            <button
              onClick={handleShare}
              className="flex items-center gap-1.5 p-2.5 sm:p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors touch-manipulation"
              aria-label="Share post"
              id={`share-btn-${post.id}`}
            >
              <Share2 className="w-6 h-6" strokeWidth={1.8} />
            </button>
          </div>

          {/* Bookmark */}
          <button
            className={cn(
              'p-2.5 sm:p-2 rounded-xl transition-colors touch-manipulation',
              isSaved
                ? 'text-primary hover:bg-primary/10'
                : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
            )}
            onClick={handleSaveToggle}
            aria-label={isSaved ? 'Unsave post' : 'Save post'}
            id={`save-btn-${post.id}`}
          >
            <Bookmark
              className="w-6 h-6"
              fill={isSaved ? 'currentColor' : 'none'}
              strokeWidth={isSaved ? 0 : 1.8}
            />
          </button>
        </div>

        {/* Like count */}
        {likesCount > 0 && (
          <p className="text-sm font-semibold mb-1.5">
            {formatCount(likesCount)} {likesCount === 1 ? 'like' : 'likes'}
          </p>
        )}

        {/* Caption */}
        {caption && (
          <div className="text-sm leading-relaxed">
            <Link href={`/@${post.user.username}`} className="font-semibold hover:text-primary transition-colors mr-1.5">
              {post.user.username}
            </Link>
            <span className="text-foreground/90">
              {displayCaption}
              {shouldTruncate && !captionExpanded && (
                <button
                  onClick={() => setCaptionExpanded(true)}
                  className="text-muted-foreground hover:text-foreground ml-1 transition-colors"
                >
                  more
                </button>
              )}
            </span>
          </div>
        )}

        {/* Tags */}
        {post.tags && post.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {post.tags.slice(0, 5).map((tag) => (
              <Link
                key={tag}
                href={`/explore?tag=${tag}`}
                className="text-xs text-primary/80 hover:text-primary transition-colors"
              >
                #{tag}
              </Link>
            ))}
          </div>
        )}

        {/* Comment count link */}
        {post.commentsCount > 0 && (
          <button
            onClick={onCommentClick}
            className="text-sm text-muted-foreground hover:text-foreground mt-1.5 transition-colors"
            id={`view-comments-${post.id}`}
          >
            View all {formatCount(post.commentsCount)} comments
          </button>
        )}
      </div>
    </article>
  );
}
