import { z } from 'zod';

export const createPostSchema = z.object({
  mediaType: z.enum(['IMAGE', 'VIDEO']),
  mediaUrl: z.string().url('Invalid media URL'),
  thumbnailUrl: z.string().url().optional(),
  caption: z.string().max(2200).optional(),
  aspectRatio: z.enum(['SQUARE', 'PORTRAIT', 'REEL', 'LANDSCAPE']).default('SQUARE'),
  duration: z.number().positive().optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  fileSize: z.number().int().positive().optional(),
  tags: z.array(z.string().toLowerCase().trim()).max(30).default([]),
  s3Key: z.string().optional(), // original S3 key for processing
});

export const createCommentSchema = z.object({
  content: z.string().min(1).max(2200),
  parentId: z.string().optional(),
});

export const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().optional(), // base64-encoded cursor
});

export type CreatePostInput = z.infer<typeof createPostSchema>;
export type CreateCommentInput = z.infer<typeof createCommentSchema>;
export type PaginationInput = z.infer<typeof paginationSchema>;
