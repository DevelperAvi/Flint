import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { UserService, updateProfileSchema } from './user.service';
import { authenticate, optionalAuthenticate } from '../../middleware/authenticate';
import { z } from 'zod';

const searchQuerySchema = z.object({ q: z.string().min(1).max(100) });

export async function userRoutes(fastify: FastifyInstance): Promise<void> {
  const userService = new UserService();

  // ── GET /api/v1/users/search ─────────────────────────────────────────────
  fastify.get<{ Querystring: Record<string, string> }>(
    '/search',
    { schema: { tags: ['users'] }, preHandler: [optionalAuthenticate] },
    async (request, reply) => {
      const { q } = searchQuerySchema.parse(request.query);
      const users = await userService.searchUsers(q);
      return reply.send({ data: users });
    }
  );

  // ── GET /api/v1/users/:username ──────────────────────────────────────────
  fastify.get<{ Params: { username: string } }>(
    '/:username',
    { schema: { tags: ['users'] }, preHandler: [optionalAuthenticate] },
    async (request, reply) => {
      const profile = await userService.getProfile(request.params.username, request.user?.id);
      return reply.send({ data: profile });
    }
  );

  // ── GET /api/v1/users/:username/posts ────────────────────────────────────
  fastify.get<{ Params: { username: string }; Querystring: Record<string, string> }>(
    '/:username/posts',
    { schema: { tags: ['users'] }, preHandler: [optionalAuthenticate] },
    async (request, reply) => {
      const { cursor, limit } = request.query;
      const result = await userService.getUserPosts(
        request.params.username,
        request.user?.id,
        cursor,
        limit ? parseInt(limit) : 18
      );
      return reply.send({ data: result });
    }
  );

  // ── GET /api/v1/users/:username/followers ────────────────────────────────
  fastify.get<{ Params: { username: string }; Querystring: Record<string, string> }>(
    '/:username/followers',
    { schema: { tags: ['users'] }, preHandler: [optionalAuthenticate] },
    async (request, reply) => {
      const result = await userService.getFollowers(request.params.username, request.query.cursor);
      return reply.send({ data: result });
    }
  );

  // ── GET /api/v1/users/:username/following ────────────────────────────────
  fastify.get<{ Params: { username: string }; Querystring: Record<string, string> }>(
    '/:username/following',
    { schema: { tags: ['users'] }, preHandler: [optionalAuthenticate] },
    async (request, reply) => {
      const result = await userService.getFollowing(request.params.username, request.query.cursor);
      return reply.send({ data: result });
    }
  );

  // ── POST /api/v1/users/:username/follow ──────────────────────────────────
  fastify.post<{ Params: { username: string } }>(
    '/:username/follow',
    { schema: { tags: ['users'], security: [{ bearerAuth: [] }] }, preHandler: [authenticate] },
    async (request, reply) => {
      const result = await userService.follow(request.user.id, request.params.username);
      return reply.send({ data: result });
    }
  );

  // ── DELETE /api/v1/users/:username/follow ────────────────────────────────
  fastify.delete<{ Params: { username: string } }>(
    '/:username/follow',
    { schema: { tags: ['users'], security: [{ bearerAuth: [] }] }, preHandler: [authenticate] },
    async (request, reply) => {
      const result = await userService.unfollow(request.user.id, request.params.username);
      return reply.send({ data: result });
    }
  );

  // ── PATCH /api/v1/users/me ───────────────────────────────────────────────
  fastify.patch(
    '/me',
    { schema: { tags: ['users'], security: [{ bearerAuth: [] }] }, preHandler: [authenticate] },
    async (request, reply) => {
      const body = updateProfileSchema.parse(request.body);
      const user = await userService.updateProfile(request.user.id, body);
      return reply.send({ data: user });
    }
  );
}
