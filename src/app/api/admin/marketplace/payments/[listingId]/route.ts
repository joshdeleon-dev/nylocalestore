import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole, ADMIN_MANAGER } from '@/lib/apiAuth';
import { firstZodError } from '@/lib/marketplace';
import { audit, db, loadPaymentRow, publishImages, unpublishImages } from '@/lib/marketplaceServer';

type Params = { params: Promise<{ listingId: string }> };

const bodySchema = z.object({ field: z.enum(['buyer_paid', 'seller_paid']), paid: z.boolean() });

export async function GET(req: NextRequest, { params }: Params) {
  const auth = await requireRole(req, ADMIN_MANAGER);
  if (auth instanceof NextResponse) return auth;
  const row = await loadPaymentRow(Number((await params).listingId));
  if (!row) return NextResponse.json({ success: false, error: 'Listing not found' }, { status: 404 });
  return NextResponse.json({ success: true, data: row });
}

// Tick or untick "Buyer has paid" / "Seller has been paid". Who and when are recorded automatically.
export async function POST(req: NextRequest, { params }: Params) {
  const auth = await requireRole(req, ADMIN_MANAGER);
  if (auth instanceof NextResponse) return auth;

  const listingId = Number((await params).listingId);
  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ success: false, error: firstZodError(parsed.error) }, { status: 400 });
  const { field, paid } = parsed.data;

  const before = await loadPaymentRow(listingId);
  if (!before) return NextResponse.json({ success: false, error: 'Listing not found' }, { status: 404 });

  const fn = field === 'buyer_paid' ? 'marketplace_set_buyer_paid' : 'marketplace_set_seller_paid';
  const { data: newStatus, error } = await db.rpc(fn, { p_listing_id: listingId, p_paid: paid, p_actor: auth.id });
  if (error) {
    const known = ['MP005', 'MP006', 'MP007'].includes(error.code ?? '');
    return NextResponse.json({ success: false, error: known ? error.message : 'Update failed' }, { status: known ? 409 : 500 });
  }

  // A paid item leaves the public catalog, so its photos leave the public bucket (and come back on untick)
  if (field === 'buyer_paid') {
    try {
      if (paid) await unpublishImages(listingId);
      else await publishImages(listingId);
    } catch (e) {
      console.error('Image visibility update failed:', e);
    }
  }

  const after = await loadPaymentRow(listingId);
  const snapshot = (row: any) => row?.sale && {
    sale_price_cents: row.sale.sale_price_cents,
    locale_amount_cents: row.sale.locale_amount_cents,
    seller_payout_cents: row.sale.seller_payout_cents,
  };
  await audit(
    auth.id, 'listing', listingId,
    `${field === 'buyer_paid' ? 'buyer' : 'seller'}_${paid ? 'paid' : 'unpaid'}`,
    { status: before.status, sale: snapshot(before) },
    { status: newStatus, sale: snapshot(after) }
  );

  return NextResponse.json({ success: true, data: after });
}
