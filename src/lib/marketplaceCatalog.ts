// Public catalog queries (server only). Returns display fields only — never seller
// details, the For Locale donation, payout or admin notes.

import { db, publicImageUrl } from '@/lib/marketplaceServer';
import { ListingCondition } from '@/types/marketplace';

// Statuses the public can see. Reserved items stay visible (grayed out) until paid.
const VISIBLE_STATUSES = ['published', 'reserved'];

const PUBLIC_SELECT =
  'id, slug, title, description, condition, asking_price_cents, status, published_at, category:marketplace_categories(name, slug), images:marketplace_listing_images(public_path, sort_order)';

export interface PublicListing {
  id: number;
  slug: string;
  title: string;
  description: string;
  condition: ListingCondition;
  price_cents: number;
  is_reserved: boolean;
  published_at: string | null;
  category: { name: string; slug: string } | null;
  images: string[];
}

function toPublic(row: any): PublicListing {
  const images = [...(row.images ?? [])]
    .filter((i) => i.public_path)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((i) => publicImageUrl(i.public_path));
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    condition: row.condition,
    price_cents: row.asking_price_cents,
    is_reserved: row.status === 'reserved',
    published_at: row.published_at,
    category: row.category ?? null,
    images,
  };
}

export type CatalogSort = 'newest' | 'price_asc' | 'price_desc';
export const PAGE_SIZE = 24;

export async function getCatalog(opts: { q?: string; category?: string; sort?: CatalogSort; page?: number }) {
  const page = Math.max(1, opts.page ?? 1);
  let categoryId: number | null = null;
  if (opts.category) {
    const { data } = await db.from('marketplace_categories').select('id').eq('slug', opts.category).eq('is_active', true).maybeSingle();
    if (!data) return { listings: [] as PublicListing[], total: 0, page };
    categoryId = data.id;
  }

  let query = db.from('marketplace_listings').select(PUBLIC_SELECT, { count: 'exact' }).in('status', VISIBLE_STATUSES).is('archived_at', null);
  if (categoryId) query = query.eq('category_id', categoryId);
  const q = opts.q?.trim().replace(/[%_,()]/g, ' ');
  if (q) query = query.or(`title.ilike.%${q}%,description.ilike.%${q}%`);

  if (opts.sort === 'price_asc') query = query.order('asking_price_cents', { ascending: true });
  else if (opts.sort === 'price_desc') query = query.order('asking_price_cents', { ascending: false });
  else query = query.order('published_at', { ascending: false });

  const from = (page - 1) * PAGE_SIZE;
  const { data, count, error } = await query.order('id', { ascending: false }).range(from, from + PAGE_SIZE - 1);
  if (error) throw error;
  return { listings: (data ?? []).map(toPublic), total: count ?? 0, page };
}

export async function getPublicListing(slug: string): Promise<PublicListing | null> {
  const { data } = await db.from('marketplace_listings').select(PUBLIC_SELECT).eq('slug', slug).in('status', VISIBLE_STATUSES).is('archived_at', null).maybeSingle();
  return data ? toPublic(data) : null;
}

// Active categories that currently have something to show
export async function getCatalogCategories() {
  const { data } = await db
    .from('marketplace_categories')
    .select('id, name, slug, sort_order, listings:marketplace_listings(count)')
    .eq('is_active', true)
    .in('marketplace_listings.status', VISIBLE_STATUSES)
    .is('marketplace_listings.archived_at', null)
    .order('sort_order')
    .order('name');
  return (data ?? []).map((c: any) => ({ id: c.id, name: c.name, slug: c.slug, count: c.listings?.[0]?.count ?? 0 }));
}

// All active categories, for the seller form
export async function getActiveCategories() {
  const { data } = await db.from('marketplace_categories').select('id, name').eq('is_active', true).order('sort_order').order('name');
  return data ?? [];
}
