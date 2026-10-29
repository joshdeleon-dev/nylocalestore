import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { firstZodError, publicSubmissionSchema } from '@/lib/marketplace';
import { isMarketplaceEnabled } from '@/lib/marketplaceSite';
import {
  audit, createUploadUrls, db, uniqueSlug, verifyUploads, UploadError, MAX_IMAGES_PER_LISTING,
} from '@/lib/marketplaceServer';

// Public "Sell an item" endpoint, in two steps (photos upload straight to private storage):
//   { action: 'sign', files: [{ type, size }] }   → signed upload URLs in a fresh folder
//   { action: 'submit', ...fields, paths, consent } → creates the seller + listing as 'submitted'
export async function POST(req: NextRequest) {
  if (!isMarketplaceEnabled()) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });

  const body = await req.json().catch(() => ({}));

  try {
    if (body.action === 'sign') {
      const files = Array.isArray(body.files) ? body.files : [];
      if (files.length === 0 || files.length > MAX_IMAGES_PER_LISTING) {
        return NextResponse.json({ success: false, error: `Add between 1 and ${MAX_IMAGES_PER_LISTING} photos` }, { status: 400 });
      }
      return NextResponse.json({ success: true, uploads: await createUploadUrls(`submissions/${randomUUID()}`, files) });
    }

    if (body.action !== 'submit') return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 });

    const parsed = publicSubmissionSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ success: false, error: firstZodError(parsed.error) }, { status: 400 });
    const { seller, paths, consent: _consent, ...fields } = parsed.data;

    // All photos must come from one freshly issued submission folder
    const folder = paths[0].split('/').slice(0, 2).join('/');
    if (!/^submissions\/[0-9a-f-]{36}$/.test(folder)) throw new UploadError('Invalid photo reference');
    const { count: reused } = await db
      .from('marketplace_listing_images')
      .select('id', { count: 'exact', head: true })
      .like('storage_path', `${folder}/%`);
    if (reused) throw new UploadError('These photos were already submitted');
    await verifyUploads(folder, paths);

    if (fields.category_id) {
      const { data: cat } = await db.from('marketplace_categories').select('id').eq('id', fields.category_id).eq('is_active', true).maybeSingle();
      if (!cat) return NextResponse.json({ success: false, error: 'Please choose a valid category' }, { status: 400 });
    }

    const { data: sellerRow, error: sellerError } = await db
      .from('marketplace_sellers')
      .insert({ ...seller, consent_at: new Date().toISOString() })
      .select('id')
      .single();
    if (sellerError) throw sellerError;

    const { data: listing, error } = await db
      .from('marketplace_listings')
      .insert({ ...fields, seller_id: sellerRow.id, slug: await uniqueSlug(fields.title), status: 'submitted' })
      .select('id')
      .single();
    if (error) {
      await db.from('marketplace_sellers').delete().eq('id', sellerRow.id);
      throw error;
    }

    const { error: imgError } = await db
      .from('marketplace_listing_images')
      .insert(paths.map((p, i) => ({ listing_id: listing.id, storage_path: p, sort_order: i })));
    if (imgError) {
      await db.from('marketplace_listings').delete().eq('id', listing.id);
      await db.from('marketplace_sellers').delete().eq('id', sellerRow.id);
      throw imgError;
    }

    await audit(null, 'listing', listing.id, 'submit', null, { ...fields, image_count: paths.length });
    return NextResponse.json({ success: true, reference: listing.id }, { status: 201 });
  } catch (e: any) {
    if (e instanceof UploadError) return NextResponse.json({ success: false, error: e.message }, { status: 400 });
    console.error('Marketplace submission failed:', e);
    return NextResponse.json({ success: false, error: 'Something went wrong — please try again' }, { status: 500 });
  }
}
