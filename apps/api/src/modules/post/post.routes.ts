import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { PostService } from './post.service';
import {
  createPostSchema,
  createCommentSchema,
  paginationSchema,
} from './post.schema';
import { authenticate, optionalAuthenticate } from '../../middleware/authenticate';

export async function postRoutes(fastify: FastifyInstance): Promise<void> {
  const postService = new PostService();

  // ── POST /api/v1/posts ───────────────────────────────────────────────────
  fastify.post(
    '/',
    {
      schema: { description: 'Create a new post', tags: ['posts'], security: [{ bearerAuth: [] }] },
      preHandler: [authenticate],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = createPostSchema.parse(request.body);
      const post = await postService.createPost(request.user.id, body);
      return reply.status(201).send({ data: post });
    }
  );

  // ── GET /api/v1/posts/saved ───────────────────────────────────────────────
  fastify.get<{ Querystring: Record<string, string> }>(
    '/saved',
    {
      schema: { description: 'Get saved/bookmarked posts for current user', tags: ['posts'], security: [{ bearerAuth: [] }] },
      preHandler: [authenticate],
    },
    async (request, reply) => {
      const pagination = paginationSchema.parse(request.query);
      const result = await postService.getSavedPosts(request.user.id, pagination);
      return reply.send({ data: result });
    }
  );

  // ── GET /api/v1/posts/:id ─────────────────────────────────────────────────
  fastify.get<{ Params: { id: string } }>(
    '/:id',
    {
      schema: { description: 'Get a single post', tags: ['posts'] },
      preHandler: [optionalAuthenticate],
    },
    async (request, reply) => {
      const post = await postService.getPost(request.params.id, request.user?.id);
      return reply.send({ data: post });
    }
  );

  // ── DELETE /api/v1/posts/:id ──────────────────────────────────────────────
  fastify.delete<{ Params: { id: string } }>(
    '/:id',
    {
      schema: { description: 'Delete a post', tags: ['posts'], security: [{ bearerAuth: [] }] },
      preHandler: [authenticate],
    },
    async (request, reply) => {
      await postService.deletePost(request.params.id, request.user.id);
      return reply.send({ message: 'Post deleted successfully' });
    }
  );

  // ── POST /api/v1/posts/:id/like ───────────────────────────────────────────
  fastify.post<{ Params: { id: string } }>(
    '/:id/like',
    {
      schema: { description: 'Like a post', tags: ['posts'], security: [{ bearerAuth: [] }] },
      preHandler: [authenticate],
    },
    async (request, reply) => {
      const result = await postService.likePost(request.params.id, request.user.id);
      return reply.send({ data: result });
    }
  );

  // ── DELETE /api/v1/posts/:id/like ─────────────────────────────────────────
  fastify.delete<{ Params: { id: string } }>(
    '/:id/like',
    {
      schema: { description: 'Unlike a post', tags: ['posts'], security: [{ bearerAuth: [] }] },
      preHandler: [authenticate],
    },
    async (request, reply) => {
      const result = await postService.unlikePost(request.params.id, request.user.id);
      return reply.send({ data: result });
    }
  );

  // ── POST /api/v1/posts/:id/save ───────────────────────────────────────────
  fastify.post<{ Params: { id: string } }>(
    '/:id/save',
    {
      schema: { description: 'Save / bookmark a post', tags: ['posts'], security: [{ bearerAuth: [] }] },
      preHandler: [authenticate],
    },
    async (request, reply) => {
      const result = await postService.savePost(request.params.id, request.user.id);
      return reply.send({ data: result });
    }
  );

  // ── DELETE /api/v1/posts/:id/save ─────────────────────────────────────────
  fastify.delete<{ Params: { id: string } }>(
    '/:id/save',
    {
      schema: { description: 'Unsave / remove bookmark from post', tags: ['posts'], security: [{ bearerAuth: [] }] },
      preHandler: [authenticate],
    },
    async (request, reply) => {
      const result = await postService.unsavePost(request.params.id, request.user.id);
      return reply.send({ data: result });
    }
  );

  // ── GET /api/v1/posts/:id/comments ────────────────────────────────────────
  fastify.get<{ Params: { id: string }; Querystring: Record<string, string> }>(
    '/:id/comments',
    {
      schema: { description: 'Get comments for a post', tags: ['posts'] },
      preHandler: [optionalAuthenticate],
    },
    async (request, reply) => {
      const pagination = paginationSchema.parse(request.query);
      const result = await postService.getComments(
        request.params.id,
        pagination,
        request.user?.id
      );
      return reply.send({ data: result });
    }
  );

  // ── POST /api/v1/posts/:id/comments ───────────────────────────────────────
  fastify.post<{ Params: { id: string } }>(
    '/:id/comments',
    {
      schema: { description: 'Add a comment to a post', tags: ['posts'], security: [{ bearerAuth: [] }] },
      preHandler: [authenticate],
    },
    async (request, reply) => {
      const body = createCommentSchema.parse(request.body);
      const comment = await postService.addComment(request.params.id, request.user.id, body);
      return reply.status(201).send({ data: comment });
    }
  );
}
