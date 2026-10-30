import { UserConnectionsView } from '@/components/profile/user-connections-view';
import type { Metadata } from 'next';

interface FollowersPageProps {
  params: { username: string };
}

export async function generateMetadata({ params }: FollowersPageProps): Promise<Metadata> {
  const cleanUsername = params.username.replace(/^(@|%40)/, '');
  return {
    title: `Followers of @${cleanUsername} • Flint`,
    description: `See who follows @${cleanUsername} on Flint`,
  };
}

export default function FollowersPage({ params }: FollowersPageProps) {
  const username = params.username.replace(/^(@|%40)/, '');
  return <UserConnectionsView username={username} initialTab="followers" />;
}

