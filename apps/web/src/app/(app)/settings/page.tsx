'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  User, Shield, Bell, Moon, LogOut, ChevronRight,
  Flame, Lock, ArrowLeft,
} from 'lucide-react';
import { useAuthStore } from '@/store/auth.store';

export default function SettingsPage() {
  const router = useRouter();
  const { user, logout } = useAuthStore();

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  const sections = [
    {
      title: 'Account',
      items: [
        {
          icon: User,
          label: 'Edit Profile',
          description: 'Name, bio, website and profile picture',
          href: '/settings/profile',
        },
      ],
    },
    {
      title: 'Preferences',
      items: [
        {
          icon: Bell,
          label: 'Notifications',
          description: 'Push, email and in-app alerts',
          href: '/notifications',
        },
      ],
    },
  ];

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 pb-28 lg:pb-8 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 pb-2 border-b border-border">
        <Link
          href={user ? `/@${user.username}` : '/'}
          className="p-2 -ml-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          aria-label="Back to profile"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-xl sm:text-2xl font-bold font-display">Settings</h1>
      </div>

      {/* Sections */}
      <div className="space-y-6">
        {sections.map((sec) => (
          <div key={sec.title} className="space-y-2">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">
              {sec.title}
            </h2>
            <div className="card-flint divide-y divide-border/50 overflow-hidden">
              {sec.items.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    className="p-4 flex items-center justify-between hover:bg-secondary/40 transition-colors group"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="w-9 h-9 rounded-xl bg-secondary flex items-center justify-center text-foreground group-hover:text-primary transition-colors">
                        <Icon className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                          {item.label}
                        </p>
                        <p className="text-xs text-muted-foreground">{item.description}</p>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
                  </Link>
                );
              })}
            </div>
          </div>
        ))}

        {/* Danger / Logout Section */}
        <div className="space-y-2 pt-2">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">
            Session
          </h2>
          <div className="card-flint p-4 flex items-center justify-between">
            <div className="flex items-center gap-3.5">
              <div className="w-9 h-9 rounded-xl bg-destructive/10 text-destructive flex items-center justify-center">
                <LogOut className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Log out</p>
                <p className="text-xs text-muted-foreground">Sign out of {user?.username ?? 'your account'}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="btn-ghost text-xs px-3 py-1.5 border border-destructive/30 text-destructive hover:bg-destructive/10 rounded-lg touch-manipulation"
              id="settings-logout-btn"
            >
              Log out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
