import type { Metadata } from 'next';
import Link from 'next/link';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { ArrowLeft, Banknote, CalendarCheck, MapPin, Search } from 'lucide-react';
import { PhotoGallery } from '@/components/marketplace/PhotoGallery';
import { CONDITION_LABELS, formatCents } from '@/lib/marketplace';
import { getPublicListing } from '@/lib/marketplaceCatalog';
import { marketplaceBase } from '@/lib/marketplaceSite';

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const listing = await getPublicListing((await params).slug);
  if (!listing) return { title: 'Item not found' };
  return {
    title: listing.title,
    description: listing.description.slice(0, 160) || `${listing.title} — ${formatCents(listing.price_cents)}`,
    openGraph: listing.images[0] ? { images: [listing.images[0]] } : undefined,
  };
}

const STEPS = [
  { icon: CalendarCheck, text: 'Request to reserve — we’ll hold it for you and set up a time.' },
  { icon: Search, text: 'Inspect the item in person before you decide.' },
  { icon: Banknote, text: 'Pay at pickup. No online payment, no shipping.' },
];

export default async function ListingPage({ params }: { params: Params }) {
  const listing = await getPublicListing((await params).slug);
  if (!listing) notFound();
  const base = marketplaceBase((await headers()).get('host'));

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-5 py-6 sm:py-10">
      <Link href={base || '/'} className="inline-flex items-center gap-1.5 text-sm text-coffee-500 hover:text-coffee-900 mb-5">
        <ArrowLeft className="w-4 h-4" /> All items
      </Link>

      <div className="grid lg:grid-cols-2 gap-8 lg:gap-12">
        <PhotoGallery images={listing.images} title={listing.title} reserved={listing.is_reserved} />

        <div>
          {listing.category && (
            <Link href={`${base || '/'}?category=${listing.category.slug}`} className="text-xs font-semibold uppercase tracking-widest2 text-coffee-500 hover:text-coffee-800">
              {listing.category.name}
            </Link>
          )}
          <h1 className="font-serif text-3xl sm:text-4xl font-medium text-coffee-900 mt-2 leading-tight">{listing.title}</h1>
          <p className="text-2xl font-semibold text-coffee-900 mt-3">{formatCents(listing.price_cents)}</p>

          <dl className="mt-5 flex flex-wrap gap-2 text-sm">
            <div className="rounded-full bg-coffee-100 px-3 py-1"><dt className="sr-only">Condition</dt><dd className="text-coffee-800">{CONDITION_LABELS[listing.condition]}</dd></div>
            <div className="rounded-full bg-coffee-100 px-3 py-1 inline-flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /><dd className="text-coffee-800">Pickup at the Locale</dd></div>
          </dl>

          <div className="mt-6">
            {listing.is_reserved ? (
              <div className="rounded-xl bg-coffee-100 text-coffee-800 px-5 py-4 text-sm font-medium">This item is reserved by another buyer.</div>
            ) : (
              <>
                <button type="button" disabled className="w-full rounded-full bg-coffee-900 text-white font-medium py-3.5 opacity-50 cursor-not-allowed">
                  Request to Reserve
                </button>
                <p className="text-xs text-coffee-500 text-center mt-2">Reservations open soon.</p>
              </>
            )}
          </div>

          {listing.description && (
            <div className="mt-8">
              <h2 className="text-sm font-semibold text-coffee-900 mb-2">About this item</h2>
              <p className="text-coffee-700 whitespace-pre-line leading-relaxed">{listing.description}</p>
            </div>
          )}

          <div className="mt-8 rounded-2xl border border-coffee-200 bg-white p-5">
            <h2 className="text-sm font-semibold text-coffee-900 mb-3">How it works</h2>
            <ul className="space-y-3">
              {STEPS.map(({ icon: Icon, text }) => (
                <li key={text} className="flex gap-3 text-sm text-coffee-700">
                  <Icon className="w-4 h-4 mt-0.5 flex-shrink-0 text-coffee-500" />
                  {text}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
