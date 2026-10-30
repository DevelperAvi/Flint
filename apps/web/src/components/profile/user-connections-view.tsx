'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Search, UserPlus, UserCheck, ShieldCheck,
  Users, UserCheck2, Loader2,
} from 'lucide-react';
import { flintApi } from '@/lib/api';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuthStore } from '@/store/auth.store';
import { cn } from '@/lib/utils';

interface UserConnectionsViewProps {
  username: string;
  initialTab: 'followers' | 'following';
}

export function UserConnectionsView({ username, initialTab }: UserConnectionsViewProps) {
  const { user: currentUser, isAuthenticated } = useAuthStore();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'followers' | 'following'>(initialTab);
  const [searchTerm, setSearchTerm] = useState('');

  // Fetch followers
  const { data: followersData, isLoading: loadingFollowers } = useQuery({
    queryKey: ['followers', username],
    queryFn: () => flintApi.users.getFollowers(username).then((r) => r.data.data),
  });

  // Fetch following
  const { data: followingData, isLoading: loadingFollowing } = useQuery({
    queryKey: ['following', username],
    queryFn: () => flintApi.users.getFollowing(username).then((r) => r.data.data),
  });

  // Follow/unfollow mutation
  const followMutation = useMutation({
    mutationFn: ({ targetUsername, isCurrentlyFollowing }: { targetUsername: string; isCurrentlyFollowing: boolean }) =>
      isCurrentlyFollowing
        ? flintApi.users.unfollow(targetUsername)
        : flintApi.users.follow(targetUsername),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['followers'] });
      queryClient.invalidateQueries({ queryKey: ['following'] });
      queryClient.invalidateQueries({ queryKey: ['profile', username] });
    },
  });

  const rawList =
    activeTab === 'followers'
      ? (followersData?.items ?? (Array.isArray(followersData) ? followersData : []))
      : (followingData?.items ?? (Array.isArray(followingData) ? followingData : []));

  const isLoading = activeTab === 'followers' ? loadingFollowers : loadingFollowing;

  const filteredList = rawList.filter((item: any) => {
    if (!item) return false;
    const name = item.displayName || item.username || '';
    const uName = item.username || '';
    const q = searchTerm.toLowerCase();
    return name.toLowerCase().includes(q) || uName.toLowerCase().includes(q);
  });

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 pb-28 lg:pb-8 space-y-6">
      {/* ── Top Header ──────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 pb-2 border-b border-border">
        <Link
          href={`/@${username}`}
          className="p-2 -ml-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          aria-label="Back to profile"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold font-display">
            @{username}
          </h1>
          <p className="text-xs text-muted-foreground">Community connections</p>
        </div>
      </div>

      {/* ── Tabs (Followers vs Following) ───────────────────────────── */}
      <div className="flex items-center border-b border-border">
        <button
          onClick={() => setActiveTab('followers')}
          className={cn(
            'flex-1 py-3 text-sm font-semibold text-center border-b-2 -mb-px transition-colors',
            activeTab === 'followers'
              ? 'border-primary text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          )}
        >
          Followers {rawList && activeTab === 'followers' ? `(${rawList.length})` : ''}
        </button>

        <button
          onClick={() => setActiveTab('following')}
          className={cn(
            'flex-1 py-3 text-sm font-semibold text-center border-b-2 -mb-px transition-colors',
            activeTab === 'following'
              ? 'border-primary text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          )}
        >
          Following {rawList && activeTab === 'following' ? `(${rawList.length})` : ''}
        </button>
      </div>

      {/* ── Search Bar ──────────────────────────────────────────────── */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder={`Search ${activeTab}...`}
          className="input-flint pl-10 text-sm"
        />
      </div>

      {/* ── User List ───────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3.5 p-3.5 card-flint animate-pulse">
              <div className="w-11 h-11 rounded-full bg-secondary" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-32 bg-secondary rounded" />
                <div className="h-2 w-20 bg-secondary rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : filteredList.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground space-y-3">
          <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center mx-auto">
            <Users className="w-8 h-8 opacity-40" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground text-base">
              {searchTerm
                ? 'No matching users found'
                : activeTab === 'followers'
                ? 'No followers yet'
                : 'Not following anyone yet'}
            </h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
              {activeTab === 'followers'
                ? 'When people follow this profile, they will appear right here.'
                : 'Explore popular creators and spark up conversations.'}
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredList.map((item: any) => {
            const isMe = currentUser?.username === item.username;
            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center justify-between p-3.5 rounded-2xl card-flint hover:bg-secondary/40 transition-colors"
              >
                <Link
                  href={`/@${item.username}`}
                  className="flex items-center gap-3.5 min-w-0 flex-1"
                >
                  <Avatar className="w-11 h-11 flex-shrink-0 ring-1 ring-border">
                    <AvatarImage src={item.avatarUrl} alt={item.username} />
                    <AvatarFallback className="bg-spark-500/20 text-spark-400 font-bold text-sm">
                      {item.username[0]?.toUpperCase()}
                    </AvatarFallback>
                  </Avatar>

                  <div className="min-w-0">
                    <div className="flex items-center gap-1">
                      <span className="font-semibold text-sm text-foreground truncate hover:text-primary transition-colors">
                        {item.displayName || item.username}
                      </span>
                      {item.isVerified && (
                        <ShieldCheck className="w-3.5 h-3.5 text-spark-500 flex-shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">@{item.username}</p>
                    {item.bio && (
                      <p className="text-xs text-foreground/80 truncate mt-0.5 max-w-xs">
                        {item.bio}
                      </p>
                    )}
                  </div>
                </Link>

                {!isMe && isAuthenticated && (
                  <button
                    onClick={() =>
                      followMutation.mutate({
                        targetUsername: item.username,
                        isCurrentlyFollowing: !!item.isFollowing,
                      })
                    }
                    disabled={followMutation.isPending}
                    className={cn(
                      'text-xs px-3.5 py-1.5 rounded-xl font-semibold transition-all flex items-center gap-1.5 flex-shrink-0 ml-3',
                      item.isFollowing
                        ? 'border border-border text-foreground hover:bg-destructive/10 hover:text-destructive'
                        : 'btn-spark'
                    )}
                  >
                    {item.isFollowing ? (
                      <>
                        <UserCheck className="w-3.5 h-3.5" />
                        <span>Following</span>
                      </>
                    ) : (
                      <>
                        <UserPlus className="w-3.5 h-3.5" />
                        <span>Follow</span>
                      </>
                    )}
                  </button>
                )}
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}

