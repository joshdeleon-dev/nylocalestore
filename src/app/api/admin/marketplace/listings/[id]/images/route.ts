import { NextRequest, NextResponse } from 'next/server';
import { requireRole, ADMIN_MANAGER } from '@/lib/apiAuth';
import {
  audit, db, loadListing, publishImages,
  IMAGE_TYPES, MAX_IMAGE_BYTES, MAX_IMAGES_PER_LISTING, PENDING_BUCKET, PUBLIC_BUCKET,
} from '@/lib/marketplaceServer';

type Params = { params: Promise<{ id: string }> };

// multipart/form-data with one or more `file` fields
export async function POST(req: NextRequest, { params }: Params) {
  const auth = await requireRole(req, ADMIN_MANAGER);
  if (auth instanceof NextResponse) return auth;

  const id = Number((await params).id);
  const listing = await loadListing(id);
  if (!listing) return NextResponse.json({ success: false, error: 'Listing not found' }, { status: 404 });

  const files = (await req.formData()).getAll('file').filter((f): f is File => f instanceof File);
  if (files.length === 0) return NextResponse.json({ success: false, error: 'No file provided' }, { status: 400 });
  if (listing.images.length + files.length > MAX_IMAGES_PER_LISTING) {
    return NextResponse.json({ success: false, error: `A listing can have at most ${MAX_IMAGES_PER_LISTING} photos` }, { status: 400 });
  }
  for (const f of files) {
    if (!IMAGE_TYPES[f.type]) return NextResponse.json({ success: false, error: `${f.name}: use JPG, PNG, WebP or HEIC` }, { status: 400 });
    if (f.size > MAX_IMAGE_BYTES) return NextResponse.json({ success: false, error: `${f.name}: photos must be 10 MB or smaller` }, { status: 400 });
  }

  let sortOrder = Math.max(-1, ...listing.images.map((i: any) => i.sort_order)) + 1;
  for (const f of files) {
    const path = `listings/${id}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${IMAGE_TYPES[f.type]}`;
    const { error: upErr } = await db.storage
      .from(PENDING_BUCKET)
      // Short CDN cache so photos of an unpublished listing stop loading within minutes
      .upload(path, new Uint8Array(await f.arrayBuffer()), { contentType: f.type, upsert: false, cacheControl: '300' });
    if (upErr) return NextResponse.json({ success: false, error: upErr.message }, { status: 500 });

    const { data: img, error } = await db
      .from('marketplace_listing_images')
      .insert({ listing_id: id, storage_path: path, sort_order: sortOrder++ })
      .select()
      .single();
    if (error) {
      await db.storage.from(PENDING_BUCKET).remove([path]);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
    await audit(auth.id, 'listing', id, 'add_photo', null, { image_id: img.id });
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
  const { order } = await req.json().catch(() => ({}));
  if (!Array.isArray(order)) return NextResponse.json({ success: false, error: 'order array required' }, { status: 400 });

  for (const [i, imageId] of order.entries()) {
    await db.from('marketplace_listing_images').update({ sort_order: i }).eq('id', Number(imageId)).eq('listing_id', id);
  }
  await audit(auth.id, 'listing', id, 'reorder_photos', null, { order });
  return NextResponse.json({ success: true, data: await loadListing(id) });
}
