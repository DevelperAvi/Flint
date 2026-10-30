import { prisma } from './prisma';
import { hash, verify } from 'argon2';
import net from 'net';

let dbAvailable: boolean | null = null;
let lastDbCheck = 0;

export async function isDbAvailable(): Promise<boolean> {
  const now = Date.now();
  if (dbAvailable !== null && now - lastDbCheck < 30000) {
    return dbAvailable;
  }

  dbAvailable = await new Promise<boolean>((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(300);
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.once('error', () => {
      socket.destroy();
      resolve(false);
    });

    try {
      const dbUrl = process.env.DATABASE_URL;
      if (!dbUrl || dbUrl.includes('[YOUR-PASSWORD]')) {
        socket.destroy();
        resolve(false);
        return;
      }
      const u = new URL(dbUrl);
      const port = parseInt(u.port || '5432', 10);
      const host = u.hostname || '127.0.0.1';
      socket.connect(port, host);
    } catch {
      socket.destroy();
      resolve(false);
    }
  });

  lastDbCheck = now;
  return dbAvailable;
}

// ─────────────────────────────────────────────────────────────────────────────
// In-Memory Dev Store for offline / no-docker development
// ─────────────────────────────────────────────────────────────────────────────

export interface DevUser {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
  displayName: string;
  avatarUrl: string;
  bio?: string;
  website?: string;
  isVerified?: boolean;
  followersCount: number;
  followingCount: number;
  postsCount: number;
  createdAt: string;
}

export interface DevPost {
  id: string;
  userId: string;
  mediaType: 'IMAGE' | 'VIDEO';
  mediaUrl: string;
  thumbnailUrl?: string;
  caption?: string;
  aspectRatio: 'SQUARE' | 'PORTRAIT' | 'REEL' | 'LANDSCAPE';
  likesCount: number;
  commentsCount: number;
  viewsCount: number;
  tags: string[];
  createdAt: string;
  likedBy: Set<string>;
  savedBy: Set<string>;
}

export interface DevComment {
  id: string;
  postId: string;
  userId: string;
  content: string;
  parentId?: string;
  createdAt: string;
  likesCount: number;
}

export interface DevNotification {
  id: string;
  recipientId: string;
  actorId: string;
  type: 'LIKE' | 'COMMENT' | 'REPLY' | 'FOLLOW' | 'MENTION';
  postId?: string;
  commentId?: string;
  isRead: boolean;
  createdAt: string;
}

// Global in-memory storage
const users = new Map<string, DevUser>();
const posts = new Map<string, DevPost>();
const comments = new Map<string, DevComment>();
const notifications: DevNotification[] = [];
const refreshTokens = new Map<string, { userId: string; expiresAt: Date }>();
const follows = new Set<string>();
const stories: any[] = [];

// Seed default accounts
let isInitialized = false;

export async function initDevStore() {
  if (isInitialized) return;
  isInitialized = true;

  const defaultPasswordHash = await hash('Password123!');

  const seedUsers: DevUser[] = [
    {
      id: 'usr_flint',
      username: 'flint_official',
      email: 'team@flint.social',
      passwordHash: defaultPasswordHash,
      displayName: 'Flint Official',
      avatarUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=200&h=200&fit=crop',
      bio: 'Share your spark ✨ The next generation visual social experience.',
      website: 'https://flint.social',
      isVerified: true,
      followersCount: 14200,
      followingCount: 12,
      postsCount: 1,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'usr_sarah',
      username: 'sarah_lens',
      email: 'sarah@example.com',
      passwordHash: defaultPasswordHash,
      displayName: 'Sarah Jenkins',
      avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&fit=crop',
      bio: 'Visual artist & landscape photographer 📸 Wandering the Pacific Northwest.',
      website: 'https://sarahlens.art',
      isVerified: true,
      followersCount: 3820,
      followingCount: 245,
      postsCount: 1,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'usr_alex',
      username: 'alex_creatives',
      email: 'alex@example.com',
      passwordHash: defaultPasswordHash,
      displayName: 'Alex Rivers',
      avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&h=200&fit=crop',
      bio: 'Design systems engineer & generative 3D artist. Tokyo / SF.',
      website: 'https://rivers.design',
      isVerified: false,
      followersCount: 1940,
      followingCount: 310,
      postsCount: 1,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'usr_maya',
      username: 'travel_with_maya',
      email: 'maya@example.com',
      passwordHash: defaultPasswordHash,
      displayName: 'Maya Chen',
      avatarUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=200&h=200&fit=crop',
      bio: '42 countries and counting ✈️ Minimalist explorer. Coffee obsessed ☕',
      website: 'https://mayachen.co',
      isVerified: true,
      followersCount: 5620,
      followingCount: 180,
      postsCount: 1,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'usr_kai',
      username: 'kai_designs',
      email: 'kai@example.com',
      passwordHash: defaultPasswordHash,
      displayName: 'Kai Tanaka',
      avatarUrl: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=200&h=200&fit=crop',
      bio: 'Architecture & brutalist aesthetics. Building things that stand.',
      isVerified: false,
      followersCount: 890,
      followingCount: 115,
      postsCount: 1,
      createdAt: new Date().toISOString(),
    },
  ];

  for (const u of seedUsers) {
    users.set(u.id, u);
  }

  const seedPosts: DevPost[] = [
    {
      id: 'post_1',
      userId: 'usr_sarah',
      mediaType: 'IMAGE',
      mediaUrl: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=1080&h=1080&fit=crop',
      caption: 'Dawn over the misty valley. Golden hour light hit just right this morning. #photography #nature #vibes',
      aspectRatio: 'SQUARE',
      likesCount: 142,
      commentsCount: 2,
      viewsCount: 1200,
      tags: ['photography', 'nature', 'vibes'],
      createdAt: new Date(Date.now() - 3600000).toISOString(),
      likedBy: new Set(),
      savedBy: new Set(),
    },
    {
      id: 'post_2',
      userId: 'usr_alex',
      mediaType: 'IMAGE',
      mediaUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1080&h=1350&fit=crop',
      caption: 'Procedural chromatic glass explorations in Blender. #art #design #minimalism',
      aspectRatio: 'PORTRAIT',
      likesCount: 389,
      commentsCount: 1,
      viewsCount: 2800,
      tags: ['art', 'design', 'minimalism'],
      createdAt: new Date(Date.now() - 7200000).toISOString(),
      likedBy: new Set(),
      savedBy: new Set(),
    },
    {
      id: 'post_3',
      userId: 'usr_maya',
      mediaType: 'IMAGE',
      mediaUrl: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=1080&h=1080&fit=crop',
      caption: 'Quiet alleys of Kyoto in early spring. #travel #photography #vibes',
      aspectRatio: 'SQUARE',
      likesCount: 512,
      commentsCount: 0,
      viewsCount: 3400,
      tags: ['travel', 'photography', 'vibes'],
      createdAt: new Date(Date.now() - 14400000).toISOString(),
      likedBy: new Set(),
      savedBy: new Set(),
    },
    {
      id: 'post_4',
      userId: 'usr_kai',
      mediaType: 'IMAGE',
      mediaUrl: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?w=1080&h=1350&fit=crop',
      caption: 'Concrete forms & shadow geometry. #architecture #minimalism #design',
      aspectRatio: 'PORTRAIT',
      likesCount: 228,
      commentsCount: 0,
      viewsCount: 1900,
      tags: ['architecture', 'minimalism', 'design'],
      createdAt: new Date(Date.now() - 28800000).toISOString(),
      likedBy: new Set(),
      savedBy: new Set(),
    },
    {
      id: 'post_5',
      userId: 'usr_flint',
      mediaType: 'IMAGE',
      mediaUrl: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=1080&h=1080&fit=crop',
      caption: 'Welcome to Flint! ✨ Share your moments, discover creators, and spark new ideas. #vibes #art',
      aspectRatio: 'SQUARE',
      likesCount: 1042,
      commentsCount: 0,
      viewsCount: 9500,
      tags: ['vibes', 'art'],
      createdAt: new Date(Date.now() - 86400000).toISOString(),
      likedBy: new Set(),
      savedBy: new Set(),
    },
  ];

  for (const p of seedPosts) {
    posts.set(p.id, p);
  }

  comments.set('cmt_1', {
    id: 'cmt_1',
    postId: 'post_1',
    userId: 'usr_alex',
    content: 'Incredible lighting Sarah! What lens did you use for this?',
    createdAt: new Date(Date.now() - 1800000).toISOString(),
    likesCount: 3,
  });

  comments.set('cmt_2', {
    id: 'cmt_2',
    postId: 'post_1',
    userId: 'usr_sarah',
    parentId: 'cmt_1',
    content: '@alex_creatives 35mm f/1.4! Atmospheric haze did most of the work :)',
    createdAt: new Date(Date.now() - 900000).toISOString(),
    likesCount: 2,
  });

  notifications.push({
    id: 'notif_1',
    recipientId: 'usr_sarah',
    actorId: 'usr_alex',
    type: 'COMMENT',
    postId: 'post_1',
    isRead: false,
    createdAt: new Date(Date.now() - 1800000).toISOString(),
  });
}

// Initialize immediately
initDevStore().catch(console.error);

// ── Store API ───────────────────────────────────────────────────────────────

export const devStore = {
  findUserByEmailOrUsername(identifier: string): DevUser | undefined {
    const lower = identifier.toLowerCase();
    for (const u of users.values()) {
      if (u.email.toLowerCase() === lower || u.username.toLowerCase() === lower) {
        return u;
      }
    }
    return undefined;
  },

  findUserById(id: string): DevUser | undefined {
    return users.get(id);
  },

  createUser(user: Omit<DevUser, 'id' | 'createdAt' | 'followersCount' | 'followingCount' | 'postsCount'>): DevUser {
    const id = `usr_${Math.random().toString(36).slice(2, 10)}`;
    const created: DevUser = {
      ...user,
      id,
      followersCount: 0,
      followingCount: 0,
      postsCount: 0,
      createdAt: new Date().toISOString(),
    };
    users.set(id, created);
    return created;
  },

  searchUsers(q: string): DevUser[] {
    const lower = q.toLowerCase();
    return Array.from(users.values())
      .filter((u) => u.username.includes(lower) || u.displayName.toLowerCase().includes(lower))
      .slice(0, 10);
  },

  getPosts(viewerId?: string): any[] {
    return Array.from(posts.values())
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .map((p) => {
        const author = users.get(p.userId) ?? {
          id: p.userId,
          username: 'user',
          displayName: 'User',
          avatarUrl: undefined,
          isVerified: false,
        };
        return {
          ...p,
          user: {
            id: author.id,
            username: author.username,
            displayName: author.displayName,
            avatarUrl: author.avatarUrl,
            isVerified: author.isVerified,
          },
          isLiked: viewerId ? p.likedBy.has(viewerId) : false,
          isSaved: viewerId ? p.savedBy.has(viewerId) : false,
        };
      });
  },

  getPostById(postId: string, viewerId?: string): any | null {
    const post = posts.get(postId);
    if (!post) return null;
    const author = users.get(post.userId);
    return {
      ...post,
      user: author,
      isLiked: viewerId ? post.likedBy.has(viewerId) : false,
      isSaved: viewerId ? post.savedBy.has(viewerId) : false,
    };
  },

  getUserPosts(username: string): any[] {
    const user = this.findUserByEmailOrUsername(username);
    if (!user) return [];
    return Array.from(posts.values())
      .filter((p) => p.userId === user.id)
      .map((p) => ({
        ...p,
        user: { id: user.id, username: user.username, displayName: user.displayName, avatarUrl: user.avatarUrl },
      }));
  },

  createPost(userId: string, data: any): any {
    const id = `post_${Math.random().toString(36).slice(2, 10)}`;
    const newPost: DevPost = {
      id,
      userId,
      mediaType: data.mediaType ?? 'IMAGE',
      mediaUrl: data.mediaUrl,
      thumbnailUrl: data.thumbnailUrl,
      caption: data.caption,
      aspectRatio: data.aspectRatio ?? 'SQUARE',
      likesCount: 0,
      commentsCount: 0,
      viewsCount: 0,
      tags: data.tags ?? [],
      createdAt: new Date().toISOString(),
      likedBy: new Set(),
      savedBy: new Set(),
    };
    posts.set(id, newPost);

    const user = users.get(userId);
    if (user) user.postsCount++;

    return {
      ...newPost,
      user: user ?? { id: userId, username: 'you' },
    };
  },

  likePost(postId: string, userId: string): number {
    const p = posts.get(postId);
    if (!p) return 0;
    if (!p.likedBy.has(userId)) {
      p.likedBy.add(userId);
      p.likesCount++;
    }
    return p.likesCount;
  },

  unlikePost(postId: string, userId: string): number {
    const p = posts.get(postId);
    if (!p) return 0;
    if (p.likedBy.has(userId)) {
      p.likedBy.delete(userId);
      p.likesCount = Math.max(0, p.likesCount - 1);
    }
    return p.likesCount;
  },

  savePost(postId: string, userId: string): boolean {
    const p = posts.get(postId);
    if (!p) return false;
    p.savedBy.add(userId);
    return true;
  },

  unsavePost(postId: string, userId: string): boolean {
    const p = posts.get(postId);
    if (!p) return false;
    p.savedBy.delete(userId);
    return false;
  },

  getSavedPosts(userId: string): any[] {
    return Array.from(posts.values())
      .filter((p) => p.savedBy.has(userId))
      .map((p) => ({
        ...p,
        user: users.get(p.userId),
        isSaved: true,
      }));
  },

  getComments(postId: string): any[] {
    const all = Array.from(comments.values()).filter((c) => c.postId === postId);
    const topLevel = all.filter((c) => !c.parentId);
    return topLevel.map((c) => ({
      ...c,
      user: users.get(c.userId),
      replies: all
        .filter((r) => r.parentId === c.id)
        .map((r) => ({ ...r, user: users.get(r.userId) })),
    }));
  },

  addComment(postId: string, userId: string, content: string, parentId?: string): any {
    const id = `cmt_${Math.random().toString(36).slice(2, 10)}`;
    const comment: DevComment = {
      id,
      postId,
      userId,
      content,
      parentId,
      createdAt: new Date().toISOString(),
      likesCount: 0,
    };
    comments.set(id, comment);

    const p = posts.get(postId);
    if (p) p.commentsCount++;

    return {
      ...comment,
      user: users.get(userId),
    };
  },

  getNotifications(userId: string): any[] {
    return notifications
      .filter((n) => n.recipientId === userId)
      .map((n) => ({
        ...n,
        actor: users.get(n.actorId) ?? { id: n.actorId, username: 'user' },
      }));
  },

  markNotificationsRead(userId: string) {
    for (const n of notifications) {
      if (n.recipientId === userId) n.isRead = true;
    }
  },

  saveRefreshToken(token: string, userId: string, expiresAt: Date) {
    refreshTokens.set(token, { userId, expiresAt });
  },

  getRefreshToken(token: string) {
    return refreshTokens.get(token);
  },

  deleteRefreshToken(token: string) {
    refreshTokens.delete(token);
  },

  follow(followerId: string, targetId: string): boolean {
    const key = `${followerId}:${targetId}`;
    if (follows.has(key)) return true;
    follows.add(key);
    const follower = users.get(followerId);
    if (follower) follower.followingCount++;
    const target = users.get(targetId);
    if (target) {
      target.followersCount++;
      notifications.unshift({
        id: `notif_${Date.now()}`,
        recipientId: targetId,
        actorId: followerId,
        type: 'FOLLOW',
        isRead: false,
        createdAt: new Date().toISOString(),
      });
    }
    return true;
  },

  unfollow(followerId: string, targetId: string): boolean {
    const key = `${followerId}:${targetId}`;
    if (!follows.has(key)) return false;
    follows.delete(key);
    const follower = users.get(followerId);
    if (follower) follower.followingCount = Math.max(0, follower.followingCount - 1);
    const target = users.get(targetId);
    if (target) target.followersCount = Math.max(0, target.followersCount - 1);
    return false;
  },

  isFollowing(followerId: string, targetId: string): boolean {
    return follows.has(`${followerId}:${targetId}`);
  },

  getFollowers(userId: string): any[] {
    const result: any[] = [];
    for (const entry of follows) {
      const [fId, tId] = entry.split(':');
      if (tId === userId) {
        const u = users.get(fId);
        if (u) result.push(u);
      }
    }
    return result;
  },

  getFollowing(userId: string): any[] {
    const result: any[] = [];
    for (const entry of follows) {
      const [fId, tId] = entry.split(':');
      if (fId === userId) {
        const u = users.get(tId);
        if (u) result.push(u);
      }
    }
    return result;
  },

  createStory(userId: string, data: any): any {
    const user = users.get(userId);
    const story = {
      id: `story_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      userId,
      mediaUrl: data.mediaUrl,
      mediaType: data.mediaType ?? 'IMAGE',
      duration: data.duration ?? 5,
      viewsCount: 0,
      createdAt: new Date().toISOString(),
      expiresAt: data.expiresAt,
      filter: data.metadata?.filter ?? 'normal',
      musicTrack: data.metadata?.musicTrack,
      caption: data.metadata?.caption,
      user: user
        ? {
            id: user.id,
            username: user.username,
            displayName: user.displayName,
            avatarUrl: user.avatarUrl,
            isVerified: user.isVerified ?? false,
          }
        : { id: userId, username: 'anonymous' },
    };

    let userStories = stories.find((s) => s.user.id === userId);
    if (!userStories) {
      userStories = { user: story.user, stories: [] };
      stories.unshift(userStories);
    }
    userStories.stories.unshift(story);
    return story;
  },

  getActiveStories(): any[] {
    const now = Date.now();
    return stories
      .map((userGroup) => ({
        ...userGroup,
        stories: userGroup.stories.filter(
          (s: any) => new Date(s.expiresAt).getTime() > now
        ),
      }))
      .filter((userGroup) => userGroup.stories.length > 0);
  },

  deleteStory(userId: string, storyId: string): { success: boolean } {
    for (const userGroup of stories) {
      if (userGroup.user.id === userId) {
        userGroup.stories = userGroup.stories.filter((s: any) => s.id !== storyId);
      }
    }
    return { success: true };
  },
};

