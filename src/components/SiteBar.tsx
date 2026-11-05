import { ArrowLeft } from 'lucide-react';
import { FOOD_URL, HOME_URL, SHOP_URL } from '@/components/SiteChrome';

export type SiteKey = 'home' | 'food' | 'shop';

// Thin bar shared by www, food. and shop. so customers can move between the three sites.
// The Marketplace link says "Coming soon" until the marketplace flag is on.
export function SiteBar({ current }: { current: SiteKey }) {
  const marketplaceLive = process.env.MARKETPLACE_ENABLED === 'true';

  const link = (key: SiteKey, href: string, label: string, extra?: React.ReactNode) => {
    const active = key === current;
    return (
      <a
        href={href}
        aria-current={active ? 'page' : undefined}
        className={`inline-flex items-center gap-1.5 whitespace-nowrap py-1 border-b transition-colors ${
          active ? 'text-white border-white' : 'text-coffee-300 border-transparent hover:text-white'
        }`}
      >
        {label}
        {extra}
      </a>
    );
  };

  return (
    <nav aria-label="NY Locale sites" className="bg-coffee-900 text-xs">
      <div className="max-w-6xl mx-auto px-4 sm:px-5 h-8 flex items-center justify-between gap-3">
        <a
          href={HOME_URL}
          aria-current={current === 'home' ? 'page' : undefined}
          className={`inline-flex items-center gap-1 whitespace-nowrap transition-colors ${current === 'home' ? 'text-white' : 'text-coffee-300 hover:text-white'}`}
        >
          {current !== 'home' && <ArrowLeft className="w-3.5 h-3.5" />}
          <span className="hidden sm:inline">NY Locale Store</span>
          <span className="sm:hidden">Home</span>
        </a>
        <div className="flex items-center gap-3 sm:gap-4">
          {link('food', FOOD_URL, 'Food & Drinks')}
          <span className="text-coffee-600" aria-hidden>·</span>
          {link(
            'shop',
            SHOP_URL,
            'Marketplace',
            !marketplaceLive && (
              <span className="rounded-full bg-white/10 text-coffee-200 text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5">Coming soon</span>
            )
          )}
        </div>
      </div>
    </nav>
  );
}
