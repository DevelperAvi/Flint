import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../../lib/prisma';
import { redis, KEYS } from '../../lib/redis';
import { optionalAuthenticate } from '../../middleware/authenticate';
import { isDbAvailable, devStore } from '../../lib/dev-store';
import { z } from 'zod';

const exploreQuerySchema = z.object({
  q: z.string().optional(),
  tag: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(30),
  cursor: z.string().optional(),
});

export async function exploreRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * GET /api/v1/explore
   * Grid-based discovery: trending posts + search by tag/username
   */
  fastify.get<{ Querystring: Record<string, string> }>(
    '/',
    { schema: { tags: ['explore'] }, preHandler: [optionalAuthenticate] },
    async (request, reply) => {
      const { q, tag, limit, cursor } = exploreQuerySchema.parse(request.query);

      const dbUp = await isDbAvailable();
      if (!dbUp) {
        if (q) {
          const users = devStore.searchUsers(q);
          return reply.send({ data: { users, tags: [], posts: [] } });
        }
        if (tag) {
          const posts = devStore.getPosts(request.user?.id).filter((p) => p.tags?.includes(tag.toLowerCase()));
          return reply.send({ data: { tag: { name: tag, postsCount: posts.length }, posts, nextCursor: null } });
        }
        const posts = devStore.getPosts(request.user?.id);
        return reply.send({ data: { posts, nextCursor: null } });
      }

      if (q) {
        // Text search across users and tags
        const [users, tags] = await Promise.all([
          prisma.user.findMany({
            where: {
              OR: [
                { username: { contains: q.toLowerCase(), mode: 'insensitive' } },
                { displayName: { contains: q, mode: 'insensitive' } },
              ],
            },
            select: {
              id: true, username: true, displayName: true, avatarUrl: true,
              isVerified: true, followersCount: true,
            },
            orderBy: { followersCount: 'desc' },
            take: 10,
          }),
          prisma.tag.findMany({
            where: { name: { contains: q.toLowerCase(), mode: 'insensitive' } },
            orderBy: { postsCount: 'desc' },
            take: 10,
          }),
        ]);

        return reply.send({ data: { users, tags, posts: [] } });
      }

      if (tag) {
        // Posts by tag
        const tagRecord = await prisma.tag.findUnique({
          where: { name: tag.toLowerCase() },
          select: { id: true, name: true, postsCount: true },
        });

        if (!tagRecord) {
          return reply.send({ data: { tag: null, posts: [], nextCursor: null } });
        }

        const posts = await prisma.post.findMany({
          where: {
            isArchived: false,
            processingStatus: 'READY',
            tags: { some: { tagId: tagRecord.id } },
          },
          orderBy: [{ likesCount: 'desc' }, { createdAt: 'desc' }],
          take: limit,
          select: {
            id: true, mediaType: true, mediaUrl: true, thumbnailUrl: true,
            likesCount: true, commentsCount: true, aspectRatio: true, createdAt: true,
          },
        });

        return reply.send({ data: { tag: tagRecord, posts, nextCursor: null } });
      }

      // Default: trending feed from Redis sorted set
      const trendingKey = KEYS.trending();
      const cached = await redis.zrevrange(trendingKey, 0, limit - 1);

      let posts;
      if (cached.length > 0) {
        posts = await prisma.post.findMany({
          where: {
            id: { in: cached },
            isArchived: false,
            processingStatus: 'READY',
          },
          select: {
            id: true, mediaType: true, mediaUrl: true, thumbnailUrl: true,
            likesCount: true, commentsCount: true, aspectRatio: true, createdAt: true,
            user: { select: { id: true, username: true, avatarUrl: true, isVerified: true } },
          },
        });
      } else {
        // Cold start: query most engaged posts from last 7 days
        const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        posts = await prisma.post.findMany({
          where: {
            isArchived: false,
            processingStatus: 'READY',
            createdAt: { gte: oneWeekAgo },
          },
          orderBy: [{ likesCount: 'desc' }, { commentsCount: 'desc' }],
          take: limit,
          select: {
            id: true, mediaType: true, mediaUrl: true, thumbnailUrl: true,
            likesCount: true, commentsCount: true, aspectRatio: true, createdAt: true,
            user: { select: { id: true, username: true, avatarUrl: true, isVerified: true } },
          },
        });

        // Cache the trending list for 1 hour
        if (posts.length > 0) {
          const pipeline = redis.pipeline();
          posts.forEach((p) => {
            const score = p.likesCount * 2 + p.commentsCount;
            pipeline.zadd(trendingKey, score, p.id);
          });
          pipeline.expire(trendingKey, 3600);
          await pipeline.exec();
        }
      }

      return reply.send({ data: { posts, nextCursor: null } });
    }
  );
}
