import { NextRequest, NextResponse } from 'next/server';
import { requireRole, ADMIN_MANAGER } from '@/lib/apiAuth';
import { createListingSchema, firstZodError } from '@/lib/marketplace';
import { audit, db, uniqueSlug, withSignedUrls } from '@/lib/marketplaceServer';

const LIST_SELECT =
  '*, seller:marketplace_sellers(id, name, email, phone), category:marketplace_categories(id, name), images:marketplace_listing_images(id, listing_id, storage_path, public_path, sort_order)';

// ?status=submitted | ?status=published,unpublished | ?q=search | ?archived=1 (only archived items; hidden otherwise)
export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ADMIN_MANAGER);
  if (auth instanceof NextResponse) return auth;

  const url = new URL(req.url);
  const statuses = url.searchParams.get('status')?.split(',').filter(Boolean);
  const q = url.searchParams.get('q')?.trim();

  let query = db.from('marketplace_listings').select(LIST_SELECT).order('created_at', { ascending: false }).limit(500);
  if (statuses?.length) query = query.in('status', statuses);
  query = url.searchParams.get('archived') === '1' ? query.not('archived_at', 'is', null) : query.is('archived_at', null);
  if (q) query = query.ilike('title', `%${q.replace(/[%_]/g, '')}%`);

  const { data, error } = await query;
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  // Only the first image is needed for the list thumbnail
  const listings = await Promise.all(
    (data ?? []).map(async (l: any) => {
      const first = [...(l.images ?? [])].sort((a, b) => a.sort_order - b.sort_order || a.id - b.id).slice(0, 1);
      return { ...l, images: await withSignedUrls(first), image_count: l.images?.length ?? 0 };
    })
  );

  return NextResponse.json({ success: true, data: listings });
}

// Admin creates a listing on a seller's behalf (the public seller form arrives in Phase 2)
export async function POST(req: NextRequest) {
  const auth = await requireRole(req, ADMIN_MANAGER);
  if (auth instanceof NextResponse) return auth;

  const parsed = createListingSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ success: false, error: firstZodError(parsed.error) }, { status: 400 });
  const { seller, ...fields } = parsed.data;

  const { data: sellerRow, error: sellerError } = await db
    .from('marketplace_sellers')
    .insert({ ...seller, consent_at: new Date().toISOString() })
    .select()
    .single();
  if (sellerError) return NextResponse.json({ success: false, error: sellerError.message }, { status: 500 });

  const { data, error } = await db
    .from('marketplace_listings')
    .insert({ ...fields, seller_id: sellerRow.id, slug: await uniqueSlug(fields.title), status: 'submitted' })
    .select(LIST_SELECT)
    .single();
  if (error) {
    await db.from('marketplace_sellers').delete().eq('id', sellerRow.id);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  await audit(auth.id, 'listing', data.id, 'create', null, data);
  return NextResponse.json({ success: true, data }, { status: 201 });
}
