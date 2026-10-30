import { PrismaClient } from '@prisma/client';
import { hash } from 'argon2';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting Flint database seeding...');

  // Clean existing data
  await prisma.notification.deleteMany();
  await prisma.savedPost.deleteMany();
  await prisma.postTag.deleteMany();
  await prisma.tag.deleteMany();
  await prisma.comment.deleteMany();
  await prisma.like.deleteMany();
  await prisma.story.deleteMany();
  await prisma.post.deleteMany();
  await prisma.follow.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.user.deleteMany();

  const defaultPasswordHash = await hash('Password123!');

  // ── 1. Create Users ───────────────────────────────────────────────────────
  const usersData = [
    {
      username: 'flint_official',
      email: 'team@flint.social',
      passwordHash: defaultPasswordHash,
      displayName: 'Flint Official',
      avatarUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=200&h=200&fit=crop',
      bio: 'Share your spark ✨ The next generation visual social experience.',
      website: 'https://flint.social',
      isVerified: true,
    },
    {
      username: 'sarah_lens',
      email: 'sarah@example.com',
      passwordHash: defaultPasswordHash,
      displayName: 'Sarah Jenkins',
      avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&fit=crop',
      bio: 'Visual artist & landscape photographer 📸 Wandering the Pacific Northwest.',
      website: 'https://sarahlens.art',
      isVerified: true,
    },
    {
      username: 'alex_creatives',
      email: 'alex@example.com',
      passwordHash: defaultPasswordHash,
      displayName: 'Alex Rivers',
      avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&h=200&fit=crop',
      bio: 'Design systems engineer & generative 3D artist. Tokyo / SF.',
      website: 'https://rivers.design',
      isVerified: false,
    },
    {
      username: 'travel_with_maya',
      email: 'maya@example.com',
      passwordHash: defaultPasswordHash,
      displayName: 'Maya Chen',
      avatarUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=200&h=200&fit=crop',
      bio: '42 countries and counting ✈️ Minimalist explorer. Coffee obsessed ☕',
      website: 'https://mayachen.co',
      isVerified: true,
    },
    {
      username: 'kai_designs',
      email: 'kai@example.com',
      passwordHash: defaultPasswordHash,
      displayName: 'Kai Tanaka',
      avatarUrl: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=200&h=200&fit=crop',
      bio: 'Architecture & brutalist aesthetics. Building things that stand.',
      isVerified: false,
    },
  ];

  const createdUsers = [];
  for (const u of usersData) {
    const user = await prisma.user.create({ data: u });
    createdUsers.push(user);
    console.log(` Created user: @${user.username}`);
  }

  const [flint, sarah, alex, maya, kai] = createdUsers;

  // ── 2. Create Tags ────────────────────────────────────────────────────────
  const tagNames = ['photography', 'art', 'minimalism', 'travel', 'vibes', 'architecture', 'nature', 'design'];
  const tagsMap: Record<string, string> = {};

  for (const name of tagNames) {
    const tag = await prisma.tag.create({
      data: { name, postsCount: 0 },
    });
    tagsMap[name] = tag.id;
  }

  // ── 3. Create Posts ───────────────────────────────────────────────────────
  const postsData = [
    {
      userId: sarah.id,
      mediaType: 'IMAGE' as const,
      mediaUrl: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=1080&h=1080&fit=crop',
      caption: 'Dawn over the misty valley. Golden hour light hit just right this morning. #photography #nature #vibes',
      aspectRatio: 'SQUARE' as const,
      tags: ['photography', 'nature', 'vibes'],
      likesCount: 142,
      commentsCount: 8,
      processingStatus: 'READY' as const,
    },
    {
      userId: alex.id,
      mediaType: 'IMAGE' as const,
      mediaUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1080&h=1350&fit=crop',
      caption: 'Procedural chromatic glass explorations in Blender. #art #design #minimalism',
      aspectRatio: 'PORTRAIT' as const,
      tags: ['art', 'design', 'minimalism'],
      likesCount: 389,
      commentsCount: 24,
      processingStatus: 'READY' as const,
    },
    {
      userId: maya.id,
      mediaType: 'IMAGE' as const,
      mediaUrl: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=1080&h=1080&fit=crop',
      caption: 'Quiet alleys of Kyoto in early spring. #travel #photography #vibes',
      aspectRatio: 'SQUARE' as const,
      tags: ['travel', 'photography', 'vibes'],
      likesCount: 512,
      commentsCount: 31,
      processingStatus: 'READY' as const,
    },
    {
      userId: kai.id,
      mediaType: 'IMAGE' as const,
      mediaUrl: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?w=1080&h=1350&fit=crop',
      caption: 'Concrete forms & shadow geometry. #architecture #minimalism #design',
      aspectRatio: 'PORTRAIT' as const,
      tags: ['architecture', 'minimalism', 'design'],
      likesCount: 228,
      commentsCount: 12,
      processingStatus: 'READY' as const,
    },
    {
      userId: flint.id,
      mediaType: 'IMAGE' as const,
      mediaUrl: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=1080&h=1080&fit=crop',
      caption: 'Welcome to Flint! ✨ Share your moments, discover creators, and spark new ideas. #vibes #art',
      aspectRatio: 'SQUARE' as const,
      tags: ['vibes', 'art'],
      likesCount: 1042,
      commentsCount: 65,
      processingStatus: 'READY' as const,
    },
  ];

  const createdPosts = [];
  for (const p of postsData) {
    const { tags, ...postFields } = p;
    const post = await prisma.post.create({
      data: {
        ...postFields,
        tags: {
          create: tags.map((t) => ({
            tag: { connect: { id: tagsMap[t] } },
          })),
        },
      },
    });

    // Update tag post counts
    for (const t of tags) {
      await prisma.tag.update({
        where: { id: tagsMap[t] },
        data: { postsCount: { increment: 1 } },
      });
    }

    // Update user post count
    await prisma.user.update({
      where: { id: p.userId },
      data: { postsCount: { increment: 1 } },
    });

    createdPosts.push(post);
  }

  // ── 4. Create Follows ─────────────────────────────────────────────────────
  const followPairs = [
    [sarah.id, flint.id],
    [alex.id, flint.id],
    [maya.id, flint.id],
    [kai.id, flint.id],
    [sarah.id, alex.id],
    [alex.id, sarah.id],
    [maya.id, sarah.id],
    [kai.id, alex.id],
  ];

  for (const [followerId, followingId] of followPairs) {
    await prisma.follow.create({
      data: { followerId, followingId },
    });
    await prisma.user.update({
      where: { id: followerId },
      data: { followingCount: { increment: 1 } },
    });
    await prisma.user.update({
      where: { id: followingId },
      data: { followersCount: { increment: 1 } },
    });
  }

  // ── 5. Create Comments ────────────────────────────────────────────────────
  const firstPost = createdPosts[0];
  await prisma.comment.create({
    data: {
      postId: firstPost.id,
      userId: alex.id,
      content: 'Incredible lighting Sarah! What lens did you use for this?',
    },
  });
  await prisma.comment.create({
    data: {
      postId: firstPost.id,
      userId: sarah.id,
      content: '@alex_creatives 35mm f/1.4! Atmospheric haze did most of the work :)',
    },
  });

  // ── 6. Create Stories ─────────────────────────────────────────────────────
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await prisma.story.create({
    data: {
      userId: sarah.id,
      mediaType: 'IMAGE',
      mediaUrl: 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=1080&h=1920&fit=crop',
      expiresAt: tomorrow,
    },
  });

  console.log('✅ Seed complete!');
  console.log('✨ Demo accounts password: Password123!');
  console.log('   - flint_official (Admin/Verified)');
  console.log('   - sarah_lens');
  console.log('   - alex_creatives');
  console.log('   - travel_with_maya');
  console.log('   - kai_designs');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

