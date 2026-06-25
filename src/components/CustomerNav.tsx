'use client';

import { useCartStore } from '@/hooks/useCart';
import { Coffee, ShoppingCart, ArrowLeft, User } from 'lucide-react';
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
    <header className="sticky top-0 z-50 bg-coffee-700 text-white shadow-lg">
      <div className={`${wide ? 'max-w-6xl' : 'max-w-2xl'} mx-auto px-4 py-4 flex items-center justify-between`}>
        <div className="flex items-center gap-4">
          {backHref && (
            <Link
              href={backHref}
              className="flex items-center gap-1.5 text-white/80 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="font-medium">{backLabel || 'Back'}</span>
            </Link>
          )}
          <Link href="/" className="flex items-center gap-2">
            <Coffee className="w-7 h-7" />
            <span className="text-xl font-bold">NY Locale Store</span>
          </Link>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/#menu"
            className="hidden sm:flex items-center gap-2 bg-white text-coffee-700 hover:bg-white/90 font-semibold px-4 py-2 rounded-lg text-sm transition-colors"
          >
            Order Now
          </Link>
          <Link
            href="/cart"
            className="relative flex items-center gap-2 bg-white/10 hover:bg-white/20 px-3 py-2 rounded-lg transition-colors"
          >
            <ShoppingCart className="w-5 h-5" />
            {cartCount > 0 && (
              <>
                <span className="absolute -top-1.5 -right-1.5 bg-white text-coffee-700 text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                  {cartCount}
                </span>
                <span className="text-sm font-medium hidden sm:block">
                  {cartCount} {cartCount === 1 ? 'item' : 'items'}
                </span>
              </>
            )}
          </Link>
          <Link
            href="/auth/login"
            className="p-2 text-white/60 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            title="Staff Login"
          >
            <User className="w-5 h-5" />
          </Link>
        </div>
      </div>
    </header>
  );
}
