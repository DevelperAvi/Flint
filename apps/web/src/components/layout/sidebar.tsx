'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Home, Compass, PlusSquare, User, Bell, Bookmark,
  LogOut, Settings, Flame, MessageCircle, Search,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/auth.store';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useState, useCallback } from 'react';
import { CreatePostModal } from '@/components/modals/create-post-modal';
import { useUnreadNotifications } from '@/hooks/use-notifications';

interface NavItem {
  icon: React.ElementType;
  label: string;
  href?: string;
  action?: () => void;
  badge?: number;
}

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout, isAuthenticated } = useAuthStore();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const { data: unreadCount } = useUnreadNotifications();

  const handleLogout = useCallback(async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    await logout('manual');
  }, [logout]);

  const navItems: NavItem[] = [
    { icon: Home, label: 'Home', href: '/' },
    { icon: Search, label: 'Search', href: '/explore' },
    { icon: Compass, label: 'Explore', href: '/explore' },
    { icon: MessageCircle, label: 'Messages', href: '/messages' },
    { icon: Bell, label: 'Notifications', href: '/notifications', badge: unreadCount?.data?.count },
    { icon: PlusSquare, label: 'Create', action: () => setShowCreateModal(true) },
    { icon: Bookmark, label: 'Saved', href: '/saved' },
    { icon: User, label: 'Profile', href: user ? `/@${user.username}` : '/login' },
  ];

  return (
    <>
      {/* Desktop Sidebar */}
      <motion.nav
        initial={false}
        animate={{ width: collapsed ? 72 : 240 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="hidden lg:flex flex-col fixed left-0 top-0 h-full border-r border-border bg-background z-40 overflow-hidden"
      >
        {/* Logo */}
        <Link
          href="/"
          className="flex items-center gap-3 px-5 py-7 group"
          onClick={() => collapsed && setCollapsed(false)}
        >
          <div className="w-9 h-9 spark-gradient rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg shadow-spark-500/20 group-hover:shadow-spark-500/40 transition-shadow">
            <Flame className="w-5 h-5 text-white" strokeWidth={2.5} />
          </div>
          <AnimatePresence>
            {!collapsed && (
              <motion.span
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="text-xl font-bold font-display spark-text"
              >
                Flint
              </motion.span>
            )}
          </AnimatePresence>
        </Link>

        {/* Navigation Items */}
        <div className="flex-1 px-3 space-y-1">
          {navItems.map((item) => {
            const isActive = item.href ? pathname === item.href : false;
            const Icon = item.icon;

            return (
              <NavButton
                key={item.label}
                item={item}
                isActive={isActive}
                collapsed={collapsed}
              />
            );
          })}
        </div>

        {/* Bottom section */}
        <div className="px-3 pb-6 space-y-1 border-t border-border pt-4">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="btn-ghost w-full justify-start"
          >
            <Settings className="w-5 h-5 flex-shrink-0" />
            <AnimatePresence>
              {!collapsed && (
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="text-sm"
                >
                  Settings
                </motion.span>
              )}
            </AnimatePresence>
          </button>

          {isAuthenticated && user && (
            <div className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-secondary transition-colors group cursor-pointer">
              <Avatar className="w-8 h-8 flex-shrink-0 ring-2 ring-transparent group-hover:ring-primary/30 transition-all">
                <AvatarImage src={user.avatarUrl ?? undefined} alt={user.username} />
                <AvatarFallback className="bg-spark-500/20 text-spark-400 text-xs font-bold">
                  {user.username[0].toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <AnimatePresence>
                {!collapsed && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex-1 min-w-0"
                  >
                    <p className="text-sm font-semibold truncate">{user.displayName ?? user.username}</p>
                    <p className="text-xs text-muted-foreground truncate">@{user.username}</p>
                  </motion.div>
                )}
              </AnimatePresence>
              {!collapsed && (
                <button
                  onClick={handleLogout}
                  className="p-1.5 rounded-lg text-muted-foreground hover:bg-destructive/20 hover:text-destructive transition-colors ml-auto flex-shrink-0"
                  title="Log out"
                  aria-label="Log out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              )}
            </div>
          )}
        </div>
      </motion.nav>

      {/* Mobile Top App Bar */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-40 h-14 bg-background/90 backdrop-blur-md border-b border-border flex items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 spark-gradient rounded-xl flex items-center justify-center shadow-md shadow-spark-500/20 group-hover:scale-105 transition-transform">
            <Flame className="w-4 h-4 text-white" strokeWidth={2.5} />
          </div>
          <span className="text-lg font-bold font-display spark-text">Flint</span>
        </Link>
        <div className="flex items-center gap-1">
          <Link
            href="/messages"
            className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            aria-label="Messages"
          >
            <MessageCircle className="w-5 h-5" />
          </Link>
          {isAuthenticated && user && (
            <button
              onClick={handleLogout}
              className="p-2 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
              aria-label="Log out"
              title="Log out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </header>

      {/* Mobile Bottom Nav */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur-md border-t border-border">
        <div className="flex items-center justify-around px-2 py-1.5 safe-area-pb">
          {/* 1. Home */}
          <Link
            href="/"
            className={cn(
              'flex flex-col items-center justify-center p-2.5 rounded-xl transition-colors',
              pathname === '/' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
            )}
            aria-label="Home"
          >
            <Home className="w-5 h-5" strokeWidth={pathname === '/' ? 2.5 : 1.8} />
          </Link>

          {/* 2. Explore / Search */}
          <Link
            href="/explore"
            className={cn(
              'flex flex-col items-center justify-center p-2.5 rounded-xl transition-colors',
              pathname === '/explore' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
            )}
            aria-label="Explore"
          >
            <Search className="w-5 h-5" strokeWidth={pathname === '/explore' ? 2.5 : 1.8} />
          </Link>

          {/* 3. Center Create Post Button */}
          <button
            onClick={() => setShowCreateModal(true)}
            className="relative -top-2.5 flex items-center justify-center w-11 h-11 rounded-2xl spark-gradient text-white shadow-lg shadow-spark-500/35 active:scale-95 transition-transform"
            aria-label="Create Post"
          >
            <PlusSquare className="w-5 h-5" strokeWidth={2.4} />
          </button>

          {/* 4. Notifications */}
          <Link
            href="/notifications"
            className={cn(
              'relative flex flex-col items-center justify-center p-2.5 rounded-xl transition-colors',
              pathname === '/notifications' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
            )}
            aria-label="Notifications"
          >
            <Bell className="w-5 h-5" strokeWidth={pathname === '/notifications' ? 2.5 : 1.8} />
            {unreadCount?.data?.count && unreadCount.data.count > 0 ? (
              <span className="absolute top-1.5 right-1.5 w-4 h-4 text-[9px] font-bold bg-primary text-primary-foreground rounded-full flex items-center justify-center">
                {unreadCount.data.count > 9 ? '9+' : unreadCount.data.count}
              </span>
            ) : null}
          </Link>

          {/* 5. Profile */}
          <Link
            href={user ? `/@${user.username}` : '/login'}
            className={cn(
              'flex flex-col items-center justify-center p-2 rounded-xl transition-colors',
              pathname.startsWith('/@') || pathname === '/login'
                ? 'text-primary'
                : 'text-muted-foreground hover:text-foreground'
            )}
            aria-label="Profile"
          >
            {user?.avatarUrl ? (
              <Avatar className={cn('w-6 h-6 ring-2 transition-all', pathname.startsWith('/@') ? 'ring-primary' : 'ring-transparent')}>
                <AvatarImage src={user.avatarUrl} alt={user.username} />
                <AvatarFallback className="text-[10px] font-bold bg-spark-500/20 text-spark-400">
                  {user.username[0].toUpperCase()}
                </AvatarFallback>
              </Avatar>
            ) : (
              <User className="w-5 h-5" strokeWidth={pathname.startsWith('/@') || pathname === '/login' ? 2.5 : 1.8} />
            )}
          </Link>
        </div>
      </nav>

      <CreatePostModal open={showCreateModal} onClose={() => setShowCreateModal(false)} />
    </>
  );
}

function NavButton({
  item,
  isActive,
  collapsed,
}: {
  item: NavItem;
  isActive: boolean;
  collapsed: boolean;
}) {
  const Icon = item.icon;

  const content = (
    <motion.div
      whileHover={{ x: 2 }}
      whileTap={{ scale: 0.97 }}
      className={cn(
        'relative flex items-center gap-3 px-3 py-3 rounded-xl w-full transition-all duration-150 cursor-pointer',
        isActive
          ? 'bg-primary/10 text-primary font-semibold'
          : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
      )}
    >
      <div className="relative flex-shrink-0">
        <Icon className="w-5 h-5" strokeWidth={isActive ? 2.5 : 1.8} />
        {item.badge && item.badge > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 text-[9px] font-bold bg-primary text-primary-foreground rounded-full flex items-center justify-center">
            {item.badge > 9 ? '9+' : item.badge}
          </span>
        )}
      </div>
      <AnimatePresence>
        {!collapsed && (
          <motion.span
            initial={{ opacity: 0, x: -4 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -4 }}
            className="text-sm whitespace-nowrap"
          >
            {item.label}
          </motion.span>
        )}
      </AnimatePresence>
      {isActive && (
        <motion.div
          layoutId="sidebar-active-indicator"
          className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-primary rounded-r-full"
        />
      )}
    </motion.div>
  );

  if (item.action) {
    return <button onClick={item.action} className="w-full">{content}</button>;
  }
  return <Link href={item.href!} className="w-full">{content}</Link>;
}
