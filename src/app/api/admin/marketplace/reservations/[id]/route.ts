import { NextRequest, NextResponse } from 'next/server';
import { requireRole, ADMIN_MANAGER } from '@/lib/apiAuth';
import { RESERVATION_ACTION_RESULT, firstZodError, reservationActionSchema } from '@/lib/marketplace';
import { RESERVATION_SELECT, audit, db, withReservationCovers } from '@/lib/marketplaceServer';

type Params = { params: Promise<{ id: string }> };

async function load(id: number) {
  const { data } = await db.from('marketplace_reservations').select(RESERVATION_SELECT).eq('id', id).maybeSingle();
  return data ? (await withReservationCovers([data]))[0] : null;
}

// Body: { action?: 'confirm' | 'complete' | 'cancel' | 'no_show', reason?, admin_notes? }
export async function POST(req: NextRequest, { params }: Params) {
  const auth = await requireRole(req, ADMIN_MANAGER);
  if (auth instanceof NextResponse) return auth;

  const id = Number((await params).id);
  const parsed = reservationActionSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ success: false, error: firstZodError(parsed.error) }, { status: 400 });
  const { action, reason, admin_notes } = parsed.data;

  const before = await load(id);
  if (!before) return NextResponse.json({ success: false, error: 'Reservation not found' }, { status: 404 });

  if (admin_notes !== undefined && admin_notes !== before.admin_notes) {
    const { error } = await db.from('marketplace_reservations').update({ admin_notes, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    await audit(auth.id, 'reservation', id, 'notes', { admin_notes: before.admin_notes }, { admin_notes });
  }

  if (action) {
    const status = RESERVATION_ACTION_RESULT[action];
    const { error } = await db.rpc('marketplace_update_reservation', {
      p_reservation_id: id,
      p_status: status,
      p_canceled_by: action === 'cancel' ? 'admin' : null,
      p_reason: reason || null,
    });
    if (error) {
      const status409 = error.code === 'MP003';
      return NextResponse.json({ success: false, error: status409 ? `Can’t ${action.replace('_', '-')} a ${before.status} reservation` : error.message }, { status: status409 ? 409 : 500 });
    }
    await audit(auth.id, 'reservation', id, action, { status: before.status }, { status, reason: reason ?? null });
    if (status === 'canceled' || status === 'no_show') {
      await audit(auth.id, 'listing', before.listing_id, 'released', { status: 'reserved' }, { status: 'published', reason: action });
    }
  }

  return NextResponse.json({ success: true, data: await load(id) });
}
