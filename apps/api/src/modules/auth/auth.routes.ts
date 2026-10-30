import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { AuthService } from './auth.service';
import { signupSchema, loginSchema, refreshTokenSchema } from './auth.schema';
import { authenticate, optionalAuthenticate } from '../../middleware/authenticate';

export async function authRoutes(fastify: FastifyInstance): Promise<void> {
  const authService = new AuthService(fastify);

  // ── POST /api/v1/auth/signup ─────────────────────────────────────────────
  fastify.post(
    '/signup',
    {
      schema: {
        description: 'Register a new user account',
        tags: ['auth'],
        body: {
          type: 'object',
          required: ['username', 'email', 'password'],
          properties: {
            username: { type: 'string' },
            email: { type: 'string' },
            password: { type: 'string' },
            displayName: { type: 'string' },
          },
        },
      },
      config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = signupSchema.parse(request.body);
      const result = await authService.signup(
        body,
        request.headers['user-agent'],
        request.ip
      );
      return reply.status(201).send({
        message: 'Account created successfully',
        data: result,
      });
    }
  );

  // ── POST /api/v1/auth/login ──────────────────────────────────────────────
  fastify.post(
    '/login',
    {
      schema: {
        description: 'Login with email/username and password',
        tags: ['auth'],
      },
      config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = loginSchema.parse(request.body);
      const result = await authService.login(
        body,
        request.headers['user-agent'],
        request.ip
      );
      return reply.send({ message: 'Login successful', data: result });
    }
  );

  // ── POST /api/v1/auth/refresh ────────────────────────────────────────────
  fastify.post(
    '/refresh',
    { schema: { description: 'Refresh access token using refresh token', tags: ['auth'] } },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { refreshToken } = refreshTokenSchema.parse(request.body);
      const tokens = await authService.refresh(refreshToken);
      return reply.send({ data: tokens });
    }
  );

  // ── POST /api/v1/auth/logout ─────────────────────────────────────────────
  fastify.post(
    '/logout',
    {
      schema: { description: 'Logout current session', tags: ['auth'], security: [{ bearerAuth: [] }] },
      preHandler: [optionalAuthenticate],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { refreshToken } = refreshTokenSchema.parse(request.body);
      await authService.logout(refreshToken);
      return reply.send({ message: 'Logged out successfully' });
    }
  );

  // ── POST /api/v1/auth/logout-all ─────────────────────────────────────────
  fastify.post(
    '/logout-all',
    {
      schema: { description: 'Logout all sessions', tags: ['auth'], security: [{ bearerAuth: [] }] },
      preHandler: [authenticate],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      await authService.logoutAll(request.user.id);
      return reply.send({ message: 'All sessions terminated' });
    }
  );

  // ── GET /api/v1/auth/me ──────────────────────────────────────────────────
  fastify.get(
    '/me',
    {
      schema: { description: 'Get current user', tags: ['auth'], security: [{ bearerAuth: [] }] },
      preHandler: [authenticate],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      return reply.send({ data: request.user });
    }
  );
}
