// Marketplace types (mirrors supabase/migrations/011_marketplace_listings.sql)

export type ListingStatus =
  | 'submitted'
  | 'published'
  | 'reserved'
  | 'sold'
  | 'rejected'
  | 'withdrawn'
  | 'unpublished';

export type ListingCondition = 'new' | 'like_new' | 'good' | 'fair' | 'poor';

export type ListingAction = 'publish' | 'unpublish' | 'reject' | 'withdraw' | 'reopen';

export interface MarketplaceCategory {
  id: number;
  name: string;
  slug: string;
  sort_order: number;
  is_active: boolean;
  listing_count?: number;
}

export interface MarketplaceSeller {
  id: number;
  name: string;
  email: string;
  phone: string;
  consent_at: string | null;
}

export interface MarketplaceListingImage {
  id: number;
  listing_id: number;
  storage_path: string;
  public_path: string | null;
  sort_order: number;
  url?: string; // signed (admin) or public URL, added by the API
}

export interface MarketplaceListing {
  id: number;
  seller_id: number;
  category_id: number | null;
  title: string;
  slug: string;
  description: string;
  condition: ListingCondition;
  asking_price_cents: number;
  locale_percent: number;
  locale_amount_cents: number;
  seller_payout_cents: number;
  status: ListingStatus;
  rejection_reason: string | null;
  admin_notes: string | null;
  reviewed_at: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  seller?: MarketplaceSeller;
  category?: Pick<MarketplaceCategory, 'id' | 'name'> | null;
  images?: MarketplaceListingImage[];
}

export interface MarketplaceAuditEntry {
  id: number;
  actor_id: string | null;
  actor_name?: string | null;
  action: string;
  before_data: Record<string, unknown> | null;
  after_data: Record<string, unknown> | null;
  created_at: string;
}

export type ReservationStatus = 'requested' | 'confirmed' | 'completed' | 'canceled' | 'no_show';
export type PickupType = 'locale' | 'other';
export type ReservationAction = 'confirm' | 'complete' | 'cancel' | 'no_show';

export interface MarketplaceReservation {
  id: number;
  listing_id: number;
  buyer_name: string;
  buyer_email: string;
  buyer_phone: string;
  pickup_type: PickupType;
  pickup_street: string | null;
  pickup_unit: string | null;
  pickup_city: string | null;
  pickup_state: string | null;
  pickup_zip: string | null;
  status: ReservationStatus;
  canceled_by: 'buyer' | 'admin' | null;
  cancel_reason: string | null;
  admin_notes: string | null;
  confirmed_at: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
  listing?: Pick<MarketplaceListing, 'id' | 'title' | 'slug' | 'asking_price_cents' | 'status'> & { cover_url?: string | null };
}
