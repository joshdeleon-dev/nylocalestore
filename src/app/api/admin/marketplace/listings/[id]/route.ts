import { NextRequest, NextResponse } from 'next/server';
import { requireRole, ADMIN_MANAGER } from '@/lib/apiAuth';
import { firstZodError, updateListingSchema } from '@/lib/marketplace';
import { audit, db, loadListing, uniqueSlug } from '@/lib/marketplaceServer';

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const auth = await requireRole(req, ADMIN_MANAGER);
  if (auth instanceof NextResponse) return auth;

  const id = Number((await params).id);
  const listing = await loadListing(id);
  if (!listing) return NextResponse.json({ success: false, error: 'Listing not found' }, { status: 404 });

  const { data: history } = await db
    .from('marketplace_audit_log')
    .select('id, actor_id, action, before_data, after_data, created_at')
    .eq('entity_type', 'listing')
    .eq('entity_id', String(id))
    .order('created_at', { ascending: false })
    .limit(50);

  const actorIds = [...new Set((history ?? []).map((h) => h.actor_id).filter(Boolean))];
  const { data: actors } = actorIds.length
    ? await db.from('users').select('id, full_name').in('id', actorIds)
    : { data: [] as { id: string; full_name: string }[] };
  const names = new Map((actors ?? []).map((a) => [a.id, a.full_name]));

  return NextResponse.json({
    success: true,
    data: listing,
    history: (history ?? []).map((h) => ({ ...h, actor_name: h.actor_id ? names.get(h.actor_id) ?? null : null })),
  });
}

// Admins can edit any field, including the seller's price and donation %; changes are audited
export async function PATCH(req: NextRequest, { params }: Params) {
  const auth = await requireRole(req, ADMIN_MANAGER);
  if (auth instanceof NextResponse) return auth;

  const id = Number((await params).id);
  const parsed = updateListingSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ success: false, error: firstZodError(parsed.error) }, { status: 400 });
  const { seller, ...fields } = parsed.data;

  const before = await loadListing(id);
  if (!before) return NextResponse.json({ success: false, error: 'Listing not found' }, { status: 404 });
  // Paid items are locked to their sale snapshot; untick "Buyer has paid" to edit
  if (before.status === 'sold' || before.status === 'paid') {
    return NextResponse.json({ success: false, error: 'Paid and sold listings can’t be edited — untick “Buyer has paid” first' }, { status: 409 });
  }

  if (seller && Object.keys(seller).length) {
    const { error } = await db.from('marketplace_sellers').update({ ...seller, updated_at: new Date().toISOString() }).eq('id', before.seller_id);
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  const updates: Record<string, unknown> = { ...fields, updated_at: new Date().toISOString() };
  // Keep a published item's URL stable; only re-slug items the public hasn't seen yet
  if (fields.title && fields.title !== before.title && !before.published_at) {
    updates.slug = await uniqueSlug(fields.title, id);
  }

  const { error } = await db.from('marketplace_listings').update(updates).eq('id', id);
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  const after = await loadListing(id);
  const strip = (l: any) => ({ ...l, images: undefined });
  await audit(auth.id, 'listing', id, 'update', strip(before), strip(after));
  return NextResponse.json({ success: true, data: after });
}
