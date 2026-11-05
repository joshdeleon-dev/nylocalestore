import Link from 'next/link';
import { Coffee } from 'lucide-react';
import { Product } from '@/types';
import { formatCurrency } from '@/utils/helpers';

// Menu card styled like the marketplace ListingCard: square photo, price first.
// Sold-out items, and everything while ordering is paused, aren't clickable.
export function FoodCard({ product, orderingActive, featured = false }: { product: Product; orderingActive: boolean; featured?: boolean }) {
  const soldOut = product.current_stock === null || product.current_stock === 0;
  const disabled = soldOut || !orderingActive;

  const body = (
    <>
      <div className="relative aspect-square bg-coffee-100 overflow-hidden">
        {product.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.image_url}
            alt={product.name}
            loading="lazy"
            className={`absolute inset-0 w-full h-full object-cover transition-transform duration-300 ${disabled ? 'grayscale opacity-60' : 'group-hover:scale-[1.03]'}`}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-coffee-300"><Coffee className="w-8 h-8" /></div>
        )}
        {disabled ? (
          <span className="absolute top-3 left-3 rounded-full bg-coffee-900 text-white text-[11px] font-semibold uppercase tracking-wider px-3 py-1">
            {soldOut ? 'Sold out' : 'Unavailable'}
          </span>
        ) : featured ? (
          <span className="absolute top-3 left-3 rounded-full bg-white text-coffee-900 text-[11px] font-semibold uppercase tracking-wider px-3 py-1 shadow">
            Featured
          </span>
        ) : null}
      </div>
      <div className={`p-3 sm:p-4 ${disabled ? 'opacity-60' : ''}`}>
        <p className="font-semibold text-coffee-900">{formatCurrency(product.base_price)}</p>
        <h3 className="text-sm text-coffee-800 mt-0.5 line-clamp-2 leading-snug">{product.name}</h3>
        {product.description && <p className="text-xs text-coffee-500 mt-1.5 line-clamp-2">{product.description}</p>}
      </div>
    </>
  );

  const className = 'group block rounded-2xl bg-white border border-coffee-100 overflow-hidden transition-all';
  if (disabled) return <div className={`${className} cursor-default`} aria-disabled="true">{body}</div>;
  return (
    <Link href={`/product/${product.id}`} className={`${className} hover:shadow-lg hover:-translate-y-0.5 focus:outline-none focus-visible:ring-4 focus-visible:ring-coffee-300`}>
      {body}
    </Link>
  );
}
