import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { optionalAuthenticate } from '../../middleware/authenticate';
import { env } from '../../config/env';
import { randomUUID } from 'crypto';
import path from 'path';
import fs from 'fs';
import os from 'os';
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

function getUploadsDir(): string {
  const localDir = path.resolve(process.cwd(), 'uploads');
  try {
    fs.mkdirSync(localDir, { recursive: true });
    fs.accessSync(localDir, fs.constants.W_OK);
    return localDir;
  } catch {
    const tmpDir = path.join(os.tmpdir(), 'flint-uploads');
    fs.mkdirSync(tmpDir, { recursive: true });
    return tmpDir;
  }
}

export async function mediaRoutes(fastify: FastifyInstance): Promise<void> {
  // Support binary buffer uploads for direct local dev uploads
  fastify.addContentTypeParser(
    /^image\/|^video\/|^application\/octet-stream/,
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

      // Direct API upload fallback (when external S3/MinIO is not connected)
      const host = (request.headers['x-forwarded-host'] as string) || request.headers.host || request.hostname;
      const proto = (request.headers['x-forwarded-proto'] as string) || request.protocol;
      const baseUrl = `${proto}://${host}`;

      const key = `${folder}/${userId}/${randomUUID()}.${ext}`;
      const uploadUrl = `${baseUrl}/api/v1/media/upload-direct?key=${encodeURIComponent(key)}`;
      const publicUrl = `${baseUrl}/uploads/${key}`;

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
      try {
        const key = request.query.key;
        if (!key) {
          return reply.status(400).send({ error: 'BadRequest', message: 'Missing key parameter' });
        }

        const normalizedKey = key.replace(/\\/g, '/').replace(/^\/+/, '');
        const uploadsDir = getUploadsDir();
        const parts = normalizedKey.split('/').filter(Boolean);
        const targetPath = path.join(uploadsDir, ...parts);

        await fs.promises.mkdir(path.dirname(targetPath), { recursive: true });

        let fileBuffer: Buffer;
        if (Buffer.isBuffer(request.body)) {
          fileBuffer = request.body;
        } else if (typeof request.body === 'string') {
          fileBuffer = Buffer.from(request.body, 'binary');
        } else if (request.body && typeof request.body === 'object') {
          if (request.body instanceof Uint8Array) {
            fileBuffer = Buffer.from(request.body);
          } else {
            fileBuffer = Buffer.from(JSON.stringify(request.body));
          }
        } else {
          fileBuffer = Buffer.from([]);
        }

        await fs.promises.writeFile(targetPath, fileBuffer);

        const host = (request.headers['x-forwarded-host'] as string) || request.headers.host || request.hostname;
        const proto = (request.headers['x-forwarded-proto'] as string) || request.protocol;
        const baseUrl = `${proto}://${host}`;

        return reply.status(200).send({
          success: true,
          key: normalizedKey,
          publicUrl: `${baseUrl}/uploads/${normalizedKey}`,
        });
      } catch (err: unknown) {
        request.log.error(err, 'Failed to save direct upload');
        const message = err instanceof Error ? err.message : 'Unknown upload error';
        return reply.status(500).send({ error: 'UploadFailed', message });
      }
    }
  );
}
