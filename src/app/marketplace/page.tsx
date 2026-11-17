import Link from 'next/link';
import { headers } from 'next/headers';
import { Suspense } from 'react';
import { PackageOpen } from 'lucide-react';
import { CatalogControls } from '@/components/marketplace/CatalogControls';
import { ListingCard } from '@/components/marketplace/ListingCard';
import { CatalogSort, PAGE_SIZE, getCatalog, getCatalogCategories } from '@/lib/marketplaceCatalog';
import { marketplaceBase } from '@/lib/marketplaceSite';

type SearchParams = Promise<{ q?: string; category?: string; sort?: string; page?: string; flagship?: string }>;

const FLAGSHIP_PREVIEW = 8;

function FlagshipHeading() {
  return (
    <>
      <h2 className="font-serif text-2xl sm:text-3xl font-medium leading-tight">Shop for Flagship: 100% of Proceeds Support Our Flagship</h2>
      <p className="mt-2 text-coffee-200 max-w-2xl">Shop this collection and directly fund our flagship locale—100% of every sale is donated.</p>
    </>
  );
}

export default async function MarketplacePage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const base = marketplaceBase((await headers()).get('host'));
  const sort = (['newest', 'price_asc', 'price_desc'].includes(sp.sort ?? '') ? sp.sort : 'newest') as CatalogSort;
  const page = Math.max(1, Number(sp.page) || 1);

  const flagshipOnly = sp.flagship === '1';
  const filtered = Boolean(sp.q || sp.category || flagshipOnly);
  // The Shop for Flagship section sits on the unfiltered first page only
  const showFlagship = !filtered && page === 1;
  const [{ listings, total }, categories, flagship] = await Promise.all([
    getCatalog({ q: sp.q, category: sp.category, sort, page, flagship: flagshipOnly }),
    getCatalogCategories(),
    showFlagship ? getCatalog({ flagship: true }) : null,
  ]);
  const pages = Math.ceil(total / PAGE_SIZE);
  const pageHref = (p: number) => {
    const next = new URLSearchParams(Object.entries(sp).filter(([, v]) => v) as [string, string][]);
    if (p > 1) next.set('page', String(p)); else next.delete('page');
    const qs = next.toString();
    return `${base || '/'}${qs ? `?${qs}` : ''}`;
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-5 py-8 sm:py-12">
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-widest2 text-coffee-500 mb-2">Pre-loved · Local · Inspected in person</p>
        <h1 className="font-serif text-4xl sm:text-5xl font-medium text-coffee-900 leading-tight">
          Finds from <span className="italic">our locale</span>
        </h1>
        <p className="mt-3 text-coffee-600 max-w-xl">Reserve an item online, then see it in person and pay when you pick it up.</p>
      </div>

      {showFlagship && flagship && flagship.total > 0 && (
        <section className="mb-10 rounded-3xl bg-coffee-900 text-white p-5 sm:p-8" aria-label="Shop for Flagship">
          <FlagshipHeading />
          <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-5 text-coffee-900">
            {flagship.listings.slice(0, FLAGSHIP_PREVIEW).map((l) => <ListingCard key={l.id} listing={l} base={base} />)}
          </div>
          {flagship.total > FLAGSHIP_PREVIEW && (
            <Link href={`${base || '/'}?flagship=1`} className="inline-block mt-6 text-sm font-medium underline underline-offset-4">View all {flagship.total} items</Link>
          )}
        </section>
      )}

      {flagshipOnly && (
        <section className="mb-8 rounded-3xl bg-coffee-900 text-white p-5 sm:p-8" aria-label="Shop for Flagship">
          <FlagshipHeading />
          <Link href={base || '/'} className="inline-block mt-4 text-sm font-medium underline underline-offset-4">← All items</Link>
        </section>
      )}

      <Suspense>
        <CatalogControls base={base} categories={categories.filter((c) => c.count > 0)} />
      </Suspense>

      {listings.length === 0 ? (
        <div className="text-center py-20">
          <PackageOpen className="w-10 h-10 mx-auto text-coffee-300 mb-4" />
          <p className="text-coffee-800 font-medium">{filtered ? 'No items match your search.' : 'Nothing listed yet — check back soon.'}</p>
          <p className="text-sm text-coffee-500 mt-1">Have something to sell? We’d love to list it.</p>
          <Link href={`${base}/sell`} className="btn btn-primary mt-5 rounded-full px-6">Sell an item</Link>
        </div>
      ) : (
        <>
          <p className="text-sm text-coffee-500 mt-6 mb-4">{total} item{total === 1 ? '' : 's'}</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-5">
            {listings.map((l) => <ListingCard key={l.id} listing={l} base={base} />)}
          </div>
          {pages > 1 && (
            <nav className="flex justify-center items-center gap-3 mt-10 text-sm" aria-label="Pagination">
              {page > 1 && <Link href={pageHref(page - 1)} className="btn btn-outline rounded-full">← Previous</Link>}
              <span className="text-coffee-500">Page {page} of {pages}</span>
              {page < pages && <Link href={pageHref(page + 1)} className="btn btn-outline rounded-full">Next →</Link>}
            </nav>
          )}
        </>
      )}
    </div>
  );
}
