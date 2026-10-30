import { prisma } from '../../lib/prisma';
import { redis, KEYS } from '../../lib/redis';
import { mediaQueue, fanOutQueue } from '../media/media.queue';
import { createError } from '../../middleware/error-handler';
import { isDbAvailable, devStore } from '../../lib/dev-store';
import type { CreatePostInput, CreateCommentInput, PaginationInput } from './post.schema';
import type { MediaType, AspectRatio } from '@prisma/client';

// ─────────────────────────────────────────────────────────────────────────────
// Type helpers
// ─────────────────────────────────────────────────────────────────────────────
export function decodeCursor(cursor?: string): { id: string; createdAt: Date } | null {
  if (!cursor) return null;
  try {
    const decoded = Buffer.from(cursor, 'base64url').toString('utf-8');
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

export function encodeCursor(id: string, createdAt: Date): string {
  return Buffer.from(JSON.stringify({ id, createdAt })).toString('base64url');
}

// ─────────────────────────────────────────────────────────────────────────────
// Post Service
// ─────────────────────────────────────────────────────────────────────────────
export class PostService {
  /**
   * Create a new post, enqueue media processing, and trigger fan-out.
   */
  async createPost(userId: string, input: CreatePostInput) {
    const dbUp = await isDbAvailable();
    if (!dbUp) {
      return devStore.createPost(userId, input);
    }

    const post = await prisma.$transaction(async (tx) => {
      // Upsert tags
      const tagRecords = await Promise.all(
        input.tags.map((name) =>
          tx.tag.upsert({
            where: { name },
            create: { name },
            update: {},
            select: { id: true },
          })
        )
      );

      const newPost = await tx.post.create({
        data: {
          userId,
          mediaType: input.mediaType as MediaType,
          mediaUrl: input.mediaUrl,
          thumbnailUrl: input.thumbnailUrl,
          caption: input.caption,
          aspectRatio: input.aspectRatio as AspectRatio,
          duration: input.duration,
          width: input.width,
          height: input.height,
          fileSize: input.fileSize ? BigInt(input.fileSize) : undefined,
          processingStatus: 'PENDING',
          tags: {
            create: tagRecords.map((t) => ({ tagId: t.id })),
          },
        },
        include: {
          user: {
            select: {
              id: true, username: true, displayName: true,
              avatarUrl: true, isVerified: true,
            },
          },
          tags: { include: { tag: true } },
        },
      });

      return newPost;
    });

    // Enqueue async media processing
    await mediaQueue.add('process-media', {
      postId: post.id,
      userId,
      mediaUrl: post.mediaUrl,
      mediaType: post.mediaType,
      s3Key: input.s3Key ?? '',
    });

    // Enqueue fan-out to followers' feeds
    await fanOutQueue.add('fan-out', {
      postId: post.id,
      userId,
      createdAt: post.createdAt.toISOString(),
    });

    return this.formatPost(post, userId);
  }

  /**
   * Get a single post by ID.
   */
  async getPost(postId: string, viewerId?: string) {
    const dbUp = await isDbAvailable();
    if (!dbUp) {
      const p = devStore.getPostById(postId, viewerId);
      if (!p) throw createError(404, 'Post not found');
      return p;
    }

    const post = await prisma.post.findUnique({
      where: { id: postId, isArchived: false },
      include: {
        user: {
          select: {
            id: true, username: true, displayName: true,
            avatarUrl: true, isVerified: true,
          },
        },
        tags: { include: { tag: { select: { id: true, name: true } } } },
        _count: { select: { likes: true, comments: true } },
      },
    });

    if (!post) throw createError(404, 'Post not found');

    let isLiked = false;
    let isSaved = false;
    if (viewerId) {
      const [like, saved] = await Promise.all([
        prisma.like.findUnique({ where: { userId_postId: { userId: viewerId, postId } } }),
        prisma.savedPost.findUnique({ where: { userId_postId: { userId: viewerId, postId } } }),
      ]);
      isLiked = !!like;
      isSaved = !!saved;

      // Increment view count asynchronously
      prisma.post.update({
        where: { id: postId },
        data: { viewsCount: { increment: 1 } },
      }).catch(() => {}); // fire-and-forget
    }

    return { ...this.formatPost(post, viewerId), isLiked, isSaved };
  }

  /**
   * Delete a post (only by owner).
   */
  async deletePost(postId: string, userId: string): Promise<void> {
    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { userId: true },
    });
    if (!post) throw createError(404, 'Post not found');
    if (post.userId !== userId) throw createError(403, 'Forbidden');

    await prisma.post.delete({ where: { id: postId } });

    // Remove from Redis feed caches
    const key = KEYS.feed(userId);
    await redis.zrem(key, postId);
  }

  /**
   * Like a post with optimistic counter increment.
   */
  async likePost(postId: string, userId: string): Promise<{ likesCount: number }> {
    const dbUp = await isDbAvailable();
    if (!dbUp) {
      return { likesCount: devStore.likePost(postId, userId) };
    }

    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { id: true, userId: true, likesCount: true },
    });
    if (!post) throw createError(404, 'Post not found');

    // Upsert-style: try to create, silently ignore duplicate
    try {
      await prisma.like.create({ data: { userId, postId } });
    } catch {
      // Already liked — return current count
      return { likesCount: post.likesCount };
    }

    // Cache the like in Redis for fast feed scoring
    await redis.sadd(KEYS.postLikes(postId), userId);

    // Create notification (async, non-blocking)
    if (post.userId !== userId) {
      prisma.notification.create({
        data: { recipientId: post.userId, actorId: userId, type: 'LIKE', postId },
      }).catch(() => {});
    }

    return { likesCount: post.likesCount + 1 };
  }

  /**
   * Unlike a post.
   */
  async unlikePost(postId: string, userId: string): Promise<{ likesCount: number }> {
    const dbUp = await isDbAvailable();
    if (!dbUp) {
      return { likesCount: devStore.unlikePost(postId, userId) };
    }

    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { id: true, likesCount: true },
    });
    if (!post) throw createError(404, 'Post not found');

    await prisma.like.deleteMany({ where: { userId, postId } });
    await redis.srem(KEYS.postLikes(postId), userId);

    return { likesCount: Math.max(post.likesCount - 1, 0) };
  }

  /**
   * Save (bookmark) a post.
   */
  async savePost(postId: string, userId: string): Promise<{ saved: boolean }> {
    const dbUp = await isDbAvailable();
    if (!dbUp) {
      return { saved: devStore.savePost(postId, userId) };
    }

    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { id: true },
    });
    if (!post) throw createError(404, 'Post not found');

    await prisma.savedPost.upsert({
      where: { userId_postId: { userId, postId } },
      create: { userId, postId },
      update: {},
    });

    return { saved: true };
  }

  /**
   * Unsave (remove bookmark) a post.
   */
  async unsavePost(postId: string, userId: string): Promise<{ saved: boolean }> {
    const dbUp = await isDbAvailable();
    if (!dbUp) {
      return { saved: devStore.unsavePost(postId, userId) };
    }

    await prisma.savedPost.deleteMany({
      where: { userId, postId },
    });

    return { saved: false };
  }

  /**
   * Get user's saved (bookmarked) posts.
   */
  async getSavedPosts(userId: string, pagination: PaginationInput) {
    const dbUp = await isDbAvailable();
    if (!dbUp) {
      const items = devStore.getSavedPosts(userId);
      return { items, nextCursor: null, hasMore: false };
    }

    const cursor = decodeCursor(pagination.cursor);

    const savedPosts = await prisma.savedPost.findMany({
      where: {
        userId,
        ...(cursor
          ? {
              OR: [
                { createdAt: { lt: cursor.createdAt } },
                { createdAt: cursor.createdAt, postId: { lt: cursor.id } },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: 'desc' }],
      take: pagination.limit + 1,
      include: {
        post: {
          include: {
            user: {
              select: { id: true, username: true, displayName: true, avatarUrl: true, isVerified: true },
            },
            tags: { include: { tag: { select: { id: true, name: true } } } },
            _count: { select: { likes: true, comments: true } },
          },
        },
      },
    });

    const hasMore = savedPosts.length > pagination.limit;
    const items = hasMore ? savedPosts.slice(0, pagination.limit) : savedPosts;
    const formatted = items.map((sp) => ({
      ...this.formatPost(sp.post, userId),
      isSaved: true,
      savedAt: sp.createdAt,
    }));

    const nextCursor = hasMore && items.length > 0
      ? encodeCursor(items[items.length - 1].postId, items[items.length - 1].createdAt)
      : null;

    return { items: formatted, nextCursor, hasMore };
  }

  /**
   * Get paginated comments for a post.
   */
  async getComments(
    postId: string,
    pagination: PaginationInput,
    viewerId?: string
  ) {
    const dbUp = await isDbAvailable();
    if (!dbUp) {
      const items = devStore.getComments(postId);
      return { items, nextCursor: null, hasMore: false };
    }

    const cursor = decodeCursor(pagination.cursor);

    const comments = await prisma.comment.findMany({
      where: {
        postId,
        parentId: null, // top-level only
        isDeleted: false,
        ...(cursor
          ? {
              OR: [
                { createdAt: { lt: cursor.createdAt } },
                { createdAt: cursor.createdAt, id: { lt: cursor.id } },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: 'desc' }],
      take: pagination.limit + 1,
      include: {
        user: {
          select: { id: true, username: true, avatarUrl: true, isVerified: true },
        },
        replies: {
          where: { isDeleted: false },
          orderBy: { createdAt: 'asc' },
          take: 3,
          include: {
            user: {
              select: { id: true, username: true, avatarUrl: true, isVerified: true },
            },
          },
        },
        _count: { select: { replies: true } },
      },
    });

    const hasMore = comments.length > pagination.limit;
    const items = hasMore ? comments.slice(0, pagination.limit) : comments;
    const nextCursor = hasMore
      ? encodeCursor(items[items.length - 1].id, items[items.length - 1].createdAt)
      : null;

    return { items, nextCursor, hasMore };
  }

  /**
   * Add a comment or reply.
   */
  async addComment(
    postId: string,
    userId: string,
    input: CreateCommentInput
  ) {
    const dbUp = await isDbAvailable();
    if (!dbUp) {
      return devStore.addComment(postId, userId, input.content, input.parentId);
    }

    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { id: true, userId: true },
    });
    if (!post) throw createError(404, 'Post not found');

    if (input.parentId) {
      const parent = await prisma.comment.findUnique({
        where: { id: input.parentId, postId },
        select: { id: true, userId: true },
      });
      if (!parent) throw createError(404, 'Parent comment not found');
    }

    const comment = await prisma.comment.create({
      data: {
        postId,
        userId,
        parentId: input.parentId,
        content: input.content,
      },
      include: {
        user: {
          select: { id: true, username: true, avatarUrl: true, isVerified: true },
        },
      },
    });

    // Async notifications
    const notifyUserId = input.parentId
      ? (await prisma.comment.findUnique({ where: { id: input.parentId }, select: { userId: true } }))?.userId
      : post.userId;

    if (notifyUserId && notifyUserId !== userId) {
      prisma.notification.create({
        data: {
          recipientId: notifyUserId,
          actorId: userId,
          type: input.parentId ? 'REPLY' : 'COMMENT',
          postId,
          commentId: comment.id,
        },
      }).catch(() => {});
    }

    return comment;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private formatPost(post: any, _viewerId?: string) {
    return {
      id: post.id,
      mediaType: post.mediaType,
      mediaUrl: post.mediaUrl,
      thumbnailUrl: post.thumbnailUrl,
      caption: post.caption,
      aspectRatio: post.aspectRatio,
      duration: post.duration,
      likesCount: post.likesCount ?? post._count?.likes ?? 0,
      commentsCount: post.commentsCount ?? post._count?.comments ?? 0,
      viewsCount: post.viewsCount ?? 0,
      processingStatus: post.processingStatus,
      tags: post.tags?.map((pt: { tag: { id: string; name: string } }) => pt.tag.name) ?? [],
      user: post.user,
      createdAt: post.createdAt,
    };
  }
}
