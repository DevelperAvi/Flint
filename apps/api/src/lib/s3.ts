import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '../config/env';
import { randomUUID } from 'crypto';
import net from 'net';

let s3Available: boolean | null = null;
let lastS3Check = 0;

/**
 * Check if the S3/MinIO endpoint is reachable via TCP socket.
 * Cached for 30 seconds to prevent connection overhead.
 */
export async function isS3Available(): Promise<boolean> {
  const now = Date.now();
  if (s3Available !== null && now - lastS3Check < 30000) {
    return s3Available;
  }

  s3Available = await new Promise<boolean>((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(300);
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.once('error', () => {
      socket.destroy();
      resolve(false);
    });

    try {
      const endpoint = env.S3_ENDPOINT || 'http://localhost:9000';
      const u = new URL(endpoint);
      const port = parseInt(u.port || (u.protocol === 'https:' ? '443' : '80'), 10);
      const host = u.hostname || '127.0.0.1';
      socket.connect(port, host);
    } catch {
      resolve(false);
    }
  });

  lastS3Check = now;
  return s3Available;
}

export const s3 = new S3Client({
  region: env.S3_REGION,
  endpoint: env.S3_ENDPOINT,
  credentials: {
    accessKeyId: env.S3_ACCESS_KEY_ID,
    secretAccessKey: env.S3_SECRET_ACCESS_KEY,
  },
  forcePathStyle: true, // Required for MinIO / R2
});

export type MediaMimeType =
  | 'image/jpeg'
  | 'image/webp'
  | 'image/png'
  | 'video/mp4'
  | 'video/webm';

export type UploadFolder = 'posts' | 'avatars' | 'stories' | 'thumbnails';

interface PresignedUploadResult {
  uploadUrl: string;
  key: string;
  publicUrl: string;
  expiresIn: number;
}

/**
 * Generate a presigned PUT URL for direct browser-to-S3 uploads.
 * The client uploads directly — the API server never touches the binary.
 */
export async function generatePresignedUploadUrl(
  folder: UploadFolder,
  mimeType: MediaMimeType,
  userId: string,
  fileExtension: string
): Promise<PresignedUploadResult> {
  const expiresIn = 900; // 15 minutes
  const key = `${folder}/${userId}/${randomUUID()}.${fileExtension}`;

  const command = new PutObjectCommand({
    Bucket: env.S3_BUCKET_NAME,
    Key: key,
    ContentType: mimeType,
    Metadata: {
      'uploaded-by': userId,
      'upload-timestamp': Date.now().toString(),
    },
  });

  const uploadUrl = await getSignedUrl(s3, command, { expiresIn });
  const publicUrl = `${env.S3_PUBLIC_URL}/${key}`;

  return { uploadUrl, key, publicUrl, expiresIn };
}

/**
 * Generate a presigned GET URL for private/protected media access.
 */
export async function generatePresignedDownloadUrl(
  key: string,
  expiresIn = 3600
): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: env.S3_BUCKET_NAME,
    Key: key,
  });
  return getSignedUrl(s3, command, { expiresIn });
}

/**
 * Delete a media object from S3/R2.
 */
export async function deleteMediaObject(key: string): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: env.S3_BUCKET_NAME,
    Key: key,
  });
  await s3.send(command);
}

/**
 * Derive the public CDN URL for a given storage key.
 */
export function getPublicUrl(key: string): string {
  return `${env.S3_PUBLIC_URL}/${key}`;
}

/**
 * Validate that a MIME type is allowed for upload.
 */
export function isAllowedMimeType(mime: string): mime is MediaMimeType {
  return [
    'image/jpeg',
    'image/webp',
    'image/png',
    'video/mp4',
    'video/webm',
  ].includes(mime);
}

/**
 * Resolve file extension from MIME type.
 */
export function mimeToExtension(mime: MediaMimeType): string {
  const map: Record<MediaMimeType, string> = {
    'image/jpeg': 'jpg',
    'image/webp': 'webp',
    'image/png': 'png',
    'video/mp4': 'mp4',
    'video/webm': 'webm',
  };
  return map[mime];
}
