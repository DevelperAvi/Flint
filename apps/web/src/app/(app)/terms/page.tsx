'use client';

import Link from 'next/link';
import { ArrowLeft, Shield, Flame } from 'lucide-react';

export default function TermsPage() {
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
          <h1 className="text-2xl font-bold font-display">Terms of Service</h1>
        </div>
      </div>

      <div className="card-flint p-6 sm:p-8 space-y-6 text-sm text-foreground/90 leading-relaxed">
        <section className="space-y-2">
          <h2 className="text-base font-semibold text-foreground">1. Welcome to Flint</h2>
          <p className="text-muted-foreground">
            Flint is a modern visual social networking platform designed for sharing authentic moments,
            creative visuals, stories, and sparks of inspiration. By accessing or using Flint, you agree to
            be bound by these Terms of Service.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-foreground">2. Content & Community Guidelines</h2>
          <p className="text-muted-foreground">
            You retain full ownership of the visual media and content you publish on Flint. You grant Flint
            a non-exclusive license to host, display, and stream your content to your followers and on public
            discovery feeds. You agree not to upload harmful, abusive, infringing, or illegal material.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-foreground">3. Account Safety & Privacy</h2>
          <p className="text-muted-foreground">
            You are responsible for maintaining the confidentiality of your login credentials. Flint employs
            industry-standard end-to-end security, argon2 hashing, and JWT authorization to protect your account.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-foreground">4. Termination & Updates</h2>
          <p className="text-muted-foreground">
            You can delete or manage your posts, stories, and account at any time through Settings. Flint reserves
            the right to update these terms to reflect feature evolutions and community protections.
          </p>
        </section>
      </div>
    </div>
  );
}

