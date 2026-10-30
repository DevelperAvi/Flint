'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Camera, Loader2, Check, AlertCircle, Globe,
  User, AtSign, FileText, Lock, Shield,
} from 'lucide-react';
import { useAuthStore } from '@/store/auth.store';
import { flintApi } from '@/lib/api';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { toast } from '@/components/ui/toaster';
import { useQueryClient } from '@tanstack/react-query';

export default function EditProfilePage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, updateUser, isAuthenticated } = useAuthStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [bio, setBio] = useState(user?.bio ?? '');
  const [website, setWebsite] = useState('');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl ?? '');
  const [isPrivate, setIsPrivate] = useState(false);

  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user?.username) {
      flintApi.users.getProfile(user.username).then((res) => {
        const p = res.data.data;
        if (p) {
          setDisplayName(p.displayName ?? p.username ?? '');
          setBio(p.bio ?? '');
          setWebsite(p.website ?? '');
          setAvatarUrl(p.avatarUrl ?? '');
          setIsPrivate(p.isPrivate ?? false);
        }
      }).catch(() => {
        // Fallback to auth store values
      });
    }
  }, [user?.username]);

  const handleAvatarFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({ title: 'Please select an image file', variant: 'error' });
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast({ title: 'Image must be smaller than 10MB', variant: 'error' });
      return;
    }

    try {
      setIsUploadingPhoto(true);
      const urlRes = await flintApi.media.getUploadUrl(file.type, 'avatars');
      const { uploadUrl, publicUrl } = urlRes.data.data;

      await flintApi.media.uploadToS3(uploadUrl, file);
      setAvatarUrl(publicUrl);
      toast({ title: 'Profile photo uploaded', variant: 'success' });
    } catch (err: any) {
      toast({
        title: 'Upload failed',
        description: err?.response?.data?.message ?? 'Could not upload avatar photo',
        variant: 'error',
      });
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setError(null);
    setIsSaving(true);

    try {
      let cleanedWebsite = website.trim();
      if (cleanedWebsite && !/^https?:\/\//i.test(cleanedWebsite)) {
        cleanedWebsite = `https://${cleanedWebsite}`;
      }

      const payload: Record<string, unknown> = {
        displayName: displayName.trim() || user.username,
        bio: bio.trim(),
        website: cleanedWebsite,
        avatarUrl: avatarUrl || undefined,
        isPrivate,
      };

      const res = await flintApi.users.updateProfile(payload);
      const updated = res.data.data;

      updateUser({
        displayName: updated?.displayName ?? displayName,
        bio: updated?.bio ?? bio,
        avatarUrl: updated?.avatarUrl ?? avatarUrl,
      });

      queryClient.invalidateQueries({ queryKey: ['profile', user.username] });
      toast({ title: 'Profile updated successfully! 🔥', variant: 'success' });
      router.push(`/@${user.username}`);
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? 'Failed to update profile';
      setError(msg);
      toast({ title: 'Update failed', description: msg, variant: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 pb-28 lg:pb-8 space-y-6">
      {/* ── Top Bar ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between pb-2 border-b border-border">
        <div className="flex items-center gap-3">
          <Link
            href={user ? `/@${user.username}` : '/'}
            className="p-2 -ml-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            aria-label="Back to profile"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-xl sm:text-2xl font-bold font-display">Edit Profile</h1>
        </div>

        <button
          onClick={handleSave}
          disabled={isSaving || isUploadingPhoto}
          className="btn-spark px-4 py-2 text-sm shadow-md flex items-center gap-1.5 touch-manipulation disabled:opacity-50"
          id="save-profile-top-btn"
        >
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          <span>Save</span>
        </button>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-center gap-2.5">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* ── Avatar Edit Card ────────────────────────────────────────── */}
      <div className="card-flint p-5 flex flex-col sm:flex-row items-center gap-5 text-center sm:text-left">
        <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
          <Avatar className="w-24 h-24 ring-3 ring-border shadow-md">
            <AvatarImage src={avatarUrl} alt={user?.username ?? 'Avatar'} />
            <AvatarFallback className="text-2xl font-bold bg-spark-500/20 text-spark-400">
              {(user?.username?.[0] ?? 'F').toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="absolute inset-0 rounded-full bg-black/45 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <Camera className="w-7 h-7 text-white" />
          </div>
          {isUploadingPhoto && (
            <div className="absolute inset-0 rounded-full bg-black/60 flex items-center justify-center">
              <Loader2 className="w-7 h-7 text-white animate-spin" />
            </div>
          )}
        </div>

        <div className="flex-1 space-y-2">
          <h2 className="font-semibold text-foreground text-base">
            {user?.displayName || user?.username}
          </h2>
          <p className="text-xs text-muted-foreground">@{user?.username}</p>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleAvatarFileChange}
            accept="image/*"
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploadingPhoto}
            className="btn-ghost text-xs px-3 py-1.5 border border-border rounded-lg touch-manipulation hover:border-primary/40"
          >
            {isUploadingPhoto ? 'Uploading...' : 'Change profile photo'}
          </button>
        </div>
      </div>

      {/* ── Form Fields ─────────────────────────────────────────────── */}
      <form onSubmit={handleSave} className="card-flint p-5 sm:p-6 space-y-5">
        {/* Display Name */}
        <div>
          <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Display Name
          </label>
          <div className="relative">
            <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your display name"
              maxLength={60}
              className="input-flint pl-10 text-sm"
              required
            />
          </div>
        </div>

        {/* Username (read-only) */}
        <div>
          <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Username
          </label>
          <div className="relative">
            <AtSign className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={user?.username ?? ''}
              disabled
              className="input-flint pl-10 text-sm opacity-60 cursor-not-allowed bg-secondary/30"
            />
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">Usernames cannot be modified at this time.</p>
        </div>

        {/* Bio */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Bio
            </label>
            <span className="text-[11px] text-muted-foreground">
              {bio.length} / 160
            </span>
          </div>
          <div className="relative">
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value.slice(0, 160))}
              placeholder="Tell the world about yourself..."
              rows={3}
              maxLength={160}
              className="input-flint text-sm resize-none py-2.5"
            />
          </div>
        </div>

        {/* Website */}
        <div>
          <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Website
          </label>
          <div className="relative">
            <Globe className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://yourportfolio.com"
              className="input-flint pl-10 text-sm"
            />
          </div>
        </div>

        {/* Privacy Switch */}
        <div className="flex items-center justify-between pt-3 border-t border-border/60">
          <div className="space-y-0.5">
            <div className="flex items-center gap-1.5 font-medium text-sm text-foreground">
              <Lock className="w-4 h-4 text-primary" />
              <span>Private Account</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Only people you approve will be able to see your posts and stories.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsPrivate(!isPrivate)}
            className={`w-11 h-6 rounded-full transition-colors relative p-0.5 ${
              isPrivate ? 'bg-primary' : 'bg-secondary border border-border'
            }`}
          >
            <div
              className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${
                isPrivate ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* Bottom submit */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={isSaving || isUploadingPhoto}
            className="btn-spark w-full py-3 text-sm justify-center font-semibold touch-manipulation shadow-md"
            id="save-profile-bottom-btn"
          >
            {isSaving ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Saving changes...
              </span>
            ) : (
              'Save Profile Changes'
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
