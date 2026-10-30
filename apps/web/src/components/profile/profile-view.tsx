'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Grid3X3, Bookmark, BadgeCheck, MapPin, LinkIcon,
  Settings, UserPlus, UserCheck, Play, Heart, MessageCircle,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn, formatCount, getAspectRatioClass } from '@/lib/utils';
import { flintApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';

interface ProfileViewProps {
  username: string;
}

type GridTab = 'posts' | 'saved';

export function ProfileView({ username }: ProfileViewProps) {
  const { user: currentUser, isAuthenticated } = useAuthStore();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<GridTab>('posts');
  const isOwnProfile = currentUser?.username === username;

  // Fetch profile
  const { data: profileData, isLoading: profileLoading } = useQuery({
    queryKey: ['profile', username],
    queryFn: () => flintApi.users.getProfile(username).then((r) => r.data.data),
  });

  // Fetch posts
  const { data: postsData, isLoading: postsLoading } = useQuery({
    queryKey: ['user-posts', username],
    queryFn: () => flintApi.users.getPosts(username).then((r) => r.data.data),
    enabled: !!profileData,
  });

  // Fetch saved posts if own profile
  const { data: savedData, isLoading: savedLoading } = useQuery({
    queryKey: ['saved-posts'],
    queryFn: () => flintApi.posts.getSaved().then((r) => r.data.data),
    enabled: isOwnProfile && activeTab === 'saved',
  });

  // Follow mutation
  const followMutation = useMutation({
    mutationFn: () =>
      profileData?.isFollowing
        ? flintApi.users.unfollow(username)
        : flintApi.users.follow(username),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['profile', username] });
      const prev = queryClient.getQueryData<typeof profileData>(['profile', username]);

      queryClient.setQueryData(['profile', username], (old: typeof profileData) =>
        old
          ? {
              ...old,
              isFollowing: !old.isFollowing,
              followersCount: old.isFollowing
                ? old.followersCount - 1
                : old.followersCount + 1,
            }
          : old
      );
      return { prev };
    },
    onError: (_, __, ctx) => {
      queryClient.setQueryData(['profile', username], ctx?.prev);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['profile', username] });
    },
  });

  const profile = profileData;
  const posts = activeTab === 'saved' ? (savedData?.items ?? []) : (postsData?.items ?? []);
  const isLoadingPosts = activeTab === 'saved' ? savedLoading : postsLoading;

  if (profileLoading) {
    return <ProfileSkeleton />;
  }

  if (!profile) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        User not found
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 pb-24 lg:pb-6">
      {/* ── Profile Header ───────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row items-start sm:items-center gap-6 mb-8"
      >
        {/* Avatar */}
        <div className="relative">
          <div className="p-[3px] rounded-full bg-gradient-to-tr from-spark-400 via-rose-500 to-spark-600">
            <Avatar className="w-24 h-24 sm:w-36 sm:h-36 ring-3 ring-background">
              <AvatarImage src={profile.avatarUrl ?? undefined} alt={profile.username} />
              <AvatarFallback className="text-3xl font-bold bg-spark-500/20 text-spark-400">
                {profile.username[0].toUpperCase()}
              </AvatarFallback>
            </Avatar>
          </div>
          {profile.isVerified && (
            <div className="absolute bottom-1 right-1 w-6 h-6 bg-background rounded-full flex items-center justify-center">
              <BadgeCheck className="w-5 h-5 text-primary" />
            </div>
          )}
        </div>

        {/* Profile info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap mb-3">
            <h1 className="text-xl font-bold">
              {profile.displayName || profile.username}
            </h1>
            {profile.isVerified && (
              <BadgeCheck className="w-5 h-5 text-primary flex-shrink-0" />
            )}
          </div>
          <p className="text-sm text-muted-foreground mb-3">@{profile.username}</p>

          {/* Action buttons */}
          <div className="flex items-center gap-2 mb-4">
            {isOwnProfile ? (
              <>
                <Link href="/settings/profile" className="btn-ghost border border-border flex-1 justify-center" id="edit-profile-btn">
                  Edit Profile
                </Link>
                <Link href="/settings" className="btn-ghost border border-border px-3">
                  <Settings className="w-4 h-4" />
                </Link>
              </>
            ) : (
              isAuthenticated && (
                <motion.button
                  onClick={() => followMutation.mutate()}
                  disabled={followMutation.isPending}
                  whileTap={{ scale: 0.97 }}
                  className={cn(
                    'flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold transition-all',
                    profile.isFollowing
                      ? 'border border-border text-foreground hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30'
                      : 'btn-spark'
                  )}
                  id={profile.isFollowing ? 'unfollow-btn' : 'follow-btn'}
                >
                  {profile.isFollowing
                    ? <><UserCheck className="w-4 h-4" /> Following</>
                    : <><UserPlus className="w-4 h-4" /> Follow</>
                  }
                </motion.button>
              )
            )}
          </div>

          {/* Stats */}
          <div className="flex items-center gap-6">
            {[
              { label: 'posts', value: profile.postsCount },
              { label: 'followers', value: profile.followersCount, href: `/@${username}/followers` },
              { label: 'following', value: profile.followingCount, href: `/@${username}/following` },
            ].map(({ label, value, href }) => (
              href ? (
                <Link key={label} href={href} className="text-center hover:opacity-70 transition-opacity" id={`${label}-count`}>
                  <p className="font-bold text-base">{formatCount(value)}</p>
                  <p className="text-sm text-muted-foreground">{label}</p>
                </Link>
              ) : (
                <div key={label} className="text-center" id={`${label}-count`}>
                  <p className="font-bold text-base">{formatCount(value)}</p>
                  <p className="text-sm text-muted-foreground">{label}</p>
                </div>
              )
            ))}
          </div>

          {/* Bio */}
          {profile.bio && (
            <p className="text-sm leading-relaxed mt-3 text-foreground/90 max-w-sm">
              {profile.bio}
            </p>
          )}

          {profile.website && (
            <a
              href={profile.website}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-sm text-primary hover:underline mt-1.5"
            >
              <LinkIcon className="w-3.5 h-3.5" />
              {profile.website.replace(/^https?:\/\//, '')}
            </a>
          )}
        </div>
      </motion.div>

      {/* ── Tab Navigation ───────────────────────────────────────────── */}
      <div className="flex items-center border-t border-border mb-1">
        {[
          { key: 'posts' as const, icon: Grid3X3, label: 'Posts' },
          ...(isOwnProfile ? [{ key: 'saved' as const, icon: Bookmark, label: 'Saved' }] : []),
        ].map(({ key, icon: Icon, label }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            id={`profile-tab-${key}`}
            className={cn(
              'flex items-center gap-2 px-6 py-3 text-xs font-medium uppercase tracking-widest border-t-2 -mt-px transition-all',
              activeTab === key
                ? 'border-foreground text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* ── Media Grid ───────────────────────────────────────────────── */}
      {isLoadingPosts ? (
        <GridSkeleton />
      ) : posts.length === 0 ? (
        <EmptyGrid isOwnProfile={isOwnProfile} />
      ) : (
        <motion.div
          className="grid grid-cols-3 gap-0.5"
          initial="hidden"
          animate="visible"
          variants={{
            hidden: {},
            visible: { transition: { staggerChildren: 0.03 } },
          }}
        >
          {posts.map((post: {
            id: string;
            mediaType: 'IMAGE' | 'VIDEO';
            mediaUrl: string;
            thumbnailUrl?: string;
            likesCount: number;
            commentsCount: number;
            aspectRatio: string;
            duration?: number;
          }) => (
            <GridItem key={post.id} post={post} />
          ))}
        </motion.div>
      )}
    </div>
  );
}

function GridItem({ post }: { post: {
  id: string;
  mediaType: 'IMAGE' | 'VIDEO';
  mediaUrl: string;
  thumbnailUrl?: string;
  likesCount: number;
  commentsCount: number;
  aspectRatio: string;
  duration?: number;
} }) {
  const [hovered, setHovered] = useState(false);

  return (
    <motion.div
      variants={{ hidden: { opacity: 0 }, visible: { opacity: 1 } }}
      className="relative aspect-square bg-secondary overflow-hidden cursor-pointer group"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <Link href={`/p/${post.id}`} className="block w-full h-full">
        <Image
          src={post.thumbnailUrl ?? post.mediaUrl}
          alt=""
          fill
          className="object-cover transition-transform duration-300 group-hover:scale-105"
          sizes="(max-width: 768px) 33vw, 250px"
        />

        {/* Video indicator */}
        {post.mediaType === 'VIDEO' && (
          <div className="absolute top-2 right-2">
            <Play className="w-4 h-4 text-white fill-white drop-shadow-md" />
          </div>
        )}

        {/* Hover overlay */}
        <motion.div
          initial={false}
          animate={{ opacity: hovered ? 1 : 0 }}
          className="absolute inset-0 bg-black/50 flex items-center justify-center gap-5"
        >
          <div className="flex items-center gap-1.5 text-white text-sm font-bold">
            <Heart className="w-5 h-5 fill-white" />
            {formatCount(post.likesCount)}
          </div>
          <div className="flex items-center gap-1.5 text-white text-sm font-bold">
            <MessageCircle className="w-5 h-5 fill-white" />
            {formatCount(post.commentsCount)}
          </div>
        </motion.div>
      </Link>
    </motion.div>
  );
}

function ProfileSkeleton() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-6 animate-pulse">
      <div className="flex gap-6 mb-8">
        <div className="w-36 h-36 rounded-full bg-secondary" />
        <div className="flex-1 space-y-3 pt-4">
          <div className="h-6 w-40 bg-secondary rounded-lg" />
          <div className="h-4 w-24 bg-secondary rounded-lg" />
          <div className="flex gap-6 mt-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="space-y-1">
                <div className="h-5 w-12 bg-secondary rounded" />
                <div className="h-3 w-16 bg-secondary rounded" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function GridSkeleton() {
  return (
    <div className="grid grid-cols-3 gap-0.5">
      {Array.from({ length: 9 }).map((_, i) => (
        <div key={i} className="aspect-square bg-secondary shimmer-loading" />
      ))}
    </div>
  );
}

function EmptyGrid({ isOwnProfile }: { isOwnProfile: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center space-y-3">
      <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center">
        <Grid3X3 className="w-8 h-8 text-muted-foreground" />
      </div>
      <p className="font-semibold">No posts yet</p>
      {isOwnProfile && (
        <p className="text-sm text-muted-foreground">Share your first spark with the world.</p>
      )}
    </div>
  );
}
