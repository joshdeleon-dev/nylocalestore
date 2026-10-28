// Server-only marketplace helpers (service role). Never import from client components.

import { supabase, supabaseAdmin } from '@/lib/supabase';
import { slugify } from '@/lib/marketplace';
import { MarketplaceListingImage } from '@/types/marketplace';

export const db = supabaseAdmin ?? supabase;

export const PENDING_BUCKET = 'marketplace-pending';
export const PUBLIC_BUCKET = 'marketplace-public';
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_IMAGES_PER_LISTING = 10;
export const IMAGE_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heif',
};

export async function audit(
  actorId: string | null,
  entityType: string,
  entityId: string | number,
  action: string,
  beforeData: unknown = null,
  afterData: unknown = null
) {
  const { error } = await db.from('marketplace_audit_log').insert({
    actor_id: actorId,
    entity_type: entityType,
    entity_id: String(entityId),
    action,
    before_data: beforeData,
    after_data: afterData,
  });
  if (error) console.error('Marketplace audit log failed:', error);
}

export async function uniqueSlug(title: string, excludeId?: number) {
  const base = slugify(title);
  for (let i = 0; i < 50; i++) {
    const candidate = i === 0 ? base : `${base}-${i + 1}`;
    let query = db.from('marketplace_listings').select('id').eq('slug', candidate);
    if (excludeId) query = query.neq('id', excludeId);
    const { data } = await query.maybeSingle();
    if (!data) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`;
}

const DETAIL_SELECT =
  '*, seller:marketplace_sellers(id, name, email, phone, consent_at), category:marketplace_categories(id, name), images:marketplace_listing_images(id, listing_id, storage_path, public_path, sort_order)';

// Full listing for admin views, images sorted and signed
export async function loadListing(id: number) {
  const { data } = await db.from('marketplace_listings').select(DETAIL_SELECT).eq('id', id).maybeSingle();
  if (!data) return null;
  const images = [...((data as any).images ?? [])].sort((a: any, b: any) => a.sort_order - b.sort_order || a.id - b.id);
  return { ...(data as any), images: await withSignedUrls(images) };
}

// Admin views see every image (signed URLs from the private bucket, valid for an hour)
export async function withSignedUrls(images: MarketplaceListingImage[]) {
  if (images.length === 0) return images;
  const { data } = await db.storage.from(PENDING_BUCKET).createSignedUrls(images.map((i) => i.storage_path), 3600);
  return images.map((img, i) => ({ ...img, url: data?.[i]?.signedUrl ?? undefined }));
}

export function publicImageUrl(publicPath: string) {
  return db.storage.from(PUBLIC_BUCKET).getPublicUrl(publicPath).data.publicUrl;
}

// Copy a listing's images into the public bucket (on publish)
export async function publishImages(listingId: number) {
  const { data: images } = await db
    .from('marketplace_listing_images')
    .select('id, storage_path, public_path')
    .eq('listing_id', listingId)
    .is('public_path', null);

  for (const img of images ?? []) {
    const { error } = await db.storage
      .from(PENDING_BUCKET)
      .copy(img.storage_path, img.storage_path, { destinationBucket: PUBLIC_BUCKET });
    if (error && !/exists/i.test(error.message)) throw error;
    await db.from('marketplace_listing_images').update({ public_path: img.storage_path }).eq('id', img.id);
  }
}

// Remove a listing's images from the public bucket (on unpublish / reject / withdraw)
export async function unpublishImages(listingId: number) {
  const { data: images } = await db
    .from('marketplace_listing_images')
    .select('id, public_path')
    .eq('listing_id', listingId)
    .not('public_path', 'is', null);
  if (!images?.length) return;

  await db.storage.from(PUBLIC_BUCKET).remove(images.map((i) => i.public_path as string));
  await db.from('marketplace_listing_images').update({ public_path: null }).in('id', images.map((i) => i.id));
}
