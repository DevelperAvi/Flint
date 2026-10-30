'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Bell, Heart, MessageCircle, UserPlus, CheckCheck,
  Loader2, BadgeCheck, Flame, AtSign,
} from 'lucide-react';
import { flintApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { formatRelativeTime } from '@/lib/utils';
import { toast } from '@/components/ui/toaster';
import { PostDetailModal } from '@/components/modals/post-detail-modal';

type FilterType = 'all' | 'likes' | 'comments' | 'follows';

export default function NotificationsPage() {
  const { isAuthenticated } = useAuthStore();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<FilterType>('all');
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);

  // Fetch notifications list
  const { data: notificationsData, isLoading } = useQuery({
    queryKey: ['notifications', 'list'],
    queryFn: () => flintApi.notifications.list().then((r) => r.data.data),
    enabled: isAuthenticated,
  });

  // Mark all as read mutation
  const markAllMutation = useMutation({
    mutationFn: () => flintApi.notifications.readAll(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      toast({ title: 'All notifications marked as read', variant: 'success' });
    },
  });

  const rawItems = notificationsData?.items ?? [];

  const items = rawItems.filter((item: any) => {
    if (filter === 'likes') return item.type === 'LIKE';
    if (filter === 'comments') return item.type === 'COMMENT' || item.type === 'REPLY';
    if (filter === 'follows') return item.type === 'FOLLOW';
    return true;
  });

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'LIKE':
        return <Heart className="w-3.5 h-3.5 text-red-500 fill-red-500" />;
      case 'COMMENT':
      case 'REPLY':
        return <MessageCircle className="w-3.5 h-3.5 text-sky-500 fill-sky-500" />;
      case 'FOLLOW':
        return <UserPlus className="w-3.5 h-3.5 text-spark-500" />;
      case 'MENTION':
        return <AtSign className="w-3.5 h-3.5 text-purple-500" />;
      default:
        return <Bell className="w-3.5 h-3.5 text-primary" />;
    }
  };

  const getNotificationText = (item: any) => {
    switch (item.type) {
      case 'LIKE':
        return 'liked your post';
      case 'COMMENT':
        return 'commented on your post';
      case 'REPLY':
        return 'replied to your comment';
      case 'FOLLOW':
        return 'started following you';
      case 'MENTION':
        return 'mentioned you in a post';
      default:
        return 'interacted with your profile';
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 pb-24 lg:pb-8 space-y-6">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display tracking-tight">Notifications</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Stay up to date with your community</p>
        </div>

        <button
          onClick={() => markAllMutation.mutate()}
          disabled={markAllMutation.isPending || rawItems.length === 0}
          className="btn-ghost text-xs flex items-center gap-1.5 px-3 py-2 border border-border rounded-xl disabled:opacity-40"
        >
          <CheckCheck className="w-4 h-4 text-primary" />
          <span>Mark all read</span>
        </button>
      </div>

      {/* ── Filter Tabs ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 border-b border-border pb-3">
        {(['all', 'likes', 'comments', 'follows'] as FilterType[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold capitalize transition-all ${
              filter === tab
                ? 'bg-primary/10 text-primary border border-primary/20'
                : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* ── Notifications List ──────────────────────────────────────── */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 p-4 card-flint animate-pulse">
              <div className="w-11 h-11 rounded-full bg-secondary" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-40 bg-secondary rounded" />
                <div className="h-2 w-20 bg-secondary rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-24 text-muted-foreground space-y-3">
          <div className="w-16 h-16 rounded-2xl bg-secondary/80 flex items-center justify-center mx-auto">
            <Bell className="w-8 h-8 opacity-40" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">No notifications yet</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-xs mx-auto">
              When people like your posts, comment, or follow you, you'll see them right here.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item: any) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex items-center justify-between p-3.5 rounded-2xl card-flint transition-colors ${
                !item.isRead ? 'border-primary/20 bg-primary/[0.02]' : ''
              }`}
            >
              <div className="flex items-center gap-3.5 min-w-0">
                {/* Avatar with icon badge */}
                <div className="relative flex-shrink-0">
                  <Link href={`/@${item.actor.username}`}>
                    <Avatar className="w-11 h-11">
                      <AvatarImage src={item.actor.avatarUrl} alt={item.actor.username} />
                      <AvatarFallback>{item.actor.username[0]?.toUpperCase()}</AvatarFallback>
                    </Avatar>
                  </Link>
                  <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-background border border-border flex items-center justify-center shadow-sm">
                    {getNotificationIcon(item.type)}
                  </div>
                </div>

                {/* Text */}
                <div className="min-w-0 text-sm">
                  <p className="leading-snug">
                    <Link
                      href={`/@${item.actor.username}`}
                      className="font-semibold hover:text-primary transition-colors mr-1"
                    >
                      {item.actor.displayName || item.actor.username}
                    </Link>
                    <span className="text-foreground/90">{getNotificationText(item)}</span>
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {formatRelativeTime(item.createdAt)}
                  </p>
                </div>
              </div>

              {/* Action / Target preview */}
              <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                {!item.isRead && (
                  <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
                )}
                {item.postId && (
                  <button
                    onClick={() => setSelectedPostId(item.postId)}
                    className="btn-ghost text-xs px-2.5 py-1.5 border border-border rounded-lg hover:border-primary/40 text-muted-foreground hover:text-foreground"
                  >
                    View
                  </button>
                )}
              </div>
            </motion.div>
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

