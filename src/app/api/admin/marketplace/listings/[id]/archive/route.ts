import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole, ADMIN_MANAGER } from '@/lib/apiAuth';
import { firstZodError } from '@/lib/marketplace';
import { audit, db, loadListing, publishImages, unpublishImages } from '@/lib/marketplaceServer';

type Params = { params: Promise<{ id: string }> };

const bodySchema = z.object({ archived: z.boolean() });

// Body: { archived: true | false }. Archived items are hidden from the public marketplace and
// work queues but stay in the dashboard (and in Reports, if sold). Restoring returns them as they were.
export async function POST(req: NextRequest, { params }: Params) {
  const auth = await requireRole(req, ADMIN_MANAGER);
  if (auth instanceof NextResponse) return auth;

  const id = Number((await params).id);
  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ success: false, error: firstZodError(parsed.error) }, { status: 400 });
  const { archived } = parsed.data;

  const before = await loadListing(id);
  if (!before) return NextResponse.json({ success: false, error: 'Listing not found' }, { status: 404 });
  if (Boolean(before.archived_at) === archived) {
    return NextResponse.json({ success: false, error: archived ? 'This item is already archived' : 'This item isn’t archived' }, { status: 409 });
  }

  try {
    if (archived) {
      // Conditional on status so this can't race with a buyer reserving the item
      const { data: changed, error } = await db
        .from('marketplace_listings')
        .update({ archived_at: new Date().toISOString(), archived_by: auth.id, updated_at: new Date().toISOString() })
        .eq('id', id)
        .is('archived_at', null)
        .not('status', 'in', '(reserved,paid)')
        .select('id');
      if (error) throw error;
      if (!changed?.length) {
        return NextResponse.json({ success: false, error: 'Items that are reserved or awaiting seller payout can’t be archived' }, { status: 409 });
      }
      await unpublishImages(id);
    } else {
      // A published item's photos go public before it reappears in the catalog
      if (before.status === 'published') await publishImages(id);
      const { error } = await db
        .from('marketplace_listings')
        .update({ archived_at: null, archived_by: null, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    }
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }

  await audit(auth.id, 'listing', id, archived ? 'archive' : 'restore', { status: before.status }, { status: before.status });
  return NextResponse.json({ success: true, data: await loadListing(id) });
}
