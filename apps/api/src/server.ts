import 'dotenv/config';
import Fastify from 'fastify';
import fs from 'fs';
import path from 'path';
import { fastifyJwt } from '@fastify/jwt';
import { fastifyCors } from '@fastify/cors';
import { fastifyHelmet } from '@fastify/helmet';
import { fastifyRateLimit } from '@fastify/rate-limit';
import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUi from '@fastify/swagger-ui';
import { prisma } from './lib/prisma';
import { redis } from './lib/redis';
import { env } from './config/env';
import { authRoutes } from './modules/auth/auth.routes';
import { userRoutes } from './modules/user/user.routes';
import { postRoutes } from './modules/post/post.routes';
import { feedRoutes } from './modules/feed/feed.routes';
import { mediaRoutes } from './modules/media/media.routes';
import { exploreRoutes } from './modules/explore/explore.routes';
import { notificationRoutes } from './modules/notification/notification.routes';
import { errorHandler } from './middleware/error-handler';

const app = Fastify({
  bodyLimit: 50 * 1024 * 1024, // 50MB limit for media uploads
  logger: {
    level: env.LOG_LEVEL,
    transport:
      env.NODE_ENV === 'development'
        ? { target: 'pino-pretty', options: { colorize: true } }
        : undefined,
  },
  trustProxy: true,
  ajv: {
    customOptions: { strict: 'log', keywords: ['kind', 'modifier'] },
  },
});

async function buildApp() {
  // ── Security ──────────────────────────────────────────────────────────────
  await app.register(fastifyHelmet, {
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  });

  await app.register(fastifyCors, {
    origin: (origin, cb) => {
      // Allow requests with no origin (mobile apps, curl, server-to-server)
      if (!origin) {
        cb(null, true);
        return;
      }
      // Allow any vercel domain or localhost
      if (
        origin.endsWith('.vercel.app') ||
        origin.includes('localhost') ||
        origin.includes('127.0.0.1')
      ) {
        cb(null, true);
        return;
      }
      // Allow specified CORS_ORIGIN or dynamically allow the origin
      if (env.CORS_ORIGIN === '*' || origin === env.CORS_ORIGIN) {
        cb(null, true);
        return;
      }
      cb(null, true);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  });

  // Support empty or form-urlencoded POST requests (e.g. /like, /save, /follow)
  app.addContentTypeParser(
    'application/x-www-form-urlencoded',
    { parseAs: 'string' },
    (_req, _body, done) => {
      done(null, {});
    }
  );

  // Allow optional/empty JSON bodies (e.g. POST /like without payload)
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (_req, body, done) => {
    try {
      const json = (body as string).trim() ? JSON.parse(body as string) : {};
      done(null, json);
    } catch (err) {
      done(err as Error, undefined);
    }
  });

  await app.register(fastifyRateLimit, {
    global: true,
    max: 200,
    timeWindow: '1 minute',
    ...(redis.status === 'ready' ? { redis } : {}),
    keyGenerator: (req) =>
      req.headers['x-forwarded-for']?.toString() || req.ip,
  });

  // ── Auth ──────────────────────────────────────────────────────────────────
  await app.register(fastifyJwt, {
    secret: env.JWT_ACCESS_SECRET,
    sign: { algorithm: 'HS256', expiresIn: env.JWT_ACCESS_EXPIRY },
  });

  // ── Swagger docs ──────────────────────────────────────────────────────────
  if (env.NODE_ENV !== 'production') {
    await app.register(fastifySwagger, {
      openapi: {
        info: { title: 'Flint API', version: '1.0.0' },
        components: {
          securitySchemes: {
            bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
          },
        },
      },
    });
    await app.register(fastifySwaggerUi, { routePrefix: '/docs' });
  }

  // ── Error handler ─────────────────────────────────────────────────────────
  app.setErrorHandler(errorHandler);

  // ── Root info & Health check ─────────────────────────────────────────────
  app.get('/', async () => ({
    name: 'Flint API',
    status: 'online',
    version: '1.0.0',
    health: '/health',
  }));

  app.get('/health', async () => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  }));

  // ── Routes ────────────────────────────────────────────────────────────────
  await app.register(authRoutes,         { prefix: '/api/v1/auth' });
  await app.register(userRoutes,         { prefix: '/api/v1/users' });
  await app.register(postRoutes,         { prefix: '/api/v1/posts' });
  await app.register(feedRoutes,         { prefix: '/api/v1/feed' });
  await app.register(mediaRoutes,        { prefix: '/api/v1/media' });
  await app.register(exploreRoutes,      { prefix: '/api/v1/explore' });
  await app.register(notificationRoutes, { prefix: '/api/v1/notifications' });

  // ── Static uploaded media (dev fallback) ──────────────────────────────────
  app.get('/uploads/*', async (request, reply) => {
    const wildcard = (request.params as { '*': string })['*'];
    const parts = wildcard.split(/[\/\\]/).filter(Boolean);
    const uploadsDir = path.resolve(process.cwd(), 'uploads');
    const safePath = path.join(uploadsDir, ...parts);

    if (!safePath.startsWith(uploadsDir)) {
      return reply.status(403).send({ error: 'Forbidden' });
    }

    if (!fs.existsSync(safePath)) {
      return reply.status(404).send({ error: 'File not found' });
    }

    const ext = path.extname(safePath).toLowerCase();
    const mimeMap: Record<string, string> = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.webp': 'image/webp',
      '.mp4': 'video/mp4',
      '.webm': 'video/webm',
    };

    reply.header('Content-Type', mimeMap[ext] || 'application/octet-stream');
    return reply.send(fs.createReadStream(safePath));
  });

  return app;
}

async function start() {
  try {
    const server = await buildApp();
    await server.listen({ port: env.PORT, host: '0.0.0.0' });
    server.log.info(`🔥 Flint API running at http://0.0.0.0:${env.PORT}`);
    server.log.info(`📚 Swagger docs at http://0.0.0.0:${env.PORT}/docs`);
  } catch (err) {
    app.log.error(err);
    await prisma.$disconnect();
    redis.disconnect();
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  app.log.info('SIGTERM received, shutting down gracefully...');
  await app.close();
  await prisma.$disconnect();
  redis.disconnect();
  process.exit(0);
});

start();
