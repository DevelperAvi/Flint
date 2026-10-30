'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, ChevronLeft, ChevronRight, Volume2, VolumeX, Heart,
  Flame, Music, Sparkles, Send, ShieldCheck,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { formatRelativeTime } from '@/lib/utils';
import { storyAudio, STORY_FILTERS, MusicTrack } from './create-story-modal';

export interface StoryItem {
  id: string;
  mediaUrl: string;
  mediaType: 'IMAGE' | 'VIDEO';
  duration?: number;
  filter?: string;
  musicTrack?: MusicTrack;
  caption?: string;
  createdAt: string;
}

export interface UserStoryGroup {
  user: {
    id: string;
    username: string;
    displayName?: string;
    avatarUrl?: string;
    isVerified?: boolean;
  };
  stories: StoryItem[];
}

interface StoryViewerModalProps {
  groups: UserStoryGroup[];
  initialGroupIndex?: number;
  open: boolean;
  onClose: () => void;
}

export function StoryViewerModal({
  groups,
  initialGroupIndex = 0,
  open,
  onClose,
}: StoryViewerModalProps) {
  const [currentGroupIdx, setCurrentGroupIdx] = useState(initialGroupIndex);
  const [currentStoryIdx, setCurrentStoryIdx] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [liked, setLiked] = useState(false);

  useEffect(() => {
    setCurrentGroupIdx(initialGroupIndex);
    setCurrentStoryIdx(0);
    setProgress(0);
    setLiked(false);
  }, [initialGroupIndex, open]);

  const currentGroup = groups[currentGroupIdx];
  const currentStory = currentGroup?.stories[currentStoryIdx];
  const storyDurationSec = currentStory?.duration ?? 5;

  // Handle music playback
  useEffect(() => {
    if (!open || !currentStory) {
      storyAudio.stop();
      return;
    }

    if (currentStory.musicTrack && !isMuted && !isPaused) {
      storyAudio.playTrack(currentStory.musicTrack.genre);
    } else {
      storyAudio.stop();
    }

    return () => {
      storyAudio.stop();
    };
  }, [open, currentStory, isMuted, isPaused]);

  // Story progress timer
  useEffect(() => {
    if (!open || isPaused || !currentStory) return;

    const intervalMs = 50;
    const stepIncrement = (intervalMs / (storyDurationSec * 1000)) * 100;

    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          handleNextStory();
          return 0;
        }
        return prev + stepIncrement;
      });
    }, intervalMs);

    return () => clearInterval(timer);
  }, [open, isPaused, currentStory, currentStoryIdx, currentGroupIdx, storyDurationSec]);

  const handleNextStory = useCallback(() => {
    setProgress(0);
    setLiked(false);
    if (!currentGroup) return;

    if (currentStoryIdx < currentGroup.stories.length - 1) {
      setCurrentStoryIdx((i) => i + 1);
    } else if (currentGroupIdx < groups.length - 1) {
      setCurrentGroupIdx((g) => g + 1);
      setCurrentStoryIdx(0);
    } else {
      onClose();
    }
  }, [currentGroup, currentStoryIdx, currentGroupIdx, groups.length, onClose]);

  const handlePrevStory = useCallback(() => {
    setProgress(0);
    setLiked(false);
    if (currentStoryIdx > 0) {
      setCurrentStoryIdx((i) => i - 1);
    } else if (currentGroupIdx > 0) {
      const prevGroup = groups[currentGroupIdx - 1];
      setCurrentGroupIdx((g) => g - 1);
      setCurrentStoryIdx(prevGroup.stories.length - 1);
    }
  }, [currentStoryIdx, currentGroupIdx, groups]);

  if (!open || !currentGroup || !currentStory) return null;

  const currentFilterCss =
    STORY_FILTERS.find((f) => f.id === currentStory.filter)?.css || 'none';

  return (
    <Dialog.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/95 backdrop-blur-xl z-50 animate-in fade-in duration-200" />
        <Dialog.Content className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 outline-none">
          {/* Main Story Container (9:16 aspect ratio) */}
          <div
            className="relative w-full h-full sm:h-[92vh] sm:max-h-[800px] sm:max-w-[440px] bg-black sm:rounded-3xl overflow-hidden shadow-2xl flex flex-col select-none"
            onMouseDown={() => setIsPaused(true)}
            onMouseUp={() => setIsPaused(false)}
            onTouchStart={() => setIsPaused(true)}
            onTouchEnd={() => setIsPaused(false)}
          >
            {/* ── Top Story Segmented Progress Bar ─────────────────────── */}
            <div className="absolute top-3 left-3 right-3 z-30 flex items-center gap-1.5">
              {currentGroup.stories.map((st, i) => (
                <div key={st.id} className="h-1 flex-1 bg-white/30 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-white transition-all duration-75"
                    style={{
                      width:
                        i < currentStoryIdx
                          ? '100%'
                          : i === currentStoryIdx
                          ? `${progress}%`
                          : '0%',
                    }}
                  />
                </div>
              ))}
            </div>

            {/* ── Story Header: Avatar, Username, Music Sticker, Controls ── */}
            <div className="absolute top-7 left-3 right-3 z-30 flex items-center justify-between">
              <div className="flex items-center gap-2.5 min-w-0">
                <Avatar className="w-9 h-9 ring-2 ring-spark-500 shadow-md flex-shrink-0">
                  <AvatarImage src={currentGroup.user.avatarUrl} alt={currentGroup.user.username} />
                  <AvatarFallback className="bg-spark-500 text-white font-bold text-xs">
                    {currentGroup.user.username[0]?.toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <div className="flex items-center gap-1">
                    <span className="text-white text-xs font-semibold drop-shadow truncate">
                      {currentGroup.user.displayName || currentGroup.user.username}
                    </span>
                    {currentGroup.user.isVerified && (
                      <ShieldCheck className="w-3.5 h-3.5 text-spark-400 flex-shrink-0" />
                    )}
                    <span className="text-white/60 text-[10px] ml-1">
                      {formatRelativeTime(currentStory.createdAt)}
                    </span>
                  </div>

                  {currentStory.musicTrack && (
                    <div className="flex items-center gap-1 text-[11px] text-white/90 drop-shadow">
                      <Music className="w-3 h-3 text-spark-400 animate-pulse" />
                      <span className="truncate max-w-[120px]">
                        {currentStory.musicTrack.title}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Controls */}
              <div className="flex items-center gap-1">
                {currentStory.musicTrack && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsMuted(!isMuted);
                    }}
                    className="p-2 text-white/80 hover:text-white rounded-full transition-colors drop-shadow"
                    aria-label="Toggle mute"
                  >
                    {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                  </button>
                )}

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    storyAudio.stop();
                    onClose();
                  }}
                  className="p-2 text-white/80 hover:text-white rounded-full transition-colors drop-shadow"
                  aria-label="Close story"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* ── Media Content ─────────────────────────────────────────── */}
            <div className="relative flex-1 bg-black flex items-center justify-center overflow-hidden">
              {currentStory.mediaType === 'VIDEO' ? (
                <video
                  src={currentStory.mediaUrl}
                  autoPlay
                  loop
                  playsInline
                  muted={isMuted}
                  className="w-full h-full object-cover"
                  style={{ filter: currentFilterCss }}
                />
              ) : (
                <img
                  src={currentStory.mediaUrl}
                  alt="Story"
                  className="w-full h-full object-cover"
                  style={{ filter: currentFilterCss }}
                />
              )}

              {/* Navigation click zones (Left 30% / Right 70%) */}
              <div
                className="absolute inset-y-0 left-0 w-1/3 z-20 cursor-pointer"
                onClick={handlePrevStory}
              />
              <div
                className="absolute inset-y-0 right-0 w-2/3 z-20 cursor-pointer"
                onClick={handleNextStory}
              />

              {/* Story Caption Overlay */}
              {currentStory.caption && (
                <div className="absolute bottom-20 left-4 right-4 z-20 text-center pointer-events-none">
                  <span className="inline-block px-4 py-2 rounded-2xl bg-black/60 backdrop-blur-md text-white text-sm font-medium shadow-lg max-w-[90%]">
                    {currentStory.caption}
                  </span>
                </div>
              )}
            </div>

            {/* ── Story Footer: Heart reaction & Quick Reply ───────────── */}
            <div className="absolute bottom-4 left-4 right-4 z-30 flex items-center gap-3">
              <input
                type="text"
                placeholder={`Reply to ${currentGroup.user.username}...`}
                className="flex-1 bg-black/50 backdrop-blur-md border border-white/20 rounded-full px-4 py-2.5 text-xs text-white placeholder:text-white/60 focus:outline-none focus:ring-1 focus:ring-white/40"
                onClick={(e) => e.stopPropagation()}
              />
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setLiked(!liked);
                }}
                className={`p-2.5 rounded-full backdrop-blur-md border border-white/20 transition-all ${
                  liked
                    ? 'bg-red-500/80 text-white'
                    : 'bg-black/50 text-white hover:text-red-400'
                }`}
              >
                <Heart className={`w-5 h-5 ${liked ? 'fill-white' : ''}`} />
              </button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

