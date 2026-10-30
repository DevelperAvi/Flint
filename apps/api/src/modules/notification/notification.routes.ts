import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../../lib/prisma';
import { authenticate } from '../../middleware/authenticate';
import { isDbAvailable, devStore } from '../../lib/dev-store';
import { z } from 'zod';

const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().optional(),
});

export async function notificationRoutes(fastify: FastifyInstance): Promise<void> {
  // ── GET /api/v1/notifications ────────────────────────────────────────────
  fastify.get<{ Querystring: Record<string, string> }>(
    '/',
    { schema: { tags: ['notifications'], security: [{ bearerAuth: [] }] }, preHandler: [authenticate] },
    async (request, reply) => {
      const { limit, cursor } = paginationSchema.parse(request.query);

      const dbUp = await isDbAvailable();
      if (!dbUp) {
        const items = devStore.getNotifications(request.user.id);
        return reply.send({ data: { items, nextCursor: null, hasMore: false } });
      }

      const notifications = await prisma.notification.findMany({
        where: {
          recipientId: request.user.id,
          ...(cursor ? { createdAt: { lt: new Date(Buffer.from(cursor, 'base64url').toString()) } } : {}),
        },
        orderBy: { createdAt: 'desc' },
        take: limit + 1,
        include: {
          actor: {
            select: { id: true, username: true, avatarUrl: true, isVerified: true },
          },
        },
      });

      const hasMore = notifications.length > limit;
      const items = hasMore ? notifications.slice(0, limit) : notifications;
      const lastItem = items[items.length - 1];
      const nextCursor = hasMore && lastItem
        ? Buffer.from(lastItem.createdAt.toISOString()).toString('base64url')
        : null;

      return reply.send({ data: { items, nextCursor, hasMore } });
    }
  );

  // ── POST /api/v1/notifications/read-all ──────────────────────────────────
  fastify.post(
    '/read-all',
    { schema: { tags: ['notifications'], security: [{ bearerAuth: [] }] }, preHandler: [authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const dbUp = await isDbAvailable();
      if (!dbUp) {
        devStore.markNotificationsRead(request.user.id);
        return reply.send({ message: 'All notifications marked as read' });
      }

      await prisma.notification.updateMany({
        where: { recipientId: request.user.id, isRead: false },
        data: { isRead: true },
      });
      return reply.send({ message: 'All notifications marked as read' });
    }
  );

  // ── GET /api/v1/notifications/unread-count ────────────────────────────────
  fastify.get(
    '/unread-count',
    { schema: { tags: ['notifications'], security: [{ bearerAuth: [] }] }, preHandler: [authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const dbUp = await isDbAvailable();
      if (!dbUp) {
        const count = devStore.getNotifications(request.user.id).filter((n) => !n.isRead).length;
        return reply.send({ data: { count } });
      }

      const count = await prisma.notification.count({
        where: { recipientId: request.user.id, isRead: false },
      });
      return reply.send({ data: { count } });
    }
  );
}
