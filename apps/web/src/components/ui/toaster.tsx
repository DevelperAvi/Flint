'use client';

import * as Toast from '@radix-ui/react-toast';
import { X } from 'lucide-react';
import { create } from 'zustand';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

interface ToastItem {
  id: string;
  title: string;
  description?: string;
  variant?: 'default' | 'success' | 'error';
}

interface ToastStore {
  toasts: ToastItem[];
  addToast: (toast: Omit<ToastItem, 'id'>) => void;
  removeToast: (id: string) => void;
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  addToast: (toast) =>
    set((state) => ({
      toasts: [...state.toasts, { ...toast, id: Math.random().toString(36).slice(2) }],
    })),
  removeToast: (id) =>
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));

export function toast(opts: Omit<ToastItem, 'id'>) {
  useToastStore.getState().addToast(opts);
}

export function Toaster() {
  const { toasts, removeToast } = useToastStore();

  return (
    <Toast.Provider swipeDirection="right" duration={4000}>
      {toasts.map((t) => (
        <Toast.Root
          key={t.id}
          open
          onOpenChange={(open) => !open && removeToast(t.id)}
          className={cn(
            'glass-strong border rounded-2xl p-4 shadow-xl flex items-start gap-3',
            'data-[state=open]:animate-slide-in-right data-[state=closed]:opacity-0',
            'transition-all',
            t.variant === 'error' && 'border-destructive/30 bg-destructive/10',
            t.variant === 'success' && 'border-green-500/30 bg-green-500/10',
          )}
        >
          <div className="flex-1">
            <Toast.Title className="text-sm font-semibold">{t.title}</Toast.Title>
            {t.description && (
              <Toast.Description className="text-xs text-muted-foreground mt-0.5">
                {t.description}
              </Toast.Description>
            )}
          </div>
          <Toast.Close asChild>
            <button className="text-muted-foreground hover:text-foreground transition-colors">
              <X className="w-4 h-4" />
            </button>
          </Toast.Close>
        </Toast.Root>
      ))}
      <Toast.Viewport className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 w-80 max-w-[calc(100vw-2rem)]" />
    </Toast.Provider>
  );
}
