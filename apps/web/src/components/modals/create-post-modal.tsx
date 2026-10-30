'use client';

import { useCallback, useState, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Upload, ImageIcon, Video, Square, RectangleVertical,
  Smartphone, Monitor, ChevronLeft, ChevronRight, Loader2,
  CheckCircle2, AlertCircle,
} from 'lucide-react';
import * as Dialog from '@radix-ui/react-dialog';
import { cn, extractHashtags } from '@/lib/utils';
import { flintApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';

type Step = 'upload' | 'edit' | 'publishing' | 'done';
type AspectRatio = 'SQUARE' | 'PORTRAIT' | 'REEL' | 'LANDSCAPE';

interface CreatePostModalProps {
  open: boolean;
  onClose: () => void;
}

const ASPECT_RATIOS: { value: AspectRatio; label: string; icon: React.ElementType; dims: string }[] = [
  { value: 'SQUARE', label: '1:1', icon: Square, dims: '1080×1080' },
  { value: 'PORTRAIT', label: '4:5', icon: RectangleVertical, dims: '1080×1350' },
  { value: 'REEL', label: '9:16', icon: Smartphone, dims: '1080×1920' },
  { value: 'LANDSCAPE', label: '16:9', icon: Monitor, dims: '1920×1080' },
];

export function CreatePostModal({ open, onClose }: CreatePostModalProps) {
  const { isAuthenticated } = useAuthStore();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<Step>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('SQUARE');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [publishedPostId, setPublishedPostId] = useState<string | null>(null);
  const captionRef = useRef<HTMLTextAreaElement>(null);

  const reset = useCallback(() => {
    setStep('upload');
    setFile(null);
    setPreview(null);
    setCaption('');
    setAspectRatio('SQUARE');
    setUploadProgress(0);
    setError(null);
    setPublishedPostId(null);
  }, []);

  const handleClose = useCallback(() => {
    onClose();
    setTimeout(reset, 300);
  }, [onClose, reset]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const f = acceptedFiles[0];
    if (!f) return;

    setFile(f);
    setPreview(URL.createObjectURL(f));
    setStep('edit');
    setError(null);

    // Auto-detect aspect ratio from image/video
    if (f.type.startsWith('image/')) {
      const img = new Image();
      img.onload = () => {
        const ratio = img.width / img.height;
        if (ratio > 1.2) setAspectRatio('LANDSCAPE');
        else if (ratio < 0.85) setAspectRatio('PORTRAIT');
        else setAspectRatio('SQUARE');
      };
      img.src = URL.createObjectURL(f);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/webp': ['.webp'],
      'image/png': ['.png'],
      'video/mp4': ['.mp4'],
      'video/webm': ['.webm'],
    },
    maxFiles: 1,
    maxSize: 100 * 1024 * 1024, // 100MB
    onDropRejected: (files) => {
      const e = files[0]?.errors[0];
      setError(e?.code === 'file-too-large' ? 'File is too large (max 100MB)' : 'Unsupported file type');
    },
  });

  const handlePublish = useCallback(async () => {
    if (!file || !isAuthenticated) return;

    setStep('publishing');
    setError(null);

    try {
      // Step 1: Get presigned upload URL
      const { data: urlData } = await flintApi.media.getUploadUrl(file.type as 'image/jpeg', 'posts');
      const { uploadUrl, key, publicUrl } = urlData.data;

      // Step 2: Upload directly to S3/R2
      await flintApi.media.uploadToS3(uploadUrl, file, setUploadProgress);
      setUploadProgress(100);

      // Step 3: Create post record
      const mediaType = file.type.startsWith('video/') ? 'VIDEO' : 'IMAGE';
      const tags = extractHashtags(caption);

      const { data: postData } = await flintApi.posts.create({
        mediaType,
        mediaUrl: publicUrl,
        caption: caption.trim() || undefined,
        aspectRatio,
        s3Key: key,
        tags,
        fileSize: file.size,
      });

      setPublishedPostId(postData.data.id);
      queryClient.invalidateQueries({ queryKey: ['feed'] });
      setStep('done');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to publish post';
      setError(message);
      setStep('edit');
    }
  }, [file, isAuthenticated, caption, aspectRatio]);

  const isVideo = file?.type.startsWith('video/');
  const aspectClass: Record<AspectRatio, string> = {
    SQUARE: 'aspect-square',
    PORTRAIT: 'aspect-[4/5]',
    REEL: 'aspect-[9/16]',
    LANDSCAPE: 'aspect-video',
  };

  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && handleClose()}>
      <Dialog.Portal>
        <Dialog.Overlay asChild>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
          />
        </Dialog.Overlay>

        <Dialog.Content asChild>
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 20 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-lg max-h-[90vh] overflow-y-auto"
          >
            <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-2xl">
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                {step === 'edit' && (
                  <button onClick={() => setStep('upload')} className="btn-ghost p-2 -ml-2">
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                )}
                {step !== 'edit' && <div />}

                <Dialog.Title className="text-base font-semibold font-display">
                  {step === 'upload' && 'Create Post'}
                  {step === 'edit' && 'Edit & Publish'}
                  {step === 'publishing' && 'Publishing...'}
                  {step === 'done' && 'Posted! 🔥'}
                </Dialog.Title>

                {step !== 'publishing' && (
                  <Dialog.Close asChild>
                    <button
                      onClick={handleClose}
                      className="btn-ghost p-2 -mr-2 text-muted-foreground"
                      aria-label="Close modal"
                      id="close-create-post-modal"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </Dialog.Close>
                )}
              </div>

              <AnimatePresence mode="wait">
                {/* ── Upload Step ──────────────────────────────────────── */}
                {step === 'upload' && (
                  <motion.div
                    key="upload"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="p-6"
                  >
                    <div
                      {...getRootProps()}
                      className={cn(
                        'border-2 border-dashed rounded-2xl p-12 text-center transition-all duration-200 cursor-pointer',
                        isDragActive
                          ? 'border-primary bg-primary/5 scale-[1.01]'
                          : 'border-border hover:border-primary/40 hover:bg-secondary/50'
                      )}
                    >
                      <input {...getInputProps()} id="media-file-input" />
                      <motion.div
                        animate={isDragActive ? { scale: 1.1 } : { scale: 1 }}
                        className="flex flex-col items-center gap-4"
                      >
                        <div className="w-16 h-16 rounded-2xl bg-spark-gradient flex items-center justify-center shadow-lg shadow-spark-500/20">
                          <Upload className="w-7 h-7 text-white" />
                        </div>
                        <div>
                          <p className="text-base font-semibold mb-1">
                            {isDragActive ? 'Drop it here!' : 'Drag & drop media'}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            or click to browse files
                          </p>
                          <p className="text-xs text-muted-foreground mt-2">
                            JPEG, WebP, PNG, MP4, WebM — up to 100MB
                          </p>
                        </div>
                        <div className="flex items-center gap-3 text-muted-foreground">
                          <div className="flex items-center gap-1.5 text-xs">
                            <ImageIcon className="w-3.5 h-3.5" />
                            <span>Photos</span>
                          </div>
                          <div className="w-px h-4 bg-border" />
                          <div className="flex items-center gap-1.5 text-xs">
                            <Video className="w-3.5 h-3.5" />
                            <span>Videos</span>
                          </div>
                        </div>
                      </motion.div>
                    </div>

                    {error && (
                      <div className="flex items-center gap-2 mt-3 p-3 rounded-xl bg-destructive/10 text-destructive text-sm">
                        <AlertCircle className="w-4 h-4 flex-shrink-0" />
                        {error}
                      </div>
                    )}
                  </motion.div>
                )}

                {/* ── Edit Step ────────────────────────────────────────── */}
                {step === 'edit' && preview && (
                  <motion.div
                    key="edit"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="p-5 space-y-5"
                  >
                    {/* Media preview */}
                    <div className={cn('rounded-xl overflow-hidden bg-secondary relative w-full', aspectClass[aspectRatio])}>
                      {isVideo ? (
                        <video src={preview} muted autoPlay loop playsInline className="w-full h-full object-cover" />
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={preview} alt="Preview" className="w-full h-full object-cover" draggable={false} />
                      )}
                    </div>

                    {/* Aspect ratio picker */}
                    <div>
                      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 block">
                        Aspect Ratio
                      </label>
                      <div className="grid grid-cols-4 gap-2">
                        {ASPECT_RATIOS.map(({ value, label, icon: Icon, dims }) => (
                          <button
                            key={value}
                            onClick={() => setAspectRatio(value)}
                            id={`aspect-ratio-${value.toLowerCase()}`}
                            className={cn(
                              'flex flex-col items-center gap-1.5 py-3 rounded-xl border text-xs font-medium transition-all',
                              aspectRatio === value
                                ? 'border-primary bg-primary/10 text-primary'
                                : 'border-border hover:border-primary/30 text-muted-foreground hover:text-foreground'
                            )}
                          >
                            <Icon className="w-4 h-4" />
                            <span>{label}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Caption */}
                    <div>
                      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 block" htmlFor="post-caption">
                        Caption
                      </label>
                      <textarea
                        ref={captionRef}
                        id="post-caption"
                        value={caption}
                        onChange={(e) => setCaption(e.target.value)}
                        placeholder="Write a caption… add #hashtags to reach more people"
                        maxLength={2200}
                        rows={4}
                        className="input-flint resize-none leading-relaxed"
                      />
                      <p className="text-xs text-muted-foreground text-right mt-1">
                        {caption.length}/2200
                      </p>
                    </div>

                    {error && (
                      <div className="flex items-center gap-2 p-3 rounded-xl bg-destructive/10 text-destructive text-sm">
                        <AlertCircle className="w-4 h-4 flex-shrink-0" />
                        {error}
                      </div>
                    )}

                    <button
                      onClick={handlePublish}
                      className="btn-spark w-full py-3"
                      id="publish-post-btn"
                    >
                      Share Post
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </motion.div>
                )}

                {/* ── Publishing Step ──────────────────────────────────── */}
                {step === 'publishing' && (
                  <motion.div
                    key="publishing"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="p-8 text-center space-y-6"
                  >
                    <div className="w-16 h-16 mx-auto rounded-2xl spark-gradient flex items-center justify-center">
                      <Loader2 className="w-8 h-8 text-white animate-spin" />
                    </div>
                    <div>
                      <p className="font-semibold mb-1">Uploading your post...</p>
                      <p className="text-sm text-muted-foreground">Sharing your spark with the world</p>
                    </div>
                    {/* Progress bar */}
                    <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
                      <motion.div
                        className="h-full spark-gradient rounded-full"
                        initial={{ width: '0%' }}
                        animate={{ width: `${uploadProgress}%` }}
                        transition={{ ease: 'easeInOut' }}
                      />
                    </div>
                    <p className="text-sm font-medium text-primary">{uploadProgress}%</p>
                  </motion.div>
                )}

                {/* ── Done Step ────────────────────────────────────────── */}
                {step === 'done' && (
                  <motion.div
                    key="done"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="p-8 text-center space-y-5"
                  >
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 300, delay: 0.1 }}
                      className="w-16 h-16 mx-auto bg-green-500/10 rounded-2xl flex items-center justify-center"
                    >
                      <CheckCircle2 className="w-8 h-8 text-green-500" />
                    </motion.div>
                    <div>
                      <p className="font-semibold text-lg mb-1">Post shared! 🔥</p>
                      <p className="text-sm text-muted-foreground">Your post is live and reaching your followers.</p>
                    </div>
                    <div className="flex gap-3">
                      <button
                        onClick={handleClose}
                        className="btn-ghost flex-1"
                        id="close-after-post"
                      >
                        Close
                      </button>
                      {publishedPostId && (
                        <a
                          href={`/p/${publishedPostId}`}
                          className="btn-spark flex-1 justify-center"
                          id="view-post-btn"
                        >
                          View Post
                        </a>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
