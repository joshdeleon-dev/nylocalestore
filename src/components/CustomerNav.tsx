'use client';

import { useCartStore } from '@/hooks/useCart';
import { ShoppingBag, ArrowLeft, User } from 'lucide-react';
import Link from 'next/link';

interface CustomerNavProps {
  wide?: boolean;
  backHref?: string;
  backLabel?: string;
}

export default function CustomerNav({ wide = false, backHref, backLabel }: CustomerNavProps) {
  const { items } = useCartStore();
  const cartCount = items.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-coffee-200">
      <div className={`${wide ? 'max-w-screen-2xl' : 'max-w-2xl'} mx-auto px-5 h-14 flex items-center justify-between relative`}>

        {/* Left */}
        <div className="flex items-center gap-5 z-10">
          {backHref && (
            <Link href={backHref} className="flex items-center gap-1.5 text-coffee-500 hover:text-coffee-900 transition-colors text-sm">
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>{backLabel || 'Back'}</span>
            </Link>
          )}
        </div>

        {/* Center */}
        <Link href="/" className="absolute left-1/2 -translate-x-1/2">
          <span className="font-serif text-2xl font-medium tracking-tight text-coffee-900 whitespace-nowrap">New York Locale Store</span>
        </Link>

        {/* Right */}
        <nav className="flex items-center gap-0.5 z-10">
          <Link
            href="/#menu"
            className="hidden sm:block text-sm text-coffee-600 hover:text-coffee-900 px-3 py-1.5 rounded-md hover:bg-coffee-50 transition-colors"
          >
            Menu
          </Link>
          <Link
            href="/cart"
            className="flex items-center gap-2 text-sm font-medium text-coffee-900 bg-coffee-900 hover:bg-coffee-800 text-white px-4 py-1.5 rounded-full transition-colors ml-1"
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>{cartCount > 0 ? `Cart · ${cartCount}` : 'Cart'}</span>
          </Link>
          <Link
            href="/auth/login"
            className="ml-1 p-2 text-coffee-400 hover:text-coffee-700 hover:bg-coffee-100 rounded-md transition-colors"
            title="Staff Login"
          >
            <User className="w-4 h-4" />
          </Link>
        </nav>
      </div>
    </header>
  );
}
