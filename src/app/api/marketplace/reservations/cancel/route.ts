import { NextRequest, NextResponse } from 'next/server';
import { isMarketplaceEnabled } from '@/lib/marketplaceSite';
import { audit, db, loadReservationByToken } from '@/lib/marketplaceServer';

// Public: the buyer cancels their own reservation from their private link; the item goes back on sale
export async function POST(req: NextRequest) {
  if (!isMarketplaceEnabled()) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });

  const { token } = await req.json().catch(() => ({}));
  const reservation = typeof token === 'string' ? await loadReservationByToken(token) : null;
  if (!reservation) return NextResponse.json({ success: false, error: 'Reservation not found' }, { status: 404 });

  const { error } = await db.rpc('marketplace_update_reservation', {
    p_reservation_id: reservation.id,
    p_status: 'canceled',
    p_canceled_by: 'buyer',
    p_reason: 'Canceled by buyer',
  });
  if (error) {
    if (error.code === 'MP003') return NextResponse.json({ success: false, error: 'This reservation can no longer be canceled online — please contact us.' }, { status: 409 });
    console.error('Buyer cancel failed:', error);
    return NextResponse.json({ success: false, error: 'Something went wrong — please try again' }, { status: 500 });
  }

  await audit(null, 'reservation', reservation.id, 'cancel', { status: reservation.status }, { status: 'canceled', canceled_by: 'buyer' });
  await audit(null, 'listing', reservation.listing_id, 'released', { status: 'reserved' }, { status: 'published', reason: 'buyer canceled' });
  return NextResponse.json({ success: true });
}
