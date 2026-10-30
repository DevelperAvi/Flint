import { prisma } from '../../lib/prisma';
import { isDbAvailable, devStore } from '../../lib/dev-store';
import { createError } from '../../middleware/error-handler';
import { z } from 'zod';

export const createStorySchema = z.object({
  mediaUrl: z.string().url(),
  mediaType: z.enum(['IMAGE', 'VIDEO']).default('IMAGE'),
  duration: z.number().optional().default(5),
  filter: z.string().optional().default('normal'),
  musicTrack: z.object({
    id: z.string(),
    title: z.string(),
    artist: z.string(),
    audioUrl: z.string().optional(),
  }).optional(),
  caption: z.string().max(200).optional(),
});

export type CreateStoryInput = z.infer<typeof createStorySchema>;

export class StoryService {
  async createStory(userId: string, input: CreateStoryInput) {
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Pack extra story metadata (filter, musicTrack, caption) into metadata json
    const metaObj = {
      filter: input.filter ?? 'normal',
      musicTrack: input.musicTrack,
      caption: input.caption,
    };
    const metadataString = JSON.stringify(metaObj);

    const dbUp = await isDbAvailable();
    if (!dbUp) {
      return devStore.createStory(userId, {
        mediaUrl: input.mediaUrl,
        mediaType: input.mediaType,
        duration: input.duration,
        expiresAt: expiresAt.toISOString(),
        metadata: metaObj,
      });
    }

    const story = await prisma.story.create({
      data: {
        userId,
        mediaUrl: input.mediaUrl,
        mediaType: input.mediaType,
        thumbnailUrl: metadataString,
        duration: input.duration,
        expiresAt,
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
            isVerified: true,
          },
        },
      },
    });

    return {
      ...story,
      metadata: metaObj,
    };
  }

  async getActiveStories(viewerId?: string) {
    const now = new Date();
    const dbUp = await isDbAvailable();
    if (!dbUp) {
      return devStore.getActiveStories();
    }

    const stories = await prisma.story.findMany({
      where: {
        expiresAt: { gt: now },
      },
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
            isVerified: true,
          },
        },
      },
    });

    // Group stories by user
    const userStoriesMap = new Map<string, { user: any; stories: any[] }>();

    for (const story of stories) {
      let meta = { filter: 'normal', musicTrack: undefined, caption: undefined };
      try {
        if (story.thumbnailUrl && story.thumbnailUrl.startsWith('{')) {
          meta = JSON.parse(story.thumbnailUrl);
        }
      } catch {
        // fallback
      }

      const formattedStory = {
        id: story.id,
        mediaUrl: story.mediaUrl,
        mediaType: story.mediaType,
        duration: story.duration ?? 5,
        viewsCount: story.viewsCount,
        createdAt: story.createdAt,
        expiresAt: story.expiresAt,
        filter: meta.filter || 'normal',
        musicTrack: meta.musicTrack,
        caption: meta.caption,
      };

      if (!userStoriesMap.has(story.userId)) {
        userStoriesMap.set(story.userId, {
          user: story.user,
          stories: [formattedStory],
        });
      } else {
        userStoriesMap.get(story.userId)!.stories.push(formattedStory);
      }
    }

    return Array.from(userStoriesMap.values());
  }

  async deleteStory(userId: string, storyId: string) {
    const dbUp = await isDbAvailable();
    if (!dbUp) {
      return devStore.deleteStory(userId, storyId);
    }

    const story = await prisma.story.findUnique({
      where: { id: storyId },
    });

    if (!story) throw createError(404, 'Story not found');
    if (story.userId !== userId) throw createError(403, 'Forbidden');

    await prisma.story.delete({ where: { id: storyId } });
    return { success: true };
  }
}
