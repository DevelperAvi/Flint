'use client';

import Link from 'next/link';
import { ArrowLeft, Lock, Flame } from 'lucide-react';

export default function PrivacyPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-8 pb-28 lg:pb-12 space-y-8">
      <div className="flex items-center gap-3 pb-4 border-b border-border">
        <Link
          href="/"
          className="p-2 -ml-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl spark-gradient flex items-center justify-center">
            <Flame className="w-4 h-4 text-white" />
          </div>
          <h1 className="text-2xl font-bold font-display">Privacy Policy</h1>
        </div>
      </div>

      <div className="card-flint p-6 sm:p-8 space-y-6 text-sm text-foreground/90 leading-relaxed">
        <section className="space-y-2">
          <h2 className="text-base font-semibold text-foreground">1. Information We Collect</h2>
          <p className="text-muted-foreground">
            We collect the information you provide when creating an account (username, email, display name),
            the photos, videos, stories, and comments you share, and your interactions with creators.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-foreground">2. Ephemeral Content (Stories)</h2>
          <p className="text-muted-foreground">
            Stories published on Flint automatically expire after 24 hours. Once expired, they are removed
            from active discovery and user story feeds.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-foreground">3. Data Security & Storage</h2>
          <p className="text-muted-foreground">
            All passwords are protected using memory-hard Argon2id cryptographic hashing. Media uploads are
            securely transmitted over encrypted HTTPS/TLS channels with pre-signed access controls.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-foreground">4. Controlling Your Profile</h2>
          <p className="text-muted-foreground">
            You can set your profile to Private under Settings to ensure only approved followers can view your
            posts and stories. You can also edit your bio, profile picture, or delete posts at any time.
          </p>
        </section>
      </div>
    </div>
  );
}

