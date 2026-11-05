'use client';

import { useCartStore } from '@/hooks/useCart';
import { AlertTriangle, ShoppingBag, User } from 'lucide-react';
import Link from 'next/link';
import { SiteBar } from '@/components/SiteBar';

interface CustomerNavProps {
  paused?: boolean; // shows the "ordering is paused" bar above the header
}

// Food storefront header, styled to match the marketplace header
export default function CustomerNav({ paused = false }: CustomerNavProps) {
  const { items } = useCartStore();
  const cartCount = items.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <>
      <SiteBar current="food" />
      <div className="sticky top-0 z-40">
      {paused && (
        <div className="bg-amber-400 border-b border-amber-500">
          <div className="flex items-center justify-center gap-2 px-4 py-2.5">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 text-amber-900" />
            <span className="text-sm font-semibold text-amber-900">Ordering is currently paused — we’ll be back soon!</span>
          </div>
        </div>
      )}
      <header className="bg-white/90 backdrop-blur-md border-b border-coffee-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-5 h-16 flex items-center justify-between gap-3">
          <Link href="/" className="min-w-0">
            <span className="block font-serif text-lg sm:text-xl font-medium tracking-tight text-coffee-900 leading-tight truncate">
              New York Locale
            </span>
            <span className="block text-[11px] font-semibold uppercase tracking-widest2 text-coffee-500">Food &amp; Drinks</span>
          </Link>
          <nav className="flex items-center gap-1 sm:gap-2">
            <Link href="/#menu" className="hidden sm:block text-sm text-coffee-600 hover:text-coffee-900 px-3 py-2 rounded-md hover:bg-coffee-50">
              Menu
            </Link>
            <Link
              href="/cart"
              className="inline-flex items-center gap-1.5 rounded-full bg-coffee-900 text-white text-sm font-medium px-4 py-2 hover:bg-coffee-700 transition-colors"
              aria-label={cartCount > 0 ? `Cart, ${cartCount} item${cartCount === 1 ? '' : 's'}` : 'Cart'}
            >
              <ShoppingBag className="w-4 h-4" />
              Cart
              {cartCount > 0 && (
                <span className="ml-0.5 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-white text-coffee-900 text-xs font-semibold">
                  {cartCount}
                </span>
              )}
            </Link>
            <Link href="/auth/login" className="p-2 text-coffee-400 hover:text-coffee-800 hover:bg-coffee-50 rounded-md transition-colors" title="Staff login" aria-label="Staff login">
              <User className="w-4 h-4" />
            </Link>
          </nav>
        </div>
      </header>
    </div>
    </>
  );
}
