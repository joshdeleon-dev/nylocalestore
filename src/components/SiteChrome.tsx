// Shared background and header for the www landing page and the shop "coming soon" page.
// Not used by the food app.

export const FOOD_URL = process.env.NEXT_PUBLIC_FOOD_URL ?? 'https://food.nylocalestore.com';
export const SHOP_URL = process.env.NEXT_PUBLIC_SHOP_URL ?? 'https://shop.nylocalestore.com';
export const HOME_URL = process.env.NEXT_PUBLIC_HOME_URL ?? 'https://www.nylocalestore.com';

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

export function SiteBackdrop() {
  return (
    <>
      <style>{styles}</style>
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="lp-grid absolute inset-0" />
        <div className="lp-drift absolute -top-40 -left-32 w-[520px] h-[520px] rounded-full bg-coffee-300/40 blur-3xl" />
        <div className="lp-drift absolute top-1/3 -right-40 w-[460px] h-[460px] rounded-full bg-coffee-200/70 blur-3xl [animation-delay:-9s]" />
      </div>
    </>
  );
}

export function SiteHeader({ href }: { href?: string }) {
  const title = (
    <span className="font-serif text-lg sm:text-xl font-medium tracking-tight text-coffee-900">
      New York Locale Store
    </span>
  );

  return (
    <header className="max-w-6xl w-full mx-auto px-5 pt-5">
      <div className="flex items-center justify-center rounded-full border border-coffee-200/70 bg-white/60 backdrop-blur-md px-5 h-14">
        {href ? <a href={href}>{title}</a> : title}
      </div>
    </header>
  );
}
