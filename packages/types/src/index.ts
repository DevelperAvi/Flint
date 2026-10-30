// Flint Platform — Shared Type Definitions

export type MediaType = 'IMAGE' | 'VIDEO';

export type AspectRatio = 'SQUARE' | 'PORTRAIT' | 'REEL' | 'LANDSCAPE';

export type ProcessingStatus = 'PENDING' | 'PROCESSING' | 'READY' | 'FAILED';

export type NotificationType = 'LIKE' | 'COMMENT' | 'REPLY' | 'FOLLOW' | 'MENTION';

// ── User Types ──────────────────────────────────────────────────────────────
export interface UserSummary {
  id: string;
  username: string;
  displayName?: string | null;
  avatarUrl?: string | null;
  isVerified?: boolean;
}

export interface UserProfile extends UserSummary {
  bio?: string | null;
  website?: string | null;
  postsCount: number;
  followersCount: number;
  followingCount: number;
  isFollowing?: boolean;
  isOwnProfile?: boolean;
  createdAt: string;
}

// ── Post Types ──────────────────────────────────────────────────────────────
export interface Post {
  id: string;
  userId: string;
  mediaType: MediaType;
  mediaUrl: string;
  thumbnailUrl?: string | null;
  caption?: string | null;
  aspectRatio: AspectRatio;
  duration?: number | null;
  likesCount: number;
  commentsCount: number;
  viewsCount?: number;
  isLiked?: boolean;
  isSaved?: boolean;
  user: UserSummary;
  tags?: string[];
  createdAt: string;
}

export interface PostDetail extends Post {
  user: UserProfile;
}

// ── Comment Types ───────────────────────────────────────────────────────────
export interface Comment {
  id: string;
  postId: string;
  content: string;
  likesCount: number;
  parentId?: string | null;
  createdAt: string;
  user: UserSummary;
  replies?: Comment[];
}

// ── Notification Types ──────────────────────────────────────────────────────
export interface Notification {
  id: string;
  recipientId: string;
  actorId: string;
  actor: UserSummary;
  type: NotificationType;
  postId?: string | null;
  commentId?: string | null;
  isRead: boolean;
  createdAt: string;
}

// ── Tag Types ───────────────────────────────────────────────────────────────
export interface Tag {
  id: string;
  name: string;
  postsCount: number;
}

// ── Auth Types ──────────────────────────────────────────────────────────────
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthSession {
  user: UserSummary & { email: string };
  accessToken: string;
  refreshToken: string;
}

// ── API Envelopes ───────────────────────────────────────────────────────────
export interface ApiResponse<T> {
  data: T;
  message?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  nextCursor: string | null;
  hasMore?: boolean;
}

