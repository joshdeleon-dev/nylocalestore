import type { Metadata } from 'next';
import { ArrowLeft, ArrowUpRight, Banknote, MapPin, Search, Tag } from 'lucide-react';
import { FOOD_URL, HOME_URL, SiteBackdrop, SiteHeader } from '@/components/SiteChrome';

// Temporary page for shop.nylocalestore.com. Middleware rewrites every path on the
// shop host here until the Marketplace launches.

export const metadata: Metadata = {
  title: 'Marketplace · Coming Soon | NY Locale Store',
  description: 'The NY Locale Marketplace for pre-loved local finds is coming soon.',
  robots: { index: false },
};

const FEATURES = [
  { icon: Tag, title: 'Sell without an account', body: 'Tell us about your item and we handle the listing.' },
  { icon: Search, title: 'Inspect before you buy', body: 'Reserve online, then see it in person at our locale.' },
  { icon: Banknote, title: 'Pay & pick up locally', body: 'Simple payment & pickup process.' },
];

export default function ComingSoonPage() {
  return (
    <div className="relative min-h-screen flex flex-col overflow-hidden">
      <SiteBackdrop />
      <SiteHeader href={HOME_URL} />

      <main className="flex-1 flex items-center">
        <div className="max-w-6xl w-full mx-auto px-5 py-14 sm:py-20">
          <div className="max-w-3xl mx-auto text-center">
            <span className="lp-rise inline-flex items-center gap-2 rounded-full border border-coffee-200 bg-white/70 backdrop-blur px-3 py-1 text-xs font-medium text-coffee-700">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              Marketplace · Coming Soon
            </span>
            <h1
              className="lp-rise mt-6 font-serif text-[2.6rem] sm:text-7xl font-medium text-coffee-900 leading-[1.02] tracking-tight"
              style={{ animationDelay: '80ms' }}
            >
              Something good is
              <br />
              <span className="italic bg-gradient-to-r from-coffee-500 via-coffee-400 to-coffee-700 bg-clip-text text-transparent pr-2">
                on the way.
              </span>
            </h1>
            <p className="lp-rise mt-5 text-coffee-600 text-base sm:text-lg max-w-xl mx-auto" style={{ animationDelay: '160ms' }}>
              We&apos;re building a marketplace for pre-loved finds from your brothers and sisters in our locale.
            </p>
          </div>

          <div className="mt-12 sm:mt-16 grid gap-4 sm:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, body }, i) => (
              <div
                key={title}
                className="lp-rise rounded-3xl border border-coffee-200/80 bg-white/55 backdrop-blur-xl p-6"
                style={{ animationDelay: `${240 + i * 80}ms` }}
              >
                <div className="w-10 h-10 rounded-full bg-coffee-100 flex items-center justify-center mb-4">
                  <Icon className="w-5 h-5 text-coffee-700" />
                </div>
                <h2 className="font-serif text-xl font-medium text-coffee-900 mb-1">{title}</h2>
                <p className="text-coffee-600 text-sm leading-relaxed">{body}</p>
              </div>
            ))}
          </div>

          <div className="lp-rise mt-12 flex flex-col sm:flex-row items-center justify-center gap-3" style={{ animationDelay: '480ms' }}>
            <a
              href={FOOD_URL}
              className="inline-flex items-center gap-2 rounded-full bg-coffee-900 text-white text-sm font-medium px-6 py-3 hover:bg-coffee-700 transition-colors"
            >
              Order food in the meantime
              <ArrowUpRight className="w-4 h-4" />
            </a>
            <a
              href={HOME_URL}
              className="inline-flex items-center gap-2 rounded-full border border-coffee-200 bg-white/60 text-coffee-800 text-sm font-medium px-6 py-3 hover:bg-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to home
            </a>
          </div>
        </div>
      </main>

      <footer className="max-w-6xl w-full mx-auto px-5 py-6 flex flex-col sm:flex-row items-center justify-between gap-2 border-t border-coffee-200/70 text-xs text-coffee-500">
        <p>© NY Locale Store</p>
        <p className="inline-flex items-center gap-1.5">
          <MapPin className="w-3.5 h-3.5" />
          New York
        </p>
      </footer>
    </div>
  );
}
