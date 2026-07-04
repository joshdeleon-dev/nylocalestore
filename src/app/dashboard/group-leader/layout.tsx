'use client';

import { useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { Coffee, LogOut } from 'lucide-react';

export default function GroupLeaderLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, signOut } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && (!user || user.role !== 'GROUP_LEADER')) {
      router.replace('/auth/login');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-coffee-50 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-coffee-700 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user || user.role !== 'GROUP_LEADER') return null;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Minimal top nav */}
      <header className="sticky top-0 z-40 bg-white border-b border-gray-200 px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Coffee className="w-5 h-5 text-coffee-700" />
          <span className="font-semibold text-gray-900 text-sm">NY Locale Store</span>
          <span className="text-gray-300 text-sm">·</span>
          <span className="text-gray-500 text-sm">
            Group {user.group_number ?? '—'} Reports
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500 hidden sm:block">{user.full_name}</span>
          <button
            onClick={signOut}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:block">Sign out</span>
          </button>
        </div>
      </header>
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
