'use client';

import { useState, useCallback, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Heart, MessageCircle, Bookmark, Share2, Send,
  Loader2, BadgeCheck, MoreHorizontal, CornerDownRight,
} from 'lucide-react';
import * as Dialog from '@radix-ui/react-dialog';
import { flintApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn, formatRelativeTime, formatCount, getAspectRatioClass } from '@/lib/utils';
import { toast } from '@/components/ui/toaster';

interface PostDetailModalProps {
  postId: string | null;
  open: boolean;
  onClose: () => void;
}

export function PostDetailModal({ postId, open, onClose }: PostDetailModalProps) {
  if (!postId) return null;

  return (
    <Dialog.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 animate-fade-in" />
        <Dialog.Content className="fixed inset-4 sm:inset-10 lg:inset-x-24 lg:inset-y-12 z-50 flex items-center justify-center pointer-events-none">
          <div className="relative w-full max-w-5xl h-full max-h-[90vh] bg-card border border-border rounded-2xl overflow-hidden shadow-2xl flex flex-col lg:flex-row pointer-events-auto">
            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 z-20 glass w-9 h-9 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <PostDetailContent postId={postId} />
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function PostDetailContent({ postId }: { postId: string }) {
  const { user, isAuthenticated } = useAuthStore();
  const queryClient = useQueryClient();
  const [commentText, setCommentText] = useState('');
  const [replyTo, setReplyTo] = useState<{ id: string; username: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch Post Details
  const { data: postData, isLoading: postLoading } = useQuery({
    queryKey: ['post', postId],
    queryFn: () => flintApi.posts.get(postId).then((r) => r.data.data),
    enabled: !!postId,
  });

  // Fetch Comments
  const { data: commentsData, isLoading: commentsLoading } = useQuery({
    queryKey: ['post-comments', postId],
    queryFn: () => flintApi.posts.getComments(postId).then((r) => r.data.data),
    enabled: !!postId,
  });

  // Add Comment Mutation
  const addCommentMutation = useMutation({
    mutationFn: (text: string) =>
      flintApi.posts.addComment(postId, text, replyTo?.id),
    onSuccess: () => {
      setCommentText('');
      setReplyTo(null);
      queryClient.invalidateQueries({ queryKey: ['post-comments', postId] });
      queryClient.invalidateQueries({ queryKey: ['post', postId] });
    },
    onError: () => {
      toast({ title: 'Failed to send comment', variant: 'error' });
    },
  });

  // Like Mutation
  const likeMutation = useMutation({
    mutationFn: () =>
      postData?.isLiked ? flintApi.posts.unlike(postId) : flintApi.posts.like(postId),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['post', postId] });
      const prev = queryClient.getQueryData(['post', postId]);
      queryClient.setQueryData(['post', postId], (old: typeof postData) =>
        old
          ? {
              ...old,
              isLiked: !old.isLiked,
              likesCount: old.isLiked ? old.likesCount - 1 : old.likesCount + 1,
            }
          : old
      );
      return { prev };
    },
    onError: (_, __, ctx) => {
      queryClient.setQueryData(['post', postId], ctx?.prev);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['post', postId] });
    },
  });

  // Save Mutation
  const saveMutation = useMutation({
    mutationFn: () =>
      postData?.isSaved ? flintApi.posts.unsave(postId) : flintApi.posts.save(postId),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['post', postId] });
      const prev = queryClient.getQueryData(['post', postId]);
      queryClient.setQueryData(['post', postId], (old: typeof postData) =>
        old ? { ...old, isSaved: !old.isSaved } : old
      );
      return { prev };
    },
    onError: (_, __, ctx) => {
      queryClient.setQueryData(['post', postId], ctx?.prev);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['post', postId] });
    },
  });

  const handleShare = () => {
    const url = typeof window !== 'undefined' ? `${window.location.origin}/p/${postId}` : '';
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url);
      toast({ title: 'Link copied to clipboard!', variant: 'success' });
    }
  };

  const handleSubmitComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim() || !isAuthenticated) return;
    addCommentMutation.mutate(commentText.trim());
  };

  if (postLoading) {
    return (
      <div className="flex-1 flex items-center justify-center p-12">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (!postData) {
    return (
      <div className="flex-1 flex items-center justify-center p-12 text-muted-foreground">
        Post not found
      </div>
    );
  }

  const post = postData;
  const comments = commentsData?.items ?? [];

  return (
    <div className="flex-1 flex flex-col lg:flex-row h-full min-h-0 overflow-hidden">
      {/* ── Media Side (Left) ─────────────────────────────────────────── */}
      <div className="lg:flex-1 bg-black flex items-center justify-center relative min-h-[300px] lg:min-h-0 overflow-hidden select-none">
        {post.mediaType === 'IMAGE' ? (
          <Image
            src={post.mediaUrl}
            alt={post.caption || `Post by ${post.user.username}`}
            fill
            className="object-contain"
            sizes="(max-width: 1024px) 100vw, 65vw"
            priority
          />
        ) : (
          <video
            src={post.mediaUrl}
            poster={post.thumbnailUrl}
            controls
            autoPlay
            loop
            playsInline
            className="w-full h-full object-contain"
          />
        )}
      </div>

      {/* ── Content & Comments Side (Right) ────────────────────────────── */}
      <div className="w-full lg:w-[420px] flex flex-col bg-card border-t lg:border-t-0 lg:border-l border-border h-[400px] lg:h-full min-h-0">
        {/* Author Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <Link href={`/@${post.user.username}`} className="flex items-center gap-3 group">
            <Avatar className="w-9 h-9">
              <AvatarImage src={post.user.avatarUrl} alt={post.user.username} />
              <AvatarFallback>{post.user.username[0]?.toUpperCase()}</AvatarFallback>
            </Avatar>
            <div>
              <div className="flex items-center gap-1">
                <span className="font-semibold text-sm group-hover:text-primary transition-colors">
                  {post.user.username}
                </span>
                {post.user.isVerified && (
                  <BadgeCheck className="w-3.5 h-3.5 text-primary" />
                )}
              </div>
              <p className="text-xs text-muted-foreground">{formatRelativeTime(post.createdAt)}</p>
            </div>
          </Link>
        </div>

        {/* Caption & Comments List */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
          {/* Post Caption */}
          {post.caption && (
            <div className="flex gap-3 text-sm pb-3 border-b border-border/50">
              <Avatar className="w-8 h-8 flex-shrink-0">
                <AvatarImage src={post.user.avatarUrl} alt={post.user.username} />
                <AvatarFallback>{post.user.username[0]?.toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="flex-1 leading-relaxed">
                <span className="font-semibold mr-2">{post.user.username}</span>
                <span className="text-foreground/90 whitespace-pre-wrap">{post.caption}</span>
                <div className="text-xs text-muted-foreground mt-1">
                  {formatRelativeTime(post.createdAt)}
                </div>
              </div>
            </div>
          )}

          {/* Comments */}
          {commentsLoading ? (
            <div className="py-8 flex justify-center">
              <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
            </div>
          ) : comments.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground text-sm">
              No comments yet. Start the conversation!
            </div>
          ) : (
            comments.map((comment: any) => (
              <div key={comment.id} className="space-y-2">
                <div className="flex gap-3 text-sm">
                  <Avatar className="w-7 h-7 flex-shrink-0">
                    <AvatarImage src={comment.user.avatarUrl} alt={comment.user.username} />
                    <AvatarFallback>{comment.user.username[0]?.toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 leading-relaxed">
                    <div className="flex items-center gap-1.5">
                      <Link
                        href={`/@${comment.user.username}`}
                        className="font-semibold text-xs hover:text-primary transition-colors"
                      >
                        {comment.user.username}
                      </Link>
                      <span className="text-[11px] text-muted-foreground">
                        {formatRelativeTime(comment.createdAt)}
                      </span>
                    </div>
                    <p className="text-foreground/90 text-sm mt-0.5">{comment.content}</p>
                    <button
                      onClick={() => {
                        setReplyTo({ id: comment.id, username: comment.user.username });
                        inputRef.current?.focus();
                      }}
                      className="text-xs text-muted-foreground hover:text-foreground mt-1 flex items-center gap-1"
                    >
                      Reply
                    </button>
                  </div>
                </div>

                {/* Replies */}
                {comment.replies && comment.replies.length > 0 && (
                  <div className="ml-10 space-y-2 pl-3 border-l-2 border-border">
                    {comment.replies.map((reply: any) => (
                      <div key={reply.id} className="flex gap-2 text-sm">
                        <Avatar className="w-6 h-6 flex-shrink-0">
                          <AvatarImage src={reply.user.avatarUrl} alt={reply.user.username} />
                          <AvatarFallback>{reply.user.username[0]?.toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-xs">{reply.user.username}</span>
                            <span className="text-[10px] text-muted-foreground">
                              {formatRelativeTime(reply.createdAt)}
                            </span>
                          </div>
                          <p className="text-foreground/90 text-xs mt-0.5">{reply.content}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Action Bar */}
        <div className="border-t border-border px-4 py-2.5">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1">
              <button
                onClick={() => likeMutation.mutate()}
                className={cn(
                  'p-2 rounded-xl transition-colors',
                  post.isLiked
                    ? 'text-red-500 hover:bg-red-500/10'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                )}
              >
                <Heart
                  className="w-5 h-5"
                  fill={post.isLiked ? 'currentColor' : 'none'}
                  strokeWidth={post.isLiked ? 0 : 2}
                />
              </button>
              <button
                onClick={() => inputRef.current?.focus()}
                className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              >
                <MessageCircle className="w-5 h-5" />
              </button>
              <button
                onClick={handleShare}
                className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              >
                <Share2 className="w-5 h-5" />
              </button>
            </div>
            <button
              onClick={() => saveMutation.mutate()}
              className={cn(
                'p-2 rounded-xl transition-colors',
                post.isSaved
                  ? 'text-primary hover:bg-primary/10'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
              )}
            >
              <Bookmark
                className="w-5 h-5"
                fill={post.isSaved ? 'currentColor' : 'none'}
                strokeWidth={post.isSaved ? 0 : 2}
              />
            </button>
          </div>
          {post.likesCount > 0 && (
            <p className="text-xs font-semibold mb-1">
              {formatCount(post.likesCount)} {post.likesCount === 1 ? 'like' : 'likes'}
            </p>
          )}
        </div>

        {/* Add Comment Input */}
        {isAuthenticated ? (
          <form onSubmit={handleSubmitComment} className="border-t border-border p-3">
            {replyTo && (
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5 px-1">
                <span className="flex items-center gap-1">
                  <CornerDownRight className="w-3.5 h-3.5 text-primary" />
                  Replying to @{replyTo.username}
                </span>
                <button
                  type="button"
                  onClick={() => setReplyTo(null)}
                  className="hover:text-foreground"
                >
                  Cancel
                </button>
              </div>
            )}
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder={replyTo ? `Reply to @${replyTo.username}...` : 'Add a comment...'}
                className="input-flint text-sm py-2 flex-1"
                maxLength={500}
              />
              <button
                type="submit"
                disabled={!commentText.trim() || addCommentMutation.isPending}
                className="btn-spark px-3 py-2 text-sm disabled:opacity-40"
              >
                {addCommentMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </button>
            </div>
          </form>
        ) : (
          <div className="border-t border-border p-3 text-center text-xs text-muted-foreground">
            <Link href="/login" className="text-primary hover:underline font-semibold">
              Log in
            </Link>{' '}
            to like and comment.
          </div>
        )}
      </div>
    </div>
  );
}

