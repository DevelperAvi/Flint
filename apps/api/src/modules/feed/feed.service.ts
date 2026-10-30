import { prisma } from '../../lib/prisma';
import { redis, KEYS, FEED_TTL_SECONDS } from '../../lib/redis';
import { decodeCursor, encodeCursor } from '../post/post.service';
import { isDbAvailable, devStore } from '../../lib/dev-store';
import type { PaginationInput } from '../post/post.schema';

// ─────────────────────────────────────────────────────────────────────────────
// Feed Service
// Hybrid Redis + PostgreSQL approach:
//   1. Try to serve from Redis sorted set (cache hit)
//   2. On cache miss, query PostgreSQL and populate the cache
//   3. Score = unix timestamp in ms for chronological ordering
//   4. Engagement weighting applied at read time from denormalized counts
// ─────────────────────────────────────────────────────────────────────────────
export class FeedService {
  /**
   * Get the home feed for a user.
   * Hybrid strategy: Redis-first, then PostgreSQL fallback.
   */
  async getHomeFeed(userId: string, pagination: PaginationInput) {
    const dbUp = await isDbAvailable();
    if (!dbUp) {
      const items = devStore.getPosts(userId);
      return { items, nextCursor: null, hasMore: false };
    }

    try {
      const feedKey = KEYS.feed(userId);
      const cacheExists = await redis.exists(feedKey);

      if (cacheExists) {
        return this.getFeedFromCache(userId, feedKey, pagination);
      }

      return this.getFeedFromDatabase(userId, feedKey, pagination);
    } catch {
      return this.getFeedFromDatabase(userId, KEYS.feed(userId), pagination);
    }
  }

  /**
   * Serve feed from Redis sorted set (cache hit path).
   * Uses ZREVRANGEBYSCORE for cursor-based pagination on score (timestamp).
   */
  private async getFeedFromCache(
    userId: string,
    feedKey: string,
    pagination: PaginationInput
  ) {
    const cursor = decodeCursor(pagination.cursor);
    const maxScore = cursor
      ? new Date(cursor.createdAt).getTime() - 1
      : '+inf';

    // Fetch post IDs from sorted set (newest first)
    const postIds = await redis.zrevrangebyscore(
      feedKey,
      maxScore,
      '-inf',
      'LIMIT',
      0,
      pagination.limit + 1
    );

    if (!postIds.length) {
      // Cache miss scenario — fall back to DB
      return this.getFeedFromDatabase(userId, feedKey, pagination);
    }

    const hasMore = postIds.length > pagination.limit;
    const ids = hasMore ? postIds.slice(0, pagination.limit) : postIds;

    // Batch fetch post details from Postgres
    const posts = await this.fetchPostsByIds(ids, userId);

    // Preserve Redis sorted-set order (posts may come back in arbitrary order from DB)
    const postsMap = new Map(posts.map((p) => [p.id, p]));
    const orderedPosts = ids.map((id) => postsMap.get(id)).filter(Boolean);

    const lastItem = orderedPosts[orderedPosts.length - 1];
    const nextCursor =
      hasMore && lastItem
        ? encodeCursor(lastItem.id, lastItem.createdAt)
        : null;

    return { items: orderedPosts, nextCursor, hasMore };
  }

  /**
   * Serve feed directly from PostgreSQL and populate Redis cache.
   * Used on cache miss (first load, cold start, expired TTL).
   */
  private async getFeedFromDatabase(
    userId: string,
    feedKey: string,
    pagination: PaginationInput
  ) {
    const cursor = decodeCursor(pagination.cursor);

    // Get IDs of users this person follows
    const following = await prisma.follow.findMany({
      where: { followerId: userId },
      select: { followingId: true },
    });
    const followingIds = following.map((f) => f.followingId);

    if (!followingIds.length) {
      // No follows — return empty feed
      return { items: [], nextCursor: null, hasMore: false };
    }

    const posts = await prisma.post.findMany({
      where: {
        userId: { in: followingIds },
        isArchived: false,
        processingStatus: 'READY',
        ...(cursor
          ? {
              OR: [
                { createdAt: { lt: cursor.createdAt } },
                { createdAt: cursor.createdAt, id: { lt: cursor.id } },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: pagination.limit + 1,
      include: {
        user: {
          select: {
            id: true, username: true, displayName: true,
            avatarUrl: true, isVerified: true,
          },
        },
        tags: { include: { tag: { select: { id: true, name: true } } } },
        likes: { where: { userId }, select: { userId: true }, take: 1 },
        savedBy: { where: { userId }, select: { userId: true }, take: 1 },
      },
    });

    const hasMore = posts.length > pagination.limit;
    const items = hasMore ? posts.slice(0, pagination.limit) : posts;

    // Warm the cache asynchronously
    this.warmCache(feedKey, items).catch(console.error);

    const formattedItems = items.map((p) => this.formatFeedPost(p));
    const lastItem = formattedItems[formattedItems.length - 1];
    const nextCursor =
      hasMore && lastItem
        ? encodeCursor(lastItem.id, lastItem.createdAt)
        : null;

    return { items: formattedItems, nextCursor, hasMore };
  }

  /**
   * Warm the Redis feed cache from a batch of posts.
   */
  private async warmCache(
    feedKey: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    posts: any[]
  ): Promise<void> {
    if (!posts.length) return;
    const pipeline = redis.pipeline();
    for (const post of posts) {
      pipeline.zadd(feedKey, post.createdAt.getTime(), post.id);
    }
    pipeline.expire(feedKey, FEED_TTL_SECONDS);
    await pipeline.exec();
  }

  /**
   * Batch-fetch full post data for a list of IDs.
   * Used for both cache-hit and cache-miss paths.
   */
  private async fetchPostsByIds(postIds: string[], viewerId: string) {
    const posts = await prisma.post.findMany({
      where: {
        id: { in: postIds },
        isArchived: false,
      },
      include: {
        user: {
          select: {
            id: true, username: true, displayName: true,
            avatarUrl: true, isVerified: true,
          },
        },
        tags: { include: { tag: { select: { id: true, name: true } } } },
        likes: { where: { userId: viewerId }, select: { userId: true }, take: 1 },
        savedBy: { where: { userId: viewerId }, select: { userId: true }, take: 1 },
      },
    });

    return posts.map((p) => this.formatFeedPost(p));
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private formatFeedPost(post: any) {
    return {
      id: post.id,
      mediaType: post.mediaType,
      mediaUrl: post.mediaUrl,
      thumbnailUrl: post.thumbnailUrl,
      caption: post.caption,
      aspectRatio: post.aspectRatio,
      duration: post.duration,
      likesCount: post.likesCount,
      commentsCount: post.commentsCount,
      viewsCount: post.viewsCount,
      isLiked: post.likes?.length > 0,
      isSaved: post.savedBy?.length > 0,
      tags: post.tags?.map((pt: { tag: { name: string } }) => pt.tag.name) ?? [],
      user: post.user,
      createdAt: post.createdAt,
    };
  }
}
