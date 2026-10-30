import { FastifyInstance } from 'fastify';
import { StoryService, createStorySchema } from './story.service';
import { authenticate, optionalAuthenticate } from '../../middleware/authenticate';

export async function storyRoutes(fastify: FastifyInstance): Promise<void> {
  const storyService = new StoryService();

  // ── GET /api/v1/stories ──────────────────────────────────────────────────
  fastify.get(
    '/',
    { schema: { tags: ['stories'] }, preHandler: [optionalAuthenticate] },
    async (request, reply) => {
      const feed = await storyService.getActiveStories(request.user?.id);
      return reply.send({ data: feed });
    }
  );

  // ── POST /api/v1/stories ─────────────────────────────────────────────────
  fastify.post(
    '/',
    { schema: { tags: ['stories'], security: [{ bearerAuth: [] }] }, preHandler: [authenticate] },
    async (request, reply) => {
      const body = createStorySchema.parse(request.body);
      const story = await storyService.createStory(request.user.id, body);
      return reply.status(201).send({ data: story });
    }
  );

  // ── DELETE /api/v1/stories/:id ───────────────────────────────────────────
  fastify.delete<{ Params: { id: string } }>(
    '/:id',
    { schema: { tags: ['stories'], security: [{ bearerAuth: [] }] }, preHandler: [authenticate] },
    async (request, reply) => {
      const result = await storyService.deleteStory(request.user.id, request.params.id);
      return reply.send({ data: result });
    }
  );
}
