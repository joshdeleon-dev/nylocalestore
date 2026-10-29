import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { CheckCircle2, CircleDashed, Clock, MapPin, PackageCheck, XCircle } from 'lucide-react';
import { CancelReservationButton, CopyLinkButton } from '@/components/marketplace/ReservationActions';
import { OPEN_RESERVATION_STATUSES, formatCents, formatPickup } from '@/lib/marketplace';
import { loadReservationByToken } from '@/lib/marketplaceServer';
import { marketplaceBase } from '@/lib/marketplaceSite';
import { ReservationStatus } from '@/types/marketplace';

export const metadata: Metadata = { title: 'Your reservation', robots: { index: false, follow: false } };

const STATUS_COPY: Record<ReservationStatus, { icon: typeof Clock; title: string; body: string; tone: string }> = {
  requested: { icon: Clock, title: 'Reservation received', body: 'We’re holding this item for you. Our team will contact you by phone or email to arrange pickup.', tone: 'bg-amber-50 text-amber-900 border-amber-200' },
  confirmed: { icon: CheckCircle2, title: 'Reservation confirmed', body: 'Your reservation is confirmed. We’ll be in touch about the pickup details.', tone: 'bg-blue-50 text-blue-900 border-blue-200' },
  completed: { icon: PackageCheck, title: 'Picked up', body: 'This item has been handed over. Thank you for shopping the NY Locale Marketplace!', tone: 'bg-green-50 text-green-900 border-green-200' },
  canceled: { icon: XCircle, title: 'Reservation canceled', body: 'This reservation was canceled and the item is back on sale.', tone: 'bg-gray-50 text-gray-800 border-gray-200' },
  no_show: { icon: CircleDashed, title: 'Reservation closed', body: 'This reservation was closed because the pickup didn’t happen. Contact us if this is a mistake.', tone: 'bg-gray-50 text-gray-800 border-gray-200' },
};

export default async function ReservationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const reservation = await loadReservationByToken(token);
  if (!reservation) notFound();
  const base = marketplaceBase((await headers()).get('host'));
  const copy = STATUS_COPY[reservation.status as ReservationStatus];
  const isOpen = OPEN_RESERVATION_STATUSES.includes(reservation.status);
  const Icon = copy.icon;

  return (
    <div className="max-w-xl mx-auto px-4 sm:px-5 py-8 sm:py-12 space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest2 text-coffee-500 mb-2">Reservation #{reservation.id}</p>
        <h1 className="font-serif text-3xl sm:text-4xl text-coffee-900">Hi {reservation.buyer_name.split(' ')[0]}!</h1>
      </div>

      <div className={`rounded-2xl border p-5 flex gap-3 ${copy.tone}`}>
        <Icon className="w-5 h-5 flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold">{copy.title}</p>
          <p className="text-sm mt-1 opacity-90">{copy.body}</p>
        </div>
      </div>

      {reservation.listing && (
        <Link href={`${base}/item/${reservation.listing.slug}`} className="flex gap-4 rounded-2xl border border-coffee-100 bg-white p-4 hover:shadow-md transition-shadow">
          <div className="relative w-20 h-20 rounded-xl overflow-hidden bg-coffee-100 flex-shrink-0">
            {reservation.listing.cover_url && <Image src={reservation.listing.cover_url} alt="" fill sizes="80px" className="object-cover" />}
          </div>
          <div className="min-w-0">
            <p className="font-medium text-coffee-900">{reservation.listing.title}</p>
            <p className="text-coffee-700 mt-0.5">{formatCents(reservation.listing.price_cents)}</p>
            <p className="text-xs text-coffee-500 mt-1">Pay at pickup · no online payment</p>
          </div>
        </Link>
      )}

      <div className="rounded-2xl border border-coffee-100 bg-white p-5 space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wider text-coffee-500">Pickup</p>
        <p className="flex items-start gap-2 text-coffee-900"><MapPin className="w-4 h-4 mt-1 flex-shrink-0" /> {formatPickup(reservation)}</p>
        <p className="text-xs text-coffee-500">Reserved {new Date(reservation.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
      </div>

      {isOpen && (
        <div className="space-y-4">
          <div className="rounded-2xl bg-coffee-100/70 p-5 space-y-3">
            <p className="text-sm text-coffee-800"><span className="font-semibold">Save this page.</span> It’s your private link to check on or cancel this reservation.</p>
            <CopyLinkButton />
          </div>
          <CancelReservationButton token={token} />
        </div>
      )}

      <Link href={base || '/'} className="inline-block text-sm text-coffee-600 hover:text-coffee-900">← Back to the marketplace</Link>
    </div>
  );
}
