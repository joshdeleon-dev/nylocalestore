import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { SellForm } from '@/components/marketplace/SellForm';
import { getActiveCategories } from '@/lib/marketplaceCatalog';
import { marketplaceBase } from '@/lib/marketplaceSite';

export const metadata: Metadata = { title: 'Sell an item' };

export default async function SellPage() {
  const base = marketplaceBase((await headers()).get('host'));
  const categories = await getActiveCategories();

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-5 py-8 sm:py-12">
      <p className="text-xs font-semibold uppercase tracking-widest2 text-coffee-500 mb-2">Sell an item</p>
      <h1 className="font-serif text-4xl font-medium text-coffee-900 leading-tight">Give it a second home</h1>
      <p className="mt-3 text-coffee-600">
        Tell us about your item. We’ll review it, list it, and contact you when a buyer reserves it.
        Sales happen in person at the Locale.
      </p>
      <div className="mt-8 rounded-2xl bg-white border border-coffee-100 p-5 sm:p-8">
        <SellForm base={base} categories={categories} />
      </div>
    </div>
  );
}
