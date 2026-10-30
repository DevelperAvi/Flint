import Redis from 'ioredis';
import { env } from '../config/env';

const hasPlaceholder =
  env.REDIS_URL.includes('********') ||
  env.REDIS_URL.includes('[YOUR-PASSWORD]') ||
  env.REDIS_URL.includes('your-password');

const isTls =
  env.REDIS_URL.startsWith('rediss://') ||
  env.REDIS_URL.includes('upstash.io');

const effectiveUrl =
  isTls && env.REDIS_URL.startsWith('redis://')
    ? env.REDIS_URL.replace(/^redis:\/\//, 'rediss://')
    : env.REDIS_URL;

export const redis = hasPlaceholder
  ? new Redis({ lazyConnect: true })
  : new Redis(effectiveUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => {
        if (times > 5) return null; // stop retrying if Redis is unavailable
        return Math.min(times * 200, 2000);
      },
      enableReadyCheck: true,
      ...(isTls ? { tls: { rejectUnauthorized: false } } : {}),
    });

redis.on('connect', () => console.log('✅ Redis connected'));
redis.on('error', (err) => {
  if (!hasPlaceholder) {
    console.error('❌ Redis error:', err.message);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Redis Key Constants
// ─────────────────────────────────────────────────────────────────────────────
export const KEYS = {
  // Sorted sets: feed:<user_id>  → members = post_ids, scores = unix timestamps
  feed: (userId: string) => `feed:${userId}`,

  // Hashes: post:<post_id>  → cached post metadata
  post: (postId: string) => `post:${postId}`,

  // Strings: session:<user_id>  → online/recent activity
  userSession: (userId: string) => `session:${userId}`,

  // Strings: rate:<endpoint>:<ip>
  rateLimit: (endpoint: string, ip: string) => `rate:${endpoint}:${ip}`,

  // Sorted set: explore:trending → post_ids scored by engagement
  trending: () => `explore:trending`,

  // Sets: post_likes:<post_id> → user_ids who liked
  postLikes: (postId: string) => `post_likes:${postId}`,

  // Strings: unread_notifications:<user_id>
  unreadNotifications: (userId: string) => `notif:unread:${userId}`,
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Feed Cache Utilities
// ─────────────────────────────────────────────────────────────────────────────
export const FEED_MAX_ITEMS = 500; // cap per user feed cache
export const FEED_TTL_SECONDS = 60 * 60 * 24; // 24 hours

/**
 * Add a post to a user's feed sorted set.
 * Score = unix timestamp in milliseconds for cursor-based pagination.
 */
export async function addToFeed(
  userId: string,
  postId: string,
  score: number
): Promise<void> {
  const key = KEYS.feed(userId);
  const pipeline = redis.pipeline();
  pipeline.zadd(key, score, postId);
  pipeline.zremrangebyrank(key, 0, -(FEED_MAX_ITEMS + 1)); // trim oldest
  pipeline.expire(key, FEED_TTL_SECONDS);
  await pipeline.exec();
}

/**
 * Remove a post from all followers' feeds (e.g., on post deletion).
 */
export async function removeFromFeed(
  followerIds: string[],
  postId: string
): Promise<void> {
  if (!followerIds.length) return;
  const pipeline = redis.pipeline();
  for (const uid of followerIds) {
    pipeline.zrem(KEYS.feed(uid), postId);
  }
  await pipeline.exec();
}

/**
 * Fan-out: push new post to all followers' sorted feed sets.
 * For accounts with >10k followers, we skip active fans and use pull-on-read.
 */
export async function fanOutPost(
  followerIds: string[],
  postId: string,
  score: number,
  batchSize = 100
): Promise<void> {
  for (let i = 0; i < followerIds.length; i += batchSize) {
    const batch = followerIds.slice(i, i + batchSize);
    const pipeline = redis.pipeline();
    for (const uid of batch) {
      const key = KEYS.feed(uid);
      pipeline.zadd(key, score, postId);
      pipeline.zremrangebyrank(key, 0, -(FEED_MAX_ITEMS + 1));
      pipeline.expire(key, FEED_TTL_SECONDS);
    }
    await pipeline.exec();
  }
}
