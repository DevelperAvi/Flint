import { ProfileView } from '@/components/profile/profile-view';
import type { Metadata } from 'next';

interface ProfilePageProps {
  params: { username: string };
}

export async function generateMetadata({ params }: ProfilePageProps): Promise<Metadata> {
  return {
    title: `@${params.username}`,
    description: `View ${params.username}'s profile on Flint`,
  };
}

export default function ProfilePage({ params }: ProfilePageProps) {
  // Strip @ prefix if present in URL
  const username = params.username.startsWith('%40')
    ? params.username.slice(3)
    : params.username.startsWith('@')
    ? params.username.slice(1)
    : params.username;

  return <ProfileView username={username} />;
}
