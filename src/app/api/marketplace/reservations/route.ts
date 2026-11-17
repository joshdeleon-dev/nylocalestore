import { NextRequest, NextResponse, after } from 'next/server';
import { adminRecipients, sendEmail } from '@/lib/email';
import { MAX_OPEN_RESERVATIONS, cleanGroup, firstZodError, formatPickup, normalizeEmail, normalizePhone, reservationSchema } from '@/lib/marketplace';
import { adminReservationEmail, buyerReservationEmail } from '@/lib/marketplaceEmails';
import { isMarketplaceEnabled } from '@/lib/marketplaceSite';
import { adminDashboardUrl, audit, db, marketplaceUrl, newReservationToken } from '@/lib/marketplaceServer';

// Public: reserve a published item. Emails the buyer a confirmation and returns the token for their private link.
export async function POST(req: NextRequest) {
  if (!isMarketplaceEnabled()) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });

  const parsed = reservationSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ success: false, error: firstZodError(parsed.error) }, { status: 400 });
  const r = parsed.data;
  const other = r.pickup_type === 'other';

  const { data: listing } = await db.from('marketplace_listings').select('id, title, asking_price_cents').eq('slug', r.slug).maybeSingle();
  if (!listing) return NextResponse.json({ success: false, error: 'This item is no longer available' }, { status: 404 });

  const { group, reason } = cleanGroup(r.buyer_group_number, r.buyer_no_group_reason);
  const { token, hash } = newReservationToken();
  const { data: reservationId, error } = await db.rpc('marketplace_reserve', {
    p_listing_id: listing.id,
    p_buyer_name: r.buyer_name,
    p_buyer_email: r.buyer_email,
    p_buyer_phone: r.buyer_phone,
    p_email_norm: normalizeEmail(r.buyer_email),
    p_phone_norm: normalizePhone(r.buyer_phone),
    p_pickup_type: r.pickup_type,
    p_street: other ? r.pickup_street : null,
    p_unit: other ? r.pickup_unit || null : null,
    p_city: other ? r.pickup_city : null,
    p_state: other ? r.pickup_state : null,
    p_zip: other ? r.pickup_zip : null,
    p_token_hash: hash,
    p_group_number: group,
    p_no_group_reason: reason,
    p_max_open: MAX_OPEN_RESERVATIONS,
  });

  if (error) {
    if (error.code === 'MP001' || error.code === '23505') {
      return NextResponse.json({ success: false, error: 'Sorry — someone just reserved this item.' }, { status: 409 });
    }
    if (error.code === 'MP002') {
      return NextResponse.json({
        success: false,
        error: `You already have ${MAX_OPEN_RESERVATIONS} items on hold. Please contact us to reserve more.`,
      }, { status: 409 });
    }
    console.error('Reservation failed:', error);
    return NextResponse.json({ success: false, error: 'Something went wrong — please try again' }, { status: 500 });
  }

  await audit(null, 'reservation', reservationId, 'reserve', null, { listing_id: listing.id, pickup_type: r.pickup_type });
  await audit(null, 'listing', listing.id, 'reserved', { status: 'published' }, { status: 'reserved', reservation_id: reservationId });

  // The price is read at reservation time; sent after the response so the buyer isn't kept waiting
  const email = buyerReservationEmail({
    to: r.buyer_email, name: r.buyer_name, reservationId, title: listing.title, priceCents: listing.asking_price_cents,
    pickup: formatPickup(r), group, noGroupReason: reason, reservationUrl: marketplaceUrl(req, `/reservation/${token}`),
  });
  const staff = adminRecipients();
  const alert = staff.length ? adminReservationEmail({
    to: staff, reservationId, title: listing.title, priceCents: listing.asking_price_cents,
    buyerName: r.buyer_name, buyerEmail: r.buyer_email, buyerPhone: r.buyer_phone, pickup: formatPickup(r),
    group, noGroupReason: reason, dashboardUrl: adminDashboardUrl(req),
  }) : null;
  after(async () => {
    const [sent] = await Promise.all([sendEmail(email), alert && sendEmail(alert)]);
    if (sent) await audit(null, 'reservation', reservationId, 'buyer_emailed', null, { type: 'reservation_confirmation' });
  });
  return NextResponse.json({ success: true, token }, { status: 201 });
}
