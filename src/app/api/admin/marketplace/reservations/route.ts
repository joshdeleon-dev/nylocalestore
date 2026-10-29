import { NextRequest, NextResponse } from 'next/server';
import { requireRole, ADMIN_MANAGER } from '@/lib/apiAuth';
import { OPEN_RESERVATION_STATUSES } from '@/lib/marketplace';
import { RESERVATION_SELECT, withReservationCovers, db } from '@/lib/marketplaceServer';

// ?view=open (default) | closed | all · ?listing_id=123
export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ADMIN_MANAGER);
  if (auth instanceof NextResponse) return auth;

  const url = new URL(req.url);
  const view = url.searchParams.get('view') ?? 'open';
  const listingId = Number(url.searchParams.get('listing_id')) || null;

  // Open reservations oldest first (longest-waiting at the top); closed ones newest first
  let query = db.from('marketplace_reservations').select(RESERVATION_SELECT).limit(500);
  if (view === 'open') query = query.in('status', OPEN_RESERVATION_STATUSES).order('created_at', { ascending: true });
  else if (view === 'closed') query = query.not('status', 'in', `(${OPEN_RESERVATION_STATUSES.join(',')})`).order('updated_at', { ascending: false });
  else query = query.order('created_at', { ascending: false });
  if (listingId) query = query.eq('listing_id', listingId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, data: await withReservationCovers(data ?? []) });
}
