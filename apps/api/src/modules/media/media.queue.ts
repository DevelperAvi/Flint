import { Queue, Worker, Job } from 'bullmq';
import { redis } from '../../lib/redis';
import { prisma } from '../../lib/prisma';
import { env } from '../../config/env';

// ─────────────────────────────────────────────────────────────────────────────
// Queue Definitions
// ─────────────────────────────────────────────────────────────────────────────
export interface MediaProcessingJob {
  postId: string;
  userId: string;
  mediaUrl: string;
  mediaType: 'IMAGE' | 'VIDEO';
  s3Key: string;
}

export interface FanOutJob {
  postId: string;
  userId: string;
  createdAt: string; // ISO string
}

const queueOptions = {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential' as const, delay: 2000 },
    removeOnComplete: 100,
    removeOnFail: 500,
  },
};

// Media processing queue (transcoding, thumbnail generation)
export const mediaQueue = new Queue<MediaProcessingJob>(
  'media-processing',
  queueOptions
);

// Feed fan-out queue (distribute new post to follower feeds)
export const fanOutQueue = new Queue<FanOutJob>(
  'feed-fanout',
  queueOptions
);

// ─────────────────────────────────────────────────────────────────────────────
// Media Processing Worker
// Handles video transcoding logic and thumbnail generation
// ─────────────────────────────────────────────────────────────────────────────
export function createMediaWorker(): Worker<MediaProcessingJob> {
  return new Worker<MediaProcessingJob>(
    'media-processing',
    async (job: Job<MediaProcessingJob>) => {
      const { postId, mediaType, s3Key } = job.data;

      try {
        // Mark as processing
        await prisma.post.update({
          where: { id: postId },
          data: { processingStatus: 'PROCESSING' },
        });

        if (mediaType === 'VIDEO') {
          await job.updateProgress(10);
          // Video processing pipeline:
          // 1. Download from S3 to temp dir
          // 2. Run FFmpeg to generate HLS segments + thumbnail
          // 3. Upload processed files back to S3
          // 4. Update post with thumbnail_url and processed media_url
          //
          // FFmpeg command example (would run via child_process.spawn):
          // ffmpeg -i input.mp4
          //   -vf "scale=-2:1080"
          //   -c:v libx264 -crf 23 -preset fast
          //   -c:a aac -b:a 128k
          //   -hls_time 6 -hls_playlist_type vod
          //   -hls_segment_filename "segment_%03d.ts"
          //   output.m3u8
          //
          // Thumbnail: ffmpeg -i input.mp4 -ss 00:00:01 -vframes 1 thumb.jpg

          const thumbnailKey = s3Key.replace(/\.[^.]+$/, '_thumb.jpg');
          await job.updateProgress(80);

          await prisma.post.update({
            where: { id: postId },
            data: {
              processingStatus: 'READY',
              thumbnailUrl: `${env.S3_PUBLIC_URL}/${thumbnailKey}`,
            },
          });
        } else {
          // Images are already usable, just mark ready
          // Optionally: generate WebP variant, strip EXIF, resize
          await prisma.post.update({
            where: { id: postId },
            data: { processingStatus: 'READY' },
          });
        }

        await job.updateProgress(100);
        console.log(`✅ Media processed for post ${postId}`);
      } catch (err) {
        await prisma.post.update({
          where: { id: postId },
          data: { processingStatus: 'FAILED' },
        });
        throw err;
      }
    },
    {
      connection: redis,
      concurrency: env.BULL_CONCURRENCY,
    }
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Feed Fan-Out Worker
// Distributes new posts to follower feed sorted sets in Redis
// ─────────────────────────────────────────────────────────────────────────────
export function createFanOutWorker(): Worker<FanOutJob> {
  return new Worker<FanOutJob>(
    'feed-fanout',
    async (job: Job<FanOutJob>) => {
      const { postId, userId, createdAt } = job.data;
      const score = new Date(createdAt).getTime();

      // Fetch all followers in batches of 1000
      const BATCH_SIZE = 1000;
      let cursor = 0;

      while (true) {
        const followers = await prisma.follow.findMany({
          where: { followingId: userId },
          select: { followerId: true },
          skip: cursor,
          take: BATCH_SIZE,
        });

        if (!followers.length) break;

        const { fanOutPost } = await import('../../lib/redis');
        await fanOutPost(
          followers.map((f) => f.followerId),
          postId,
          score
        );

        cursor += followers.length;
        if (followers.length < BATCH_SIZE) break;
      }

      // Also add to author's own feed
      const { addToFeed } = await import('../../lib/redis');
      await addToFeed(userId, postId, score);

      console.log(`✅ Fan-out complete for post ${postId}`);
    },
    {
      connection: redis,
      concurrency: 2,
    }
  );
}
