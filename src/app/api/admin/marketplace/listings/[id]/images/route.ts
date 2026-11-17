import { NextRequest, NextResponse } from 'next/server';
import { requireRole, ADMIN_MANAGER } from '@/lib/apiAuth';
import {
  audit, createUploadUrls, db, loadListing, publishImages, verifyUploads, UploadError,
  MAX_IMAGES_PER_LISTING, PENDING_BUCKET, PUBLIC_BUCKET,
} from '@/lib/marketplaceServer';

type Params = { params: Promise<{ id: string }> };

// Two steps, because photos upload from the browser straight to storage:
//   { action: 'sign', files: [{ type, size }] }  → signed upload URLs
//   { action: 'attach', paths: [...] }           → add the uploaded photos to the listing
export async function POST(req: NextRequest, { params }: Params) {
  const auth = await requireRole(req, ADMIN_MANAGER);
  if (auth instanceof NextResponse) return auth;

  const id = Number((await params).id);
  const listing = await loadListing(id);
  if (!listing) return NextResponse.json({ success: false, error: 'Listing not found' }, { status: 404 });
  if (listing.archived_at) {
    return NextResponse.json({ success: false, error: 'Restore this item from the archive first' }, { status: 409 });
  }

  const body = await req.json().catch(() => ({}));
  const folder = `listings/${id}`;
  const count = body.action === 'sign' ? body.files?.length : body.paths?.length;
  if (!count) return NextResponse.json({ success: false, error: 'No photos provided' }, { status: 400 });
  if (listing.images.length + count > MAX_IMAGES_PER_LISTING) {
    return NextResponse.json({ success: false, error: `A listing can have at most ${MAX_IMAGES_PER_LISTING} photos` }, { status: 400 });
  }

  try {
    if (body.action === 'sign') {
      return NextResponse.json({ success: true, uploads: await createUploadUrls(folder, body.files) });
    }
    if (body.action !== 'attach') return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 });

    const paths = await verifyUploads(folder, body.paths);
    let sortOrder = Math.max(-1, ...listing.images.map((i: any) => i.sort_order)) + 1;
    const { data: rows, error } = await db
      .from('marketplace_listing_images')
      .insert(paths.map((p) => ({ listing_id: id, storage_path: p, sort_order: sortOrder++ })))
      .select('id');
    if (error) throw error;
    await audit(auth.id, 'listing', id, 'add_photo', null, { image_ids: rows.map((r) => r.id) });
  } catch (e: any) {
    const status = e instanceof UploadError ? 400 : 500;
    return NextResponse.json({ success: false, error: e.message }, { status });
  }

  // Photos added to an already-public listing go public straight away
  if (['published', 'reserved'].includes(listing.status)) await publishImages(id);

  return NextResponse.json({ success: true, data: await loadListing(id) }, { status: 201 });
}

// ?imageId=123
export async function DELETE(req: NextRequest, { params }: Params) {
  const auth = await requireRole(req, ADMIN_MANAGER);
  if (auth instanceof NextResponse) return auth;

  const id = Number((await params).id);
  const imageId = Number(new URL(req.url).searchParams.get('imageId'));
  const { data: img } = await db.from('marketplace_listing_images').select('*').eq('id', imageId).eq('listing_id', id).maybeSingle();
  if (!img) return NextResponse.json({ success: false, error: 'Photo not found' }, { status: 404 });

  const listing = await loadListing(id);
  if (listing?.archived_at) {
    return NextResponse.json({ success: false, error: 'Restore this item from the archive first' }, { status: 409 });
  }
  if (['published', 'reserved'].includes(listing?.status) && listing.images.length <= 1) {
    return NextResponse.json({ success: false, error: 'A live listing needs at least one photo' }, { status: 400 });
  }

  await db.storage.from(PENDING_BUCKET).remove([img.storage_path]);
  if (img.public_path) await db.storage.from(PUBLIC_BUCKET).remove([img.public_path]);
  await db.from('marketplace_listing_images').delete().eq('id', imageId);
  await audit(auth.id, 'listing', id, 'remove_photo', { image_id: imageId }, null);

  return NextResponse.json({ success: true, data: await loadListing(id) });
}

// Body: { order: [imageId, imageId, ...] } — first one is the cover photo
export async function PATCH(req: NextRequest, { params }: Params) {
  const auth = await requireRole(req, ADMIN_MANAGER);
  if (auth instanceof NextResponse) return auth;

  const id = Number((await params).id);
  const listing = await loadListing(id);
  if (listing?.archived_at) {
    return NextResponse.json({ success: false, error: 'Restore this item from the archive first' }, { status: 409 });
  }
  const { order } = await req.json().catch(() => ({}));
  if (!Array.isArray(order)) return NextResponse.json({ success: false, error: 'order array required' }, { status: 400 });

  for (const [i, imageId] of order.entries()) {
    await db.from('marketplace_listing_images').update({ sort_order: i }).eq('id', Number(imageId)).eq('listing_id', id);
  }
  await audit(auth.id, 'listing', id, 'reorder_photos', null, { order });
  return NextResponse.json({ success: true, data: await loadListing(id) });
}
