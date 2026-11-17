import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { Banknote, CheckCircle2, Circle, Clock, EyeOff, PackageCheck, ShoppingBag, Tag, XCircle } from 'lucide-react';
import { CopyLinkButton } from '@/components/marketplace/ReservationActions';
import { formatCents } from '@/lib/marketplace';
import { loadListingByTrackingToken } from '@/lib/marketplaceServer';
import { marketplaceBase } from '@/lib/marketplaceSite';
import { ListingStatus } from '@/types/marketplace';

export const metadata: Metadata = { title: 'Track your item', robots: { index: false, follow: false } };

// What the seller sees for each listing status (admin-only notes and buyer details are never shown)
const STATUS_COPY: Record<ListingStatus, { icon: typeof Clock; title: string; body: string; tone: string }> = {
  submitted: { icon: Clock, title: 'Waiting for review', body: 'We’ve received your item. Our team will review it and may contact you with questions.', tone: 'bg-amber-50 text-amber-900 border-amber-200' },
  published: { icon: Tag, title: 'Approved and for sale', body: 'Your item is live in the marketplace. We’ll update this page when a buyer reserves it.', tone: 'bg-green-50 text-green-900 border-green-200' },
  reserved: { icon: ShoppingBag, title: 'Reserved by a buyer', body: 'A buyer has reserved your item and will pay at pickup. If the sale falls through, it goes back on sale.', tone: 'bg-blue-50 text-blue-900 border-blue-200' },
  paid: { icon: PackageCheck, title: 'Sold', body: 'The buyer has paid. We’ll arrange your payout and update this page once you’ve been paid.', tone: 'bg-purple-50 text-purple-900 border-purple-200' },
  sold: { icon: Banknote, title: 'Sold and paid', body: 'Your item sold and your payout has been sent. Thank you for supporting the locale!', tone: 'bg-green-50 text-green-900 border-green-200' },
  unpublished: { icon: EyeOff, title: 'Not currently listed', body: 'Your item has been taken off the marketplace for now. Contact us if you have questions.', tone: 'bg-gray-50 text-gray-800 border-gray-200' },
  rejected: { icon: XCircle, title: 'Not approved', body: 'We weren’t able to list this item. Contact us at the Locale if you’d like to know more.', tone: 'bg-gray-50 text-gray-800 border-gray-200' },
  withdrawn: { icon: XCircle, title: 'Withdrawn', body: 'This item has been withdrawn from the marketplace.', tone: 'bg-gray-50 text-gray-800 border-gray-200' },
};

const fmtDate = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'America/New_York' }) : null;

export default async function TrackItemPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const item = await loadListingByTrackingToken(token);
  if (!item) notFound();
  const base = marketplaceBase((await headers()).get('host'));
  const status = item.status as ListingStatus;
  const copy = STATUS_COPY[status];
  const Icon = copy.icon;
  const sale = item.sale;
  const wasApproved = !!item.published_at || ['published', 'reserved', 'paid', 'sold'].includes(status);
  const stopped = ['rejected', 'withdrawn'].includes(status);

  const steps = [
    { label: 'Submitted', done: true, date: fmtDate(item.created_at) },
    { label: 'Approved', done: wasApproved, date: wasApproved ? fmtDate(item.published_at) : null },
    { label: 'Sold', done: !!sale, date: fmtDate(sale?.buyer_paid_at) },
    { label: 'You’ve been paid', done: !!sale?.seller_paid_at, date: fmtDate(sale?.seller_paid_at) },
  ];

  const price = sale?.sale_price_cents ?? item.asking_price_cents;
  const locale = sale?.locale_amount_cents ?? item.locale_amount_cents;
  const payout = sale?.seller_payout_cents ?? item.seller_payout_cents;

  return (
    <div className="max-w-xl mx-auto px-4 sm:px-5 py-8 sm:py-12 space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest2 text-coffee-500 mb-2">Item #{item.id}</p>
        <h1 className="font-serif text-3xl sm:text-4xl text-coffee-900">Hi {item.seller_name.split(' ')[0] || 'there'}!</h1>
      </div>

      <div className={`rounded-2xl border p-5 flex gap-3 ${copy.tone}`}>
        <Icon className="w-5 h-5 flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold">{copy.title}</p>
          <p className="text-sm mt-1 opacity-90">{copy.body}</p>
        </div>
      </div>

      <div className="flex gap-4 rounded-2xl border border-coffee-100 bg-white p-4">
        <div className="relative w-20 h-20 rounded-xl overflow-hidden bg-coffee-100 flex-shrink-0">
          {item.cover_url && <Image src={item.cover_url} alt="" fill sizes="80px" className="object-cover" unoptimized />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-medium text-coffee-900">{item.title}</p>
          {status === 'published' && (
            <Link href={`${base}/item/${item.slug}`} className="text-xs text-coffee-600 underline hover:text-coffee-900">See it in the marketplace</Link>
          )}
          <dl className="grid grid-cols-3 gap-2 mt-3 text-sm">
            <div><dt className="text-xs text-coffee-500">{sale ? 'Sold for' : 'Your price'}</dt><dd className="font-semibold text-coffee-900">{formatCents(price)}</dd></div>
            <div><dt className="text-xs text-coffee-500">For Locale ({Number(item.locale_percent)}%)</dt><dd className="font-semibold text-coffee-900">{formatCents(locale)}</dd></div>
            <div><dt className="text-xs text-coffee-500">{sale?.seller_paid_at ? 'Paid to you' : 'You’ll receive'}</dt><dd className="font-semibold text-coffee-900">{formatCents(payout)}</dd></div>
          </dl>
        </div>
      </div>

      {!stopped && (
        <ol className="rounded-2xl border border-coffee-100 bg-white p-5 space-y-4" aria-label="Progress">
          {steps.map((s) => (
            <li key={s.label} className="flex items-start gap-3">
              {s.done ? <CheckCircle2 className="w-5 h-5 text-coffee-900 flex-shrink-0" /> : <Circle className="w-5 h-5 text-coffee-300 flex-shrink-0" />}
              <div>
                <p className={s.done ? 'font-medium text-coffee-900' : 'text-coffee-400'}>{s.label}</p>
                {s.done && s.date && <p className="text-xs text-coffee-500">{s.date}</p>}
              </div>
            </li>
          ))}
        </ol>
      )}

      <div className="rounded-2xl bg-coffee-100/70 p-5 space-y-3">
        <p className="text-sm text-coffee-800"><span className="font-semibold">Save this page.</span> It’s your private link to check on this item. We also emailed it to you.</p>
        <CopyLinkButton />
      </div>

      <Link href={base || '/'} className="inline-block text-sm text-coffee-600 hover:text-coffee-900">← Back to the marketplace</Link>
    </div>
  );
}
