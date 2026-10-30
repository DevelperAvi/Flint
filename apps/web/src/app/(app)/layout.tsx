import { Sidebar } from '@/components/layout/sidebar';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 lg:ml-60 pt-14 lg:pt-4 pb-20 lg:pb-8 min-h-screen">
        {children}
      </main>
    </div>
  );
}
