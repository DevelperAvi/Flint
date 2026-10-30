'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Flame, Sparkles } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuthStore } from '@/store/auth.store';
import { flintApi } from '@/lib/api';
import { CreateStoryModal, STORY_MUSIC_TRACKS } from '../modals/create-story-modal';
import { StoryViewerModal, UserStoryGroup } from '../modals/story-viewer-modal';

// Initial curated community stories with music & filters
const SEED_STORIES: UserStoryGroup[] = [
  {
    user: {
      id: 'usr_flint_official',
      username: 'flint_official',
      displayName: 'Flint Official',
      avatarUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=200&h=200&fit=crop',
      isVerified: true,
    },
    stories: [
      {
        id: 's_flint_1',
        mediaUrl: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=1080&h=1920&fit=crop',
        mediaType: 'IMAGE',
        duration: 5,
        filter: 'solar',
        musicTrack: STORY_MUSIC_TRACKS[1], // Cyber Spark
        caption: 'Igniting creative sparks worldwide ✨🔥',
        createdAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
      },
    ],
  },
  {
    user: {
      id: 'usr_sarah',
      username: 'sarah_lens',
      displayName: 'Sarah Jenkins',
      avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&fit=crop',
      isVerified: true,
    },
    stories: [
      {
        id: 's_sarah_1',
        mediaUrl: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=1080&h=1920&fit=crop',
        mediaType: 'IMAGE',
        duration: 5,
        filter: 'cinema',
        musicTrack: STORY_MUSIC_TRACKS[0], // Sunset Horizon
        caption: 'Misty golden hour above the valley 🌄',
        createdAt: new Date(Date.now() - 4 * 3600 * 1000).toISOString(),
      },
    ],
  },
  {
    user: {
      id: 'usr_alex',
      username: 'alex_creatives',
      displayName: 'Alex Rivers',
      avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&h=200&fit=crop',
      isVerified: false,
    },
    stories: [
      {
        id: 's_alex_1',
        mediaUrl: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=1080&h=1920&fit=crop',
        mediaType: 'IMAGE',
        duration: 5,
        filter: 'cyber',
        musicTrack: STORY_MUSIC_TRACKS[3], // Flint Rhythm
        caption: 'Testing visual shader passes in real-time ⚡',
        createdAt: new Date(Date.now() - 6 * 3600 * 1000).toISOString(),
      },
    ],
  },
  {
    user: {
      id: 'usr_elena',
      username: 'elena_art',
      displayName: 'Elena Rostova',
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&h=200&fit=crop',
      isVerified: true,
    },
    stories: [
      {
        id: 's_elena_1',
        mediaUrl: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=1080&h=1920&fit=crop',
        mediaType: 'IMAGE',
        duration: 5,
        filter: 'vintage',
        musicTrack: STORY_MUSIC_TRACKS[2], // Golden Hour
        caption: 'Oil on canvas study • Autumn echoes 🎨',
        createdAt: new Date(Date.now() - 8 * 3600 * 1000).toISOString(),
      },
    ],
  },
];

export function StoriesBar() {
  const { user, isAuthenticated } = useAuthStore();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [selectedGroupIdx, setSelectedGroupIdx] = useState(0);

  // Fetch stories from API
  const { data: apiStories = [] } = useQuery({
    queryKey: ['stories'],
    queryFn: async () => {
      try {
        const res = await flintApi.stories.list();
        return res.data?.data ?? [];
      } catch {
        return [];
      }
    },
    enabled: isAuthenticated,
  });

  // Combine user API stories with seed stories (avoiding duplicates)
  const allGroups: UserStoryGroup[] = [...apiStories];
  for (const seed of SEED_STORIES) {
    if (!allGroups.some((g) => g.user.username === seed.user.username)) {
      allGroups.push(seed);
    }
  }

  // Check if current user has an active story
  const myStoryGroup = allGroups.find((g) => g.user.username === user?.username);
  const otherGroups = allGroups.filter((g) => g.user.username !== user?.username);

  const handleOpenViewer = (groupIdx: number) => {
    setSelectedGroupIdx(groupIdx);
    setViewerOpen(true);
  };

  return (
    <>
      <div className="flex gap-3 px-1 py-3.5 mb-2 overflow-x-auto scrollbar-hide border-b border-border/40 select-none">
        {/* ── 1. Your Story Add / View Button ───────────────────────── */}
        <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
          <div className="relative group cursor-pointer">
            <div
              onClick={() => {
                if (myStoryGroup) {
                  // View own story
                  const idx = allGroups.findIndex((g) => g.user.username === user?.username);
                  handleOpenViewer(idx >= 0 ? idx : 0);
                } else {
                  setShowCreateModal(true);
                }
              }}
              className={`w-14 h-14 rounded-full p-[2.5px] transition-transform active:scale-95 ${
                myStoryGroup
                  ? 'bg-gradient-to-tr from-spark-400 via-rose-500 to-spark-600 shadow-md shadow-spark-500/20'
                  : 'border-2 border-dashed border-muted-foreground/40 hover:border-spark-500/60'
              }`}
            >
              <Avatar className="w-full h-full ring-2 ring-background">
                <AvatarImage src={user?.avatarUrl ?? undefined} alt={user?.username ?? 'You'} />
                <AvatarFallback className="bg-spark-500/20 text-spark-400 font-bold text-xs">
                  {user?.username?.[0]?.toUpperCase() ?? 'Y'}
                </AvatarFallback>
              </Avatar>
            </div>

            {/* Plus badge */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowCreateModal(true);
              }}
              className="absolute bottom-0 right-0 w-4 h-4 rounded-full spark-gradient text-white flex items-center justify-center shadow-md ring-2 ring-background hover:scale-110 active:scale-95 transition-transform"
              aria-label="Add story"
              id="add-story-plus-btn"
            >
              <Plus className="w-3 h-3 stroke-[3]" />
            </button>
          </div>
          <span className="text-[11px] text-muted-foreground w-14 text-center truncate font-medium">
            Your story
          </span>
        </div>

        {/* ── 2. Other Users' Stories ─────────────────────────────────── */}
        {otherGroups.map((group) => {
          const groupIdx = allGroups.findIndex((g) => g.user.username === group.user.username);
          return (
            <div
              key={group.user.id}
              onClick={() => handleOpenViewer(groupIdx)}
              className="flex flex-col items-center gap-1.5 flex-shrink-0 cursor-pointer group"
            >
              <div className="w-14 h-14 rounded-full p-[2.5px] bg-gradient-to-tr from-spark-400 via-rose-500 to-spark-600 shadow-md shadow-spark-500/20 group-hover:scale-105 active:scale-95 transition-all">
                <Avatar className="w-full h-full ring-2 ring-background">
                  <AvatarImage src={group.user.avatarUrl} alt={group.user.username} />
                  <AvatarFallback className="bg-spark-500/20 text-spark-400 font-bold text-xs">
                    {group.user.username[0]?.toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </div>
              <span className="text-[11px] text-foreground/80 group-hover:text-foreground w-14 text-center truncate font-medium">
                {group.user.username}
              </span>
            </div>
          );
        })}
      </div>

      {/* Create Story Modal */}
      <CreateStoryModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
      />

      {/* Story Viewer Modal */}
      <StoryViewerModal
        groups={allGroups}
        initialGroupIndex={selectedGroupIdx}
        open={viewerOpen}
        onClose={() => setViewerOpen(false)}
      />
    </>
  );
}
