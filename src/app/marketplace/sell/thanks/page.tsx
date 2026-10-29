import type { Metadata } from 'next';
import Link from 'next/link';
import { headers } from 'next/headers';
import { CheckCircle2 } from 'lucide-react';
import { marketplaceBase } from '@/lib/marketplaceSite';

export const metadata: Metadata = { title: 'Thanks for your submission' };

export default async function SellThanksPage({ searchParams }: { searchParams: Promise<{ ref?: string }> }) {
  const base = marketplaceBase((await headers()).get('host'));
  const ref = (await searchParams).ref?.replace(/\D/g, '');

  return (
    <div className="max-w-lg mx-auto px-5 py-20 text-center">
      <CheckCircle2 className="w-12 h-12 mx-auto text-coffee-700 mb-5" />
      <h1 className="font-serif text-3xl text-coffee-900">Thanks — we’ve got it!</h1>
      <p className="text-coffee-600 mt-3">
        Our team will review your item and reach out by phone or email. Once it’s approved, it will appear in the marketplace.
      </p>
      {ref && <p className="text-sm text-coffee-500 mt-4">Your reference number is <span className="font-semibold text-coffee-800">#{ref}</span></p>}
      <div className="flex flex-col sm:flex-row gap-3 justify-center mt-8">
        <Link href={`${base}/sell`} className="btn btn-outline rounded-full px-6">Sell another item</Link>
        <Link href={base || '/'} className="btn btn-primary rounded-full px-6">Browse the marketplace</Link>
      </div>
    </div>
  );
}
