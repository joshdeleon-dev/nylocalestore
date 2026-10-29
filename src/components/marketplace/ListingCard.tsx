import Image from 'next/image';
import Link from 'next/link';
import { ImageOff } from 'lucide-react';
import { CONDITION_LABELS, formatCents } from '@/lib/marketplace';
import { PublicListing } from '@/lib/marketplaceCatalog';

export function ListingCard({ listing, base }: { listing: PublicListing; base: string }) {
  const cover = listing.images[0];

  return (
    <Link
      href={`${base}/item/${listing.slug}`}
      className="group block rounded-2xl bg-white border border-coffee-100 overflow-hidden hover:shadow-lg hover:-translate-y-0.5 transition-all focus:outline-none focus-visible:ring-4 focus-visible:ring-coffee-300"
    >
      <div className="relative aspect-square bg-coffee-100">
        {cover ? (
          <Image
            src={cover}
            alt={listing.title}
            fill
            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
            className={`object-cover transition-transform duration-300 group-hover:scale-[1.03] ${listing.is_reserved ? 'grayscale opacity-60' : ''}`}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-coffee-300"><ImageOff className="w-8 h-8" /></div>
        )}
        {listing.is_reserved && (
          <span className="absolute top-3 left-3 rounded-full bg-coffee-900 text-white text-[11px] font-semibold uppercase tracking-wider px-3 py-1">
            Reserved
          </span>
        )}
      </div>
      <div className={`p-3 sm:p-4 ${listing.is_reserved ? 'opacity-60' : ''}`}>
        <p className="font-semibold text-coffee-900">{formatCents(listing.price_cents)}</p>
        <h3 className="text-sm text-coffee-800 mt-0.5 line-clamp-2 leading-snug">{listing.title}</h3>
        <p className="text-xs text-coffee-500 mt-1.5">{CONDITION_LABELS[listing.condition]}{listing.category ? ` · ${listing.category.name}` : ''}</p>
      </div>
    </Link>
  );
}
