import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { optionalAuthenticate } from '../../middleware/authenticate';
import { env } from '../../config/env';
import { randomUUID } from 'crypto';
import path from 'path';
import fs from 'fs';
import {
  generatePresignedUploadUrl,
  isAllowedMimeType,
  mimeToExtension,
  isS3Available,
  type UploadFolder,
  type MediaMimeType,
} from '../../lib/s3';

const uploadUrlQuerySchema = z.object({
  mimeType: z.string().default('image/png').refine(isAllowedMimeType, {
    message: 'Unsupported file type. Allowed: image/jpeg, image/webp, image/png, video/mp4, video/webm',
  }),
  folder: z.enum(['posts', 'avatars', 'stories', 'thumbnails']).default('posts'),
});

export async function mediaRoutes(fastify: FastifyInstance): Promise<void> {
  // Support binary buffer uploads for direct local dev uploads
  fastify.addContentTypeParser(
    ['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm', 'application/octet-stream'],
    { parseAs: 'buffer' },
    (_req, body, done) => {
      done(null, body);
    }
  );

  /**
   * GET /api/v1/media/upload-url
   *
   * Returns a presigned PUT URL so the client can upload directly to S3/R2,
   * or a local direct upload URL when running in dev mode without MinIO.
   */
  fastify.get(
    '/upload-url',
    {
      schema: {
        description: 'Generate a presigned URL for direct S3/R2 or local media upload',
        tags: ['media'],
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            mimeType: { type: 'string', default: 'image/png' },
            folder: { type: 'string', enum: ['posts', 'avatars', 'stories', 'thumbnails'], default: 'posts' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              data: {
                type: 'object',
                properties: {
                  uploadUrl: { type: 'string' },
                  key: { type: 'string' },
                  publicUrl: { type: 'string' },
                  expiresIn: { type: 'number' },
                },
              },
            },
          },
        },
      },
      preHandler: [optionalAuthenticate],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { mimeType, folder } = uploadUrlQuerySchema.parse(request.query);
      const userId = request.user?.id ?? (env.NODE_ENV === 'development' ? 'usr_sarah' : null);

      if (!userId) {
        return reply.status(401).send({
          error: 'Unauthorized',
          message: 'No Authorization was found in request.headers. Please log in or provide a Bearer token.',
        });
      }

      const ext = mimeToExtension(mimeType as MediaMimeType);
      const s3Up = await isS3Available();

      if (s3Up) {
        const result = await generatePresignedUploadUrl(
          folder as UploadFolder,
          mimeType as MediaMimeType,
          userId,
          ext
        );
        return reply.send({ data: result });
      }

      // Offline dev mode fallback: provide direct API upload URL
      const key = `${folder}/${userId}/${randomUUID()}.${ext}`;
      const uploadUrl = `http://localhost:3001/api/v1/media/upload-direct?key=${encodeURIComponent(key)}`;
      const publicUrl = `http://localhost:3001/uploads/${key}`;

      return reply.send({
        data: {
          uploadUrl,
          key,
          publicUrl,
          expiresIn: 900,
        },
      });
    }
  );

  /**
   * PUT /api/v1/media/upload-direct
   *
   * Accepts direct binary uploads for local storage when MinIO is not running.
   */
  fastify.put(
    '/upload-direct',
    async (request: FastifyRequest<{ Querystring: { key?: string } }>, reply: FastifyReply) => {
      const key = request.query.key;
      if (!key) {
        return reply.status(400).send({ error: 'BadRequest', message: 'Missing key parameter' });
      }

      const normalizedKey = key.replace(/\\/g, '/').replace(/^\/+/, '');
      const uploadsDir = path.resolve(process.cwd(), 'uploads');
      const parts = normalizedKey.split('/').filter(Boolean);
      const targetPath = path.join(uploadsDir, ...parts);

      await fs.promises.mkdir(path.dirname(targetPath), { recursive: true });
      await fs.promises.writeFile(targetPath, request.body as Buffer);

      return reply.status(200).send({
        success: true,
        key: normalizedKey,
        publicUrl: `http://localhost:3001/uploads/${normalizedKey}`,
      });
    }
  );
}
