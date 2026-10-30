'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Camera, Music, Sparkles, Check, Loader2, Volume2, VolumeX,
  Play, Pause, ArrowLeft, Image as ImageIcon, Flame,
} from 'lucide-react';
import { flintApi } from '@/lib/api';
import { toast } from '@/components/ui/toaster';
import { useAuthStore } from '@/store/auth.store';
import { useQueryClient } from '@tanstack/react-query';

export interface MusicTrack {
  id: string;
  title: string;
  artist: string;
  genre: 'lofi' | 'synth' | 'acoustic' | 'dance' | 'ambient';
}

export const STORY_MUSIC_TRACKS: MusicTrack[] = [
  { id: 'track_1', title: 'Sunset Horizon', artist: 'Lofi Beats', genre: 'lofi' },
  { id: 'track_2', title: 'Cyber Spark', artist: 'Neon Drift', genre: 'synth' },
  { id: 'track_3', title: 'Golden Hour', artist: 'Acoustic Soul', genre: 'acoustic' },
  { id: 'track_4', title: 'Flint Rhythm', artist: 'Pulse Club', genre: 'dance' },
  { id: 'track_5', title: 'Dreamscape', artist: 'Cloudwave', genre: 'ambient' },
];

export const STORY_FILTERS = [
  { id: 'normal', name: 'Normal', css: 'none' },
  { id: 'solar', name: 'Solar', css: 'brightness(1.1) contrast(1.15) saturate(1.3)' },
  { id: 'vintage', name: 'Vintage', css: 'sepia(0.35) contrast(0.95) brightness(1.05) saturate(1.2)' },
  { id: 'noir', name: 'Noir', css: 'grayscale(1) contrast(1.25) brightness(0.95)' },
  { id: 'cyber', name: 'Cyber', css: 'hue-rotate(290deg) saturate(1.6) contrast(1.1)' },
  { id: 'cinema', name: 'Cinema', css: 'contrast(1.2) saturate(1.25) brightness(0.95)' },
  { id: 'pastel', name: 'Pastel', css: 'brightness(1.12) contrast(0.9) saturate(1.15)' },
] as const;

// Web Audio synthesizer for instant preview of music tracks
class StoryAudioSynthesizer {
  private ctx: AudioContext | null = null;
  private isPlaying = false;
  private timer: any = null;

  private initCtx() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  playTrack(genre: MusicTrack['genre']) {
    this.stop();
    this.initCtx();
    if (!this.ctx) return;
    this.isPlaying = true;

    const chords: Record<string, number[][]> = {
      lofi: [[261.63, 329.63, 392.0], [220.0, 261.63, 329.63], [174.61, 220.0, 261.63]],
      synth: [[196.0, 293.66, 392.0], [174.61, 261.63, 349.23], [146.83, 220.0, 293.66]],
      acoustic: [[329.63, 392.0, 493.88], [293.66, 369.99, 440.0], [246.94, 311.13, 369.99]],
      dance: [[130.81, 261.63, 392.0], [146.83, 293.66, 440.0], [164.81, 329.63, 493.88]],
      ambient: [[174.61, 261.63, 329.63, 392.0], [220.0, 329.63, 392.0, 493.88]],
    };

    const notes = chords[genre] || chords.lofi;
    let step = 0;

    const playChord = () => {
      if (!this.isPlaying || !this.ctx) return;
      const currentChord = notes[step % notes.length];
      const now = this.ctx.currentTime;

      currentChord.forEach((freq) => {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = genre === 'synth' ? 'sawtooth' : 'sine';
        osc.frequency.setValueAtTime(freq, now);

        gain.gain.setValueAtTime(0.001, now);
        gain.gain.exponentialRampToValueAtTime(0.04, now + 0.1);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now);
        osc.stop(now + 1.3);
      });

      step++;
      this.timer = setTimeout(playChord, 1200);
    };

    playChord();
  }

  stop() {
    this.isPlaying = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}

export const storyAudio = new StoryAudioSynthesizer();

interface CreateStoryModalProps {
  open: boolean;
  onClose: () => void;
}

export function CreateStoryModal({ open, onClose }: CreateStoryModalProps) {
  const queryClient = useQueryClient();
  const { user, isAuthenticated } = useAuthStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<'upload' | 'customize' | 'publishing'>('upload');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isVideo, setIsVideo] = useState(false);

  // Customization state
  const [selectedFilter, setSelectedFilter] = useState<string>('normal');
  const [selectedTrack, setSelectedTrack] = useState<MusicTrack | null>(null);
  const [caption, setCaption] = useState('');
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [activeTab, setActiveTab] = useState<'filter' | 'music' | 'text'>('filter');

  const [uploadProgress, setUploadProgress] = useState(0);

  // Stop audio when modal closes
  useEffect(() => {
    if (!open) {
      storyAudio.stop();
      setIsPlayingAudio(false);
      resetState();
    }
  }, [open]);

  const resetState = () => {
    setStep('upload');
    setSelectedFile(null);
    setPreviewUrl(null);
    setIsVideo(false);
    setSelectedFilter('normal');
    setSelectedTrack(null);
    setCaption('');
    setUploadProgress(0);
  };

  const handleFileSelect = (file: File) => {
    if (!file) return;
    const isVid = file.type.startsWith('video/');
    setIsVideo(isVid);
    setSelectedFile(file);
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
    setStep('customize');
  };

  const handleTrackSelect = (track: MusicTrack) => {
    if (selectedTrack?.id === track.id && isPlayingAudio) {
      storyAudio.stop();
      setIsPlayingAudio(false);
    } else {
      setSelectedTrack(track);
      storyAudio.playTrack(track.genre);
      setIsPlayingAudio(true);
    }
  };

  const handlePublish = async () => {
    if (!selectedFile || !isAuthenticated) return;

    try {
      setStep('publishing');
      setUploadProgress(10);

      // 1. Get pre-signed URL or upload directly
      const urlRes = await flintApi.media.getUploadUrl(selectedFile.type, 'stories');
      const { uploadUrl, publicUrl } = urlRes.data.data;
      setUploadProgress(30);

      // 2. Upload binary to S3 / endpoint
      await flintApi.media.uploadToS3(uploadUrl, selectedFile, (pct) => {
        setUploadProgress(30 + Math.round(pct * 0.4));
      });
      setUploadProgress(75);

      // 3. Create story in API
      await flintApi.stories.create({
        mediaUrl: publicUrl,
        mediaType: isVideo ? 'VIDEO' : 'IMAGE',
        duration: isVideo ? 15 : 5,
        filter: selectedFilter,
        musicTrack: selectedTrack ? {
          id: selectedTrack.id,
          title: selectedTrack.title,
          artist: selectedTrack.artist,
        } : undefined,
        caption: caption.trim() || undefined,
      });

      setUploadProgress(100);
      storyAudio.stop();
      queryClient.invalidateQueries({ queryKey: ['stories'] });
      toast({ title: 'Story added! 🔥', variant: 'success' });
      onClose();
    } catch (err: any) {
      setStep('customize');
      toast({
        title: 'Failed to share story',
        description: err?.response?.data?.message ?? 'Please try again',
        variant: 'error',
      });
    }
  };

  const currentFilterCss = STORY_FILTERS.find((f) => f.id === selectedFilter)?.css || 'none';

  return (
    <Dialog.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 animate-in fade-in duration-200" />
        <Dialog.Content className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 outline-none pointer-events-none">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            className="w-full max-w-md h-[92vh] max-h-[760px] bg-card border border-border/70 rounded-3xl overflow-hidden shadow-2xl flex flex-col pointer-events-auto relative"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card/60 z-10">
              {step === 'customize' ? (
                <button
                  onClick={() => {
                    storyAudio.stop();
                    setIsPlayingAudio(false);
                    setStep('upload');
                  }}
                  className="p-1.5 -ml-1 text-muted-foreground hover:text-foreground rounded-lg"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
              ) : (
                <div className="w-5" />
              )}

              <Dialog.Title className="text-sm font-bold font-display flex items-center gap-2">
                <Flame className="w-4 h-4 text-spark-500" />
                <span>{step === 'customize' ? 'Edit Story' : 'New Story'}</span>
              </Dialog.Title>

              <button
                onClick={() => {
                  storyAudio.stop();
                  onClose();
                }}
                className="p-1.5 -mr-1 text-muted-foreground hover:text-foreground rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* ── STEP 1: Upload / File Select ───────────────────────────── */}
            {step === 'upload' && (
              <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-6">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFileSelect(f);
                  }}
                  accept="image/*,video/*"
                  className="hidden"
                />

                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="w-24 h-24 rounded-3xl spark-gradient flex items-center justify-center cursor-pointer shadow-xl shadow-spark-500/25 hover:scale-105 active:scale-95 transition-all"
                >
                  <Camera className="w-10 h-10 text-white" />
                </div>

                <div>
                  <h3 className="text-lg font-bold text-foreground">Create a Story</h3>
                  <p className="text-sm text-muted-foreground max-w-xs mt-1">
                    Add photos or videos with custom filters, music beats, and captions.
                  </p>
                </div>

                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="btn-spark px-6 py-2.5 text-sm font-semibold shadow-md touch-manipulation"
                >
                  Select from device
                </button>
              </div>
            )}

            {/* ── STEP 2: Customize Story (Filters & Music) ─────────────── */}
            {step === 'customize' && previewUrl && (
              <div className="flex-1 flex flex-col min-h-0 relative bg-black">
                {/* Media Preview Container */}
                <div className="flex-1 relative overflow-hidden flex items-center justify-center bg-black">
                  {isVideo ? (
                    <video
                      src={previewUrl}
                      autoPlay
                      loop
                      playsInline
                      muted
                      className="w-full h-full object-cover transition-all"
                      style={{ filter: currentFilterCss }}
                    />
                  ) : (
                    <img
                      src={previewUrl}
                      alt="Story preview"
                      className="w-full h-full object-cover transition-all"
                      style={{ filter: currentFilterCss }}
                    />
                  )}

                  {/* Active Music Badge Overlay */}
                  {selectedTrack && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="absolute top-4 left-4 flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-md border border-white/20 text-white text-xs shadow-lg"
                    >
                      <Music className="w-3.5 h-3.5 text-spark-400 animate-pulse" />
                      <span className="font-semibold truncate max-w-[140px]">
                        {selectedTrack.title}
                      </span>
                      <span className="text-[10px] opacity-75">• {selectedTrack.artist}</span>
                    </motion.div>
                  )}

                  {/* Caption Overlay */}
                  {caption && (
                    <div className="absolute bottom-6 left-4 right-4 text-center">
                      <span className="inline-block px-4 py-2 rounded-2xl bg-black/70 backdrop-blur-md text-white text-sm font-medium shadow-lg max-w-[90%]">
                        {caption}
                      </span>
                    </div>
                  )}
                </div>

                {/* Customization Toolbar */}
                <div className="bg-card/95 backdrop-blur-md border-t border-border p-3.5 space-y-3 z-10">
                  {/* Tab Switcher: Filters | Music | Text */}
                  <div className="flex items-center justify-center gap-1 p-1 bg-secondary/80 rounded-xl">
                    <button
                      onClick={() => setActiveTab('filter')}
                      className={`flex-1 py-1.5 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                        activeTab === 'filter'
                          ? 'bg-background text-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <Sparkles className="w-3.5 h-3.5 text-spark-500" />
                      <span>Filters</span>
                    </button>

                    <button
                      onClick={() => setActiveTab('music')}
                      className={`flex-1 py-1.5 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                        activeTab === 'music'
                          ? 'bg-background text-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <Music className="w-3.5 h-3.5 text-spark-500" />
                      <span>Music</span>
                    </button>

                    <button
                      onClick={() => setActiveTab('text')}
                      className={`flex-1 py-1.5 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                        activeTab === 'text'
                          ? 'bg-background text-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <span>Text</span>
                    </button>
                  </div>

                  {/* Tab Panel: Filters */}
                  {activeTab === 'filter' && (
                    <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
                      {STORY_FILTERS.map((f) => {
                        const isActive = selectedFilter === f.id;
                        return (
                          <button
                            key={f.id}
                            onClick={() => setSelectedFilter(f.id)}
                            className={`flex flex-col items-center gap-1 flex-shrink-0 p-1.5 rounded-xl transition-all ${
                              isActive ? 'ring-2 ring-spark-500 bg-secondary' : 'hover:bg-secondary/50'
                            }`}
                          >
                            <div
                              className="w-12 h-12 rounded-lg bg-secondary overflow-hidden border border-border"
                              style={{ filter: f.css }}
                            >
                              {previewUrl && (
                                <img src={previewUrl} alt="" className="w-full h-full object-cover" />
                              )}
                            </div>
                            <span className="text-[10px] font-medium text-foreground truncate w-12 text-center">
                              {f.name}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Tab Panel: Music */}
                  {activeTab === 'music' && (
                    <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                      {STORY_MUSIC_TRACKS.map((t) => {
                        const isSelected = selectedTrack?.id === t.id;
                        return (
                          <div
                            key={t.id}
                            onClick={() => handleTrackSelect(t)}
                            className={`flex items-center justify-between p-2 rounded-xl cursor-pointer border transition-all ${
                              isSelected
                                ? 'border-spark-500/50 bg-spark-500/10 text-foreground'
                                : 'border-border/60 hover:bg-secondary/40 text-muted-foreground'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div
                                className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                                  isSelected ? 'spark-gradient text-white' : 'bg-secondary text-muted-foreground'
                                }`}
                              >
                                {isSelected && isPlayingAudio ? (
                                  <Volume2 className="w-4 h-4 animate-pulse" />
                                ) : (
                                  <Play className="w-4 h-4 ml-0.5" />
                                )}
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-semibold text-foreground truncate">{t.title}</p>
                                <p className="text-[11px] text-muted-foreground truncate">{t.artist}</p>
                              </div>
                            </div>

                            {isSelected && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedTrack(null);
                                  storyAudio.stop();
                                  setIsPlayingAudio(false);
                                }}
                                className="text-xs text-muted-foreground hover:text-foreground p-1"
                              >
                                Remove
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Tab Panel: Text / Caption */}
                  {activeTab === 'text' && (
                    <div className="space-y-2">
                      <input
                        type="text"
                        value={caption}
                        onChange={(e) => setCaption(e.target.value.slice(0, 100))}
                        placeholder="Add a story caption..."
                        className="input-flint text-sm py-2"
                        maxLength={100}
                        autoFocus
                      />
                      <p className="text-[11px] text-muted-foreground text-right">
                        {caption.length} / 100
                      </p>
                    </div>
                  )}

                  {/* Publish Button */}
                  <div className="pt-1">
                    <button
                      onClick={handlePublish}
                      className="btn-spark w-full py-2.5 text-sm font-semibold justify-center shadow-lg shadow-spark-500/25 touch-manipulation"
                      id="publish-story-btn"
                    >
                      Share to Your Story 🔥
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ── STEP 3: Publishing Progress ───────────────────────────── */}
            {step === 'publishing' && (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-6">
                <div className="w-16 h-16 rounded-3xl spark-gradient flex items-center justify-center shadow-xl shadow-spark-500/30">
                  <Loader2 className="w-8 h-8 text-white animate-spin" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-foreground">Sharing Your Story...</h3>
                  <p className="text-sm text-muted-foreground mt-1">Applying your filter and music track</p>
                </div>
                <div className="w-full max-w-xs h-2 bg-secondary rounded-full overflow-hidden">
                  <div
                    className="h-full spark-gradient transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
                <span className="text-xs font-semibold text-spark-500">{uploadProgress}%</span>
              </div>
            )}
          </motion.div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

