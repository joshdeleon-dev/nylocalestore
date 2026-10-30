import { NextRequest, NextResponse } from 'next/server';
import { requireRole, ADMIN_MANAGER } from '@/lib/apiAuth';
import { ACTION_RESULT, ALLOWED_ACTIONS, firstZodError, listingActionSchema } from '@/lib/marketplace';
import { audit, db, loadListing, publishImages, unpublishImages } from '@/lib/marketplaceServer';

type Params = { params: Promise<{ id: string }> };

// Body: { action: 'publish' | 'unpublish' | 'reject' | 'withdraw' | 'reopen', reason?: string }
export async function POST(req: NextRequest, { params }: Params) {
  const auth = await requireRole(req, ADMIN_MANAGER);
  if (auth instanceof NextResponse) return auth;

  const id = Number((await params).id);
  const parsed = listingActionSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ success: false, error: firstZodError(parsed.error) }, { status: 400 });
  const { action, reason } = parsed.data;

  const before = await loadListing(id);
  if (!before) return NextResponse.json({ success: false, error: 'Listing not found' }, { status: 404 });
  if (before.archived_at) {
    return NextResponse.json({ success: false, error: 'Restore this item from the archive first' }, { status: 409 });
  }
  if (!ALLOWED_ACTIONS[before.status as keyof typeof ALLOWED_ACTIONS]?.includes(action)) {
    return NextResponse.json({ success: false, error: `Can’t ${action} a listing that is ${before.status}` }, { status: 409 });
  }
  if (action === 'reject' && !reason) {
    return NextResponse.json({ success: false, error: 'A reason is required to reject a listing' }, { status: 400 });
  }
  if (action === 'publish' && (before.images?.length ?? 0) === 0) {
    return NextResponse.json({ success: false, error: 'Add at least one photo before publishing' }, { status: 400 });
  }

  const now = new Date().toISOString();
  const updates: Record<string, unknown> = { status: ACTION_RESULT[action], updated_at: now };
  if (action === 'publish') {
    updates.published_at = before.published_at ?? now;
    updates.reviewed_by = auth.id;
    updates.reviewed_at = now;
    updates.rejection_reason = null;
  }
  if (action === 'reject') {
    updates.rejection_reason = reason;
    updates.reviewed_by = auth.id;
    updates.reviewed_at = now;
  }
  if (action === 'reopen') updates.rejection_reason = null;

  if (action === 'release') {
    const { count } = await db
      .from('marketplace_reservations')
      .select('id', { count: 'exact', head: true })
      .eq('listing_id', id)
      .in('status', ['requested', 'confirmed']);
    if (count) {
      return NextResponse.json({ success: false, error: 'This item has an open reservation — cancel it from the Reservations tab' }, { status: 409 });
    }
  }

  try {
    // Images go public before the listing does, and leave public before it's hidden
    if (action === 'publish' || action === 'release') await publishImages(id);
    else await unpublishImages(id);
  } catch (e: any) {
    return NextResponse.json({ success: false, error: `Image update failed: ${e.message}` }, { status: 500 });
  }

  // Guard against a concurrent change: only update if the status is still what we checked
  const { data: changed, error } = await db
    .from('marketplace_listings')
    .update(updates)
    .eq('id', id)
    .eq('status', before.status)
    .select('id');
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  if (!changed?.length) return NextResponse.json({ success: false, error: 'Listing changed meanwhile — refresh and try again' }, { status: 409 });

  const after = await loadListing(id);
  await audit(auth.id, 'listing', id, action, { status: before.status }, { status: after.status, reason: reason ?? null });
  return NextResponse.json({ success: true, data: after });
}
