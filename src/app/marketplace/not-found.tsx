import Link from 'next/link';
import { headers } from 'next/headers';
import { PackageX } from 'lucide-react';
import { marketplaceBase } from '@/lib/marketplaceSite';

export default async function MarketplaceNotFound() {
  const base = marketplaceBase((await headers()).get('host'));
  return (
    <div className="max-w-md mx-auto px-5 py-24 text-center">
      <PackageX className="w-10 h-10 mx-auto text-coffee-300 mb-4" />
      <h1 className="font-serif text-2xl text-coffee-900">This item isn’t available</h1>
      <p className="text-sm text-coffee-500 mt-2">It may have been sold or taken down.</p>
      <Link href={base || '/'} className="btn btn-primary rounded-full px-6 mt-6">Browse the marketplace</Link>
    </div>
  );
}
