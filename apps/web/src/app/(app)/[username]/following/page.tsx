import { UserConnectionsView } from '@/components/profile/user-connections-view';
import type { Metadata } from 'next';

interface FollowingPageProps {
  params: { username: string };
}

export async function generateMetadata({ params }: FollowingPageProps): Promise<Metadata> {
  const cleanUsername = params.username.replace(/^(@|%40)/, '');
  return {
    title: `People followed by @${cleanUsername} • Flint`,
    description: `See who @${cleanUsername} is following on Flint`,
  };
}

export default function FollowingPage({ params }: FollowingPageProps) {
  const username = params.username.replace(/^(@|%40)/, '');
  return <UserConnectionsView username={username} initialTab="following" />;
}

