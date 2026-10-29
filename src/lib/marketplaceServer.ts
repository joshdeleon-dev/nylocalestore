// Server-only marketplace helpers (service role). Never import from client components.

import { supabase, supabaseAdmin } from '@/lib/supabase';
import { slugify } from '@/lib/marketplace';
import { MarketplaceListingImage } from '@/types/marketplace';

export const db = supabaseAdmin ?? supabase;

export const PENDING_BUCKET = 'marketplace-pending';
export const PUBLIC_BUCKET = 'marketplace-public';
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_IMAGES_PER_LISTING = 10;
// HEIC is excluded because most browsers can't display it (iPhones convert to JPEG on upload)
export const IMAGE_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export interface UploadRequest { type: string; size: number }

// Vercel caps request bodies at 4.5 MB, so photos go from the browser straight to the
// private bucket using one-time signed upload URLs issued here.
export async function createUploadUrls(folder: string, files: UploadRequest[]) {
  for (const f of files) {
    if (!IMAGE_TYPES[f.type]) throw new UploadError('Photos must be JPG, PNG or WebP');
    if (!(f.size > 0) || f.size > MAX_IMAGE_BYTES) throw new UploadError('Each photo must be 10 MB or smaller');
  }
  return Promise.all(
    files.map(async (f) => {
      const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${IMAGE_TYPES[f.type]}`;
      const { data, error } = await db.storage.from(PENDING_BUCKET).createSignedUploadUrl(path);
      if (error) throw error;
      return { path, token: data.token };
    })
  );
}

// Only accept paths inside the expected folder that were actually uploaded
export async function verifyUploads(folder: string, paths: unknown): Promise<string[]> {
  if (!Array.isArray(paths) || paths.some((p) => typeof p !== 'string' || !p.startsWith(`${folder}/`) || p.includes('..'))) {
    throw new UploadError('Invalid photo reference');
  }
  if (paths.length === 0) return [];
  const { data } = await db.storage.from(PENDING_BUCKET).list(folder, { limit: 1000 });
  const present = new Set((data ?? []).map((o) => `${folder}/${o.name}`));
  const missing = paths.filter((p) => !present.has(p));
  if (missing.length) throw new UploadError('Some photos didn’t finish uploading — please try again');
  return paths as string[];
}

export class UploadError extends Error {}

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
