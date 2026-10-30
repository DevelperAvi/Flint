import { prisma } from '../../lib/prisma';
import { redis } from '../../lib/redis';
import { createError } from '../../middleware/error-handler';
import { isDbAvailable, devStore } from '../../lib/dev-store';
import { z } from 'zod';

export const updateProfileSchema = z.object({
  displayName: z.string().min(1).max(60).optional(),
  bio: z.string().max(160).optional(),
  website: z.string().url().or(z.literal('')).optional(),
  isPrivate: z.boolean().optional(),
  avatarUrl: z.string().url().optional(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export class UserService {
  async getProfile(username: string, viewerId?: string) {
    const dbUp = await isDbAvailable();
    if (!dbUp) {
      const u = devStore.findUserByEmailOrUsername(username);
      if (!u) throw createError(404, 'User not found');
      return { ...u, isFollowing: false, isFollowedBy: false, isOwnProfile: viewerId === u.id };
    }

    const user = await prisma.user.findUnique({
      where: { username },
      select: {
        id: true, username: true, displayName: true, avatarUrl: true,
        bio: true, website: true, isVerified: true, isPrivate: true,
        postsCount: true, followersCount: true, followingCount: true,
        createdAt: true,
      },
    });

    if (!user) throw createError(404, 'User not found');

    let isFollowing = false;
    let isFollowedBy = false;

    if (viewerId && viewerId !== user.id) {
      const [follow, followBack] = await Promise.all([
        prisma.follow.findUnique({
          where: { followerId_followingId: { followerId: viewerId, followingId: user.id } },
        }),
        prisma.follow.findUnique({
          where: { followerId_followingId: { followerId: user.id, followingId: viewerId } },
        }),
      ]);
      isFollowing = !!follow;
      isFollowedBy = !!followBack;
    }

    return { ...user, isFollowing, isFollowedBy };
  }

  async getUserPosts(
    username: string,
    viewerId: string | undefined,
    cursor?: string,
    limit = 18
  ) {
    const dbUp = await isDbAvailable();
    if (!dbUp) {
      const items = devStore.getUserPosts(username);
      return { items, nextCursor: null, hasMore: false };
    }

    const user = await prisma.user.findUnique({
      where: { username },
      select: { id: true, isPrivate: true },
    });
    if (!user) throw createError(404, 'User not found');

    // Private account check
    if (user.isPrivate && viewerId !== user.id) {
      const follows = viewerId
        ? await prisma.follow.findUnique({
            where: { followerId_followingId: { followerId: viewerId, followingId: user.id } },
          })
        : null;
      if (!follows) throw createError(403, 'This account is private');
    }

    const { decodeCursor, encodeCursor } = await import('../post/post.service');
    const parsedCursor = decodeCursor(cursor);

    const posts = await prisma.post.findMany({
      where: {
        userId: user.id,
        isArchived: false,
        processingStatus: 'READY',
        ...(parsedCursor
          ? {
              OR: [
                { createdAt: { lt: parsedCursor.createdAt } },
                { createdAt: parsedCursor.createdAt, id: { lt: parsedCursor.id } },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: 'desc' }],
      take: limit + 1,
      select: {
        id: true, mediaType: true, mediaUrl: true, thumbnailUrl: true,
        likesCount: true, commentsCount: true, aspectRatio: true, createdAt: true,
        duration: true,
      },
    });

    const hasMore = posts.length > limit;
    const items = hasMore ? posts.slice(0, limit) : posts;
    const lastItem = items[items.length - 1];
    const nextCursor = hasMore && lastItem ? encodeCursor(lastItem.id, lastItem.createdAt) : null;

    return { items, nextCursor, hasMore };
  }

  async follow(followerId: string, targetUsername: string) {
    const dbUp = await isDbAvailable();
    if (!dbUp) {
      const target = devStore.findUserByEmailOrUsername(targetUsername);
      if (!target) throw createError(404, 'User not found');
      if (target.id === followerId) throw createError(400, 'Cannot follow yourself');
      devStore.follow(followerId, target.id);
      return { following: true };
    }

    const target = await prisma.user.findUnique({
      where: { username: targetUsername },
      select: { id: true },
    });
    if (!target) throw createError(404, 'User not found');
    if (target.id === followerId) throw createError(400, 'Cannot follow yourself');

    try {
      await prisma.follow.create({
        data: { followerId, followingId: target.id },
      });
    } catch {
      // Already following — idempotent
    }

    // Create notification
    prisma.notification.create({
      data: { recipientId: target.id, actorId: followerId, type: 'FOLLOW' },
    }).catch(() => {});

    return { following: true };
  }

  async unfollow(followerId: string, targetUsername: string) {
    const dbUp = await isDbAvailable();
    if (!dbUp) {
      const target = devStore.findUserByEmailOrUsername(targetUsername);
      if (!target) throw createError(404, 'User not found');
      devStore.unfollow(followerId, target.id);
      return { following: false };
    }

    const target = await prisma.user.findUnique({
      where: { username: targetUsername },
      select: { id: true },
    });
    if (!target) throw createError(404, 'User not found');

    await prisma.follow.deleteMany({
      where: { followerId, followingId: target.id },
    });

    // Invalidate feed cache (user will rebuild on next request)
    await redis.del(`feed:${followerId}`);

    return { following: false };
  }

  async getFollowers(username: string, cursor?: string, limit = 20) {
    const dbUp = await isDbAvailable();
    if (!dbUp) {
      const user = devStore.findUserByEmailOrUsername(username);
      if (!user) throw createError(404, 'User not found');
      const items = devStore.getFollowers(user.id);
      return { items, nextCursor: null, hasMore: false };
    }

    const user = await prisma.user.findUnique({ where: { username }, select: { id: true } });
    if (!user) throw createError(404, 'User not found');

    const followers = await prisma.follow.findMany({
      where: {
        followingId: user.id,
        ...(cursor ? { createdAt: { lt: new Date(Buffer.from(cursor, 'base64url').toString()) } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      include: {
        follower: {
          select: { id: true, username: true, displayName: true, avatarUrl: true, isVerified: true, bio: true },
        },
      },
    });

    const hasMore = followers.length > limit;
    const items = hasMore ? followers.slice(0, limit) : followers;
    const lastItem = items[items.length - 1];
    const nextCursor = hasMore && lastItem
      ? Buffer.from(lastItem.createdAt.toISOString()).toString('base64url')
      : null;

    return { items: items.map((f) => f.follower), nextCursor, hasMore };
  }

  async getFollowing(username: string, cursor?: string, limit = 20) {
    const dbUp = await isDbAvailable();
    if (!dbUp) {
      const user = devStore.findUserByEmailOrUsername(username);
      if (!user) throw createError(404, 'User not found');
      const items = devStore.getFollowing(user.id);
      return { items, nextCursor: null, hasMore: false };
    }

    const user = await prisma.user.findUnique({ where: { username }, select: { id: true } });
    if (!user) throw createError(404, 'User not found');

    const following = await prisma.follow.findMany({
      where: {
        followerId: user.id,
        ...(cursor ? { createdAt: { lt: new Date(Buffer.from(cursor, 'base64url').toString()) } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      include: {
        following: {
          select: { id: true, username: true, displayName: true, avatarUrl: true, isVerified: true, bio: true },
        },
      },
    });

    const hasMore = following.length > limit;
    const items = hasMore ? following.slice(0, limit) : following;
    const lastItem = items[items.length - 1];
    const nextCursor = hasMore && lastItem
      ? Buffer.from(lastItem.createdAt.toISOString()).toString('base64url')
      : null;

    return { items: items.map((f) => f.following), nextCursor, hasMore };
  }

  async updateProfile(userId: string, input: UpdateProfileInput) {
    const dbUp = await isDbAvailable();
    if (!dbUp) {
      const user = devStore.findUserById(userId);
      if (!user) throw createError(404, 'User not found');
      if (input.displayName) user.displayName = input.displayName;
      if (input.bio !== undefined) user.bio = input.bio;
      if (input.website !== undefined) user.website = input.website || undefined;
      if (input.avatarUrl) user.avatarUrl = input.avatarUrl;
      return user;
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        displayName: input.displayName,
        bio: input.bio,
        website: input.website ?? null,
        isPrivate: input.isPrivate,
        avatarUrl: input.avatarUrl,
      },
      select: {
        id: true, username: true, displayName: true, avatarUrl: true,
        bio: true, website: true, isPrivate: true, isVerified: true,
      },
    });
    return user;
  }

  async searchUsers(query: string, limit = 20) {
    if (!query.trim()) return [];
    const dbUp = await isDbAvailable();
    if (!dbUp) {
      return devStore.searchUsers(query);
    }
    return prisma.user.findMany({
      where: {
        OR: [
          { username: { contains: query.toLowerCase(), mode: 'insensitive' } },
          { displayName: { contains: query, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true, username: true, displayName: true, avatarUrl: true,
        isVerified: true, followersCount: true,
      },
      orderBy: { followersCount: 'desc' },
      take: limit,
    });
  }
}
