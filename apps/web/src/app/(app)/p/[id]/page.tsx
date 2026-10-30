'use client';

import { PostDetailContent } from '@/components/modals/post-detail-modal';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

interface PostPageProps {
  params: { id: string };
}

export default function PostPage({ params }: PostPageProps) {
  return (
    <div className="max-w-5xl mx-auto px-4 py-4 pb-24 lg:pb-6">
      <div className="mb-4">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to feed
        </Link>
      </div>

      <div className="min-h-[500px] lg:h-[75vh] bg-card border border-border rounded-2xl overflow-hidden shadow-xl">
        <PostDetailContent postId={params.id} />
      </div>
    </div>
  );
}

