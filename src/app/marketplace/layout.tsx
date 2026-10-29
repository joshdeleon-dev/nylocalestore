import type { Metadata } from 'next';
import Link from 'next/link';
import { headers } from 'next/headers';
import { MapPin, Plus } from 'lucide-react';
import { marketplaceBase } from '@/lib/marketplaceSite';
import { FOOD_URL, HOME_URL } from '@/components/SiteChrome';

export const metadata: Metadata = {
  title: { default: 'Marketplace | NY Locale Store', template: '%s | NY Locale Marketplace' },
  description: 'Pre-loved finds from our locale. Reserve online, inspect and pick up in person.',
};

export default async function MarketplaceLayout({ children }: { children: React.ReactNode }) {
  const base = marketplaceBase((await headers()).get('host'));

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-coffee-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-5 h-16 flex items-center justify-between gap-3">
          <Link href={base || '/'} className="min-w-0">
            <span className="block font-serif text-lg sm:text-xl font-medium tracking-tight text-coffee-900 leading-tight truncate">
              New York Locale
            </span>
            <span className="block text-[11px] font-semibold uppercase tracking-widest2 text-coffee-500">Marketplace</span>
          </Link>
          <nav className="flex items-center gap-1 sm:gap-2">
            <Link href={base || '/'} className="hidden sm:block text-sm text-coffee-600 hover:text-coffee-900 px-3 py-2 rounded-md hover:bg-coffee-50">
              Browse
            </Link>
            <Link
              href={`${base}/sell`}
              className="inline-flex items-center gap-1.5 rounded-full bg-coffee-900 text-white text-sm font-medium px-4 py-2 hover:bg-coffee-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Sell an item
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-coffee-200/70 mt-16">
        <div className="max-w-6xl mx-auto px-5 py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-coffee-500">
          <p className="inline-flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" /> Pickup at the Locale · New York</p>
          <div className="flex gap-4">
            <a href={HOME_URL} className="hover:text-coffee-900">NY Locale Store</a>
            <a href={FOOD_URL} className="hover:text-coffee-900">Order Food</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
