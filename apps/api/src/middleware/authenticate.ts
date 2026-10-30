import { FastifyRequest, FastifyReply } from 'fastify';
import '@fastify/jwt';
import { prisma } from '../lib/prisma';
import { isDbAvailable, devStore } from '../lib/dev-store';

// Extend @fastify/jwt to type request.user
declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: {
      id: string;
      username: string;
      email: string;
    };
    user: {
      id: string;
      username: string;
      email: string;
    };
  }
}

/**
 * Strict authentication middleware — requires a valid JWT access token.
 * Attach to any route that requires authentication.
 */
export async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    // Fastify-jwt extracts Bearer token from Authorization header
    await request.jwtVerify();

    const userId = (request.user as unknown as { id: string }).id;
    if (!userId) {
      return reply.status(401).send({ error: 'Unauthorized', message: 'Invalid token payload' });
    }

    const dbUp = await isDbAvailable();
    let user: { id: string; username: string; email: string } | null = null;

    if (dbUp) {
      user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, username: true, email: true },
      });
    } else {
      const devUser = devStore.findUserById(userId);
      if (devUser) {
        user = { id: devUser.id, username: devUser.username, email: devUser.email };
      }
    }

    if (!user) {
      return reply.status(401).send({ error: 'Unauthorized', message: 'User not found' });
    }

    request.user = user;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Authentication failed';
    return reply.status(401).send({ error: 'Unauthorized', message });
  }
}

/**
 * Optional authentication — attaches user context if a valid token is present,
 * but does NOT block the request if no token is provided.
 */
export async function optionalAuthenticate(
  request: FastifyRequest,
  _reply: FastifyReply
): Promise<void> {
  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return;

  try {
    await request.jwtVerify();
    const userId = (request.user as unknown as { id: string }).id;
    if (!userId) return;

    const dbUp = await isDbAvailable();
    let user: { id: string; username: string; email: string } | null = null;

    if (dbUp) {
      user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, username: true, email: true },
      });
    } else {
      const devUser = devStore.findUserById(userId);
      if (devUser) {
        user = { id: devUser.id, username: devUser.username, email: devUser.email };
      }
    }

    if (user) {
      request.user = user;
    }
  } catch {
    // Silently ignore auth errors for optional routes
  }
}
