import type { Metadata } from 'next';
import { ArrowUpRight, Coffee, MapPin, Store } from 'lucide-react';

// Served at the root of www.nylocalestore.com via a host rewrite in middleware.
// Self-contained: no Supabase, no cart, nothing shared with the food app.

const FOOD_URL = process.env.NEXT_PUBLIC_FOOD_URL ?? 'https://food.nylocalestore.com';
const SHOP_URL = process.env.NEXT_PUBLIC_SHOP_URL ?? 'https://shop.nylocalestore.com';

export const metadata: Metadata = {
  title: 'NY Locale Store',
  description: 'Enjoy the drinks and food made to order while browsing through our new community marketplace for pre-loved finds.',
};

// Page-scoped animation + background styles, kept here so the shared Tailwind config is untouched.
const styles = `
  @keyframes lp-rise { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: none; } }
  @keyframes lp-drift { 0%, 100% { transform: translate(0, 0) scale(1); } 50% { transform: translate(30px, -20px) scale(1.08); } }
  .lp-rise { animation: lp-rise 0.8s cubic-bezier(0.2, 0.7, 0.2, 1) both; }
  .lp-drift { animation: lp-drift 18s ease-in-out infinite; }
  .lp-grid {
    background-image: radial-gradient(rgb(66 45 24 / 0.12) 1px, transparent 1px);
    background-size: 22px 22px;
    mask-image: radial-gradient(ellipse 70% 60% at 50% 40%, #000 30%, transparent 75%);
  }
  @media (prefers-reduced-motion: reduce) { .lp-rise, .lp-drift { animation: none; } }
`;

export default function LandingPage() {
  return (
    <div className="relative min-h-screen flex flex-col overflow-hidden">
      <style>{styles}</style>

      {/* Background */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="lp-grid absolute inset-0" />
        <div className="lp-drift absolute -top-40 -left-32 w-[520px] h-[520px] rounded-full bg-coffee-300/40 blur-3xl" />
        <div className="lp-drift absolute top-1/3 -right-40 w-[460px] h-[460px] rounded-full bg-coffee-200/70 blur-3xl [animation-delay:-9s]" />
      </div>

      <header className="max-w-6xl w-full mx-auto px-5 pt-5">
        <div className="flex items-center justify-center rounded-full border border-coffee-200/70 bg-white/60 backdrop-blur-md px-5 h-14">
          <span className="font-serif text-lg sm:text-xl font-medium tracking-tight text-coffee-900">
            New York Locale Store
          </span>
        </div>
      </header>

      <main className="flex-1 flex items-center">
        <div className="max-w-6xl w-full mx-auto px-5 py-14 sm:py-20">
          <div className="max-w-3xl mb-12 sm:mb-16">
            <span className="lp-rise inline-flex items-center gap-2 rounded-full border border-coffee-200 bg-white/70 backdrop-blur px-3 py-1 text-xs font-medium text-coffee-700">
              <span className="relative flex w-2 h-2">
                <span className="absolute inline-flex w-full h-full rounded-full bg-emerald-500 opacity-60 animate-ping" />
                <span className="relative inline-flex w-2 h-2 rounded-full bg-emerald-500" />
              </span>
              Now serving · New York
            </span>
            <h1
              className="lp-rise mt-6 font-serif text-5xl sm:text-7xl font-medium text-coffee-900 leading-[1.02] tracking-tight"
              style={{ animationDelay: '80ms' }}
            >
              Two ways to
              <br />
              <span className="italic bg-gradient-to-r from-coffee-500 via-coffee-400 to-coffee-700 bg-clip-text text-transparent pr-2">
                shop local.
              </span>
            </h1>
            <p className="lp-rise mt-5 text-coffee-600 text-base sm:text-lg max-w-xl" style={{ animationDelay: '160ms' }}>
              Enjoy the drinks and food made to order while browsing through our new community marketplace for pre-loved finds.
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-5">
            <a
              href={FOOD_URL}
              className="lp-rise group relative md:col-span-3 flex flex-col justify-between min-h-[320px] overflow-hidden rounded-3xl bg-coffee-900 text-white p-7 sm:p-10 transition-transform duration-300 hover:-translate-y-1 focus:outline-none focus-visible:ring-4 focus-visible:ring-coffee-300"
              style={{ animationDelay: '240ms' }}
            >
              <div aria-hidden className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-coffee-400/30 blur-3xl transition-opacity duration-500 group-hover:opacity-70" />
              <Coffee aria-hidden className="absolute -bottom-10 -right-6 w-64 h-64 text-white/[0.04] rotate-[-12deg] transition-transform duration-500 group-hover:rotate-0" />

              <div className="relative flex items-center justify-between">
                <span className="text-xs font-semibold tracking-widest2 text-coffee-300">01</span>
                <span className="w-12 h-12 rounded-full bg-white text-coffee-900 flex items-center justify-center transition-transform duration-300 group-hover:rotate-45">
                  <ArrowUpRight className="w-5 h-5" />
                </span>
              </div>

              <div className="relative">
                <h2 className="font-serif text-4xl sm:text-5xl font-medium mb-3">Order Food</h2>
                <p className="text-coffee-200 text-sm sm:text-base leading-relaxed max-w-sm">
                  Coffee, drinks and food made fresh. Order ahead and pick up when it&apos;s ready.
                </p>
              </div>
            </a>

            <a
              href={SHOP_URL}
              className="lp-rise group relative md:col-span-2 flex flex-col justify-between min-h-[320px] overflow-hidden rounded-3xl border border-coffee-200/80 bg-white/55 backdrop-blur-xl text-coffee-900 p-7 sm:p-10 transition-transform duration-300 hover:-translate-y-1 focus:outline-none focus-visible:ring-4 focus-visible:ring-coffee-300"
              style={{ animationDelay: '320ms' }}
            >
              <Store aria-hidden className="absolute -bottom-8 -right-6 w-52 h-52 text-coffee-900/[0.04] rotate-[-12deg] transition-transform duration-500 group-hover:rotate-0" />

              <div className="relative flex items-center justify-between">
                <span className="text-xs font-semibold tracking-widest2 text-coffee-400">02</span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-coffee-900 text-white text-[11px] font-semibold uppercase tracking-wider px-3 py-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                  Coming Soon
                </span>
              </div>

              <div className="relative">
                <h2 className="font-serif text-4xl font-medium mb-3">Marketplace</h2>
                <p className="text-coffee-600 text-sm sm:text-base leading-relaxed mb-5">
                  Pre-loved items from our local community, inspected and picked up in person.
                </p>
                <span className="inline-flex items-center gap-1.5 text-sm font-medium text-coffee-700 border-b border-coffee-300 pb-0.5 group-hover:border-coffee-700 transition-colors">
                  Take a peek
                  <ArrowUpRight className="w-4 h-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                </span>
              </div>
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
