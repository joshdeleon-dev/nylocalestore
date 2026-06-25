'use client';

import { DashboardNav } from '@/components/DashboardNav';

export default function ModifiersLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <DashboardNav />
      <div className="flex-1 flex flex-col min-w-0">
        <div className="md:hidden h-14" />
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
