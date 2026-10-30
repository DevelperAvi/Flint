import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { FeedService } from './feed.service';
import { paginationSchema } from '../post/post.schema';
import { authenticate } from '../../middleware/authenticate';

export async function feedRoutes(fastify: FastifyInstance): Promise<void> {
  const feedService = new FeedService();

  /**
   * GET /api/v1/feed
   *
   * Returns paginated home feed for the authenticated user.
   * Supports cursor-based infinite scroll via ?cursor=<base64-encoded-cursor>
   *
   * Response shape:
   * {
   *   data: {
   *     items: Post[],
   *     nextCursor: string | null,
   *     hasMore: boolean
   *   }
   * }
   */
  fastify.get<{ Querystring: Record<string, string> }>(
    '/',
    {
      schema: {
        description: 'Get paginated home feed (Redis-first, PostgreSQL fallback)',
        tags: ['feed'],
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            limit: { type: 'integer', minimum: 1, maximum: 50, default: 20 },
            cursor: { type: 'string' },
          },
        },
      },
      preHandler: [authenticate],
    },
    async (request, reply) => {
      const pagination = paginationSchema.parse(request.query);
      const result = await feedService.getHomeFeed(request.user.id, pagination);
      return reply.send({ data: result });
    }
  );
}
