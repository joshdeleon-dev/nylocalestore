-- Marketplace Phase 1: categories, sellers, listings, images, audit log, storage buckets.
-- Everything is marketplace_-prefixed and isolated from the food tables.
-- RLS is on with no policies: all access goes through API routes (service role).
-- Undo with 011_marketplace_listings.down.sql.

CREATE TABLE marketplace_categories (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL UNIQUE,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seller contact details are admin-only and never exposed publicly
CREATE TABLE marketplace_sellers (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  email       TEXT NOT NULL,
  phone       TEXT NOT NULL,
  consent_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE marketplace_listings (
  id                  SERIAL PRIMARY KEY,
  seller_id           INTEGER NOT NULL REFERENCES marketplace_sellers(id),
  category_id         INTEGER REFERENCES marketplace_categories(id) ON DELETE SET NULL,
  title               TEXT NOT NULL,
  slug                TEXT NOT NULL UNIQUE,
  description         TEXT NOT NULL DEFAULT '',
  condition           TEXT NOT NULL CHECK (condition IN ('new', 'like_new', 'good', 'fair', 'poor')),

  -- Money: integer cents. For Locale and payout are derived so they always reconcile.
  asking_price_cents  INTEGER NOT NULL CHECK (asking_price_cents >= 0),
  locale_percent      NUMERIC(5, 2) NOT NULL DEFAULT 0 CHECK (locale_percent BETWEEN 0 AND 100),
  locale_amount_cents INTEGER GENERATED ALWAYS AS (round(asking_price_cents * locale_percent / 100)::integer) STORED,
  seller_payout_cents INTEGER GENERATED ALWAYS AS (asking_price_cents - round(asking_price_cents * locale_percent / 100)::integer) STORED,

  status              TEXT NOT NULL DEFAULT 'submitted' CHECK (
    status IN ('submitted', 'published', 'reserved', 'sold', 'rejected', 'withdrawn', 'unpublished')
  ),
  rejection_reason    TEXT,
  admin_notes         TEXT,
  reviewed_by         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at         TIMESTAMPTZ,
  published_at        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_marketplace_listings_status ON marketplace_listings(status);
CREATE INDEX idx_marketplace_listings_category ON marketplace_listings(category_id);
CREATE INDEX idx_marketplace_listings_seller ON marketplace_listings(seller_id);

-- Images live in the private marketplace-pending bucket until the listing is published,
-- then are copied to the public marketplace-public bucket.
CREATE TABLE marketplace_listing_images (
  id            SERIAL PRIMARY KEY,
  listing_id    INTEGER NOT NULL REFERENCES marketplace_listings(id) ON DELETE CASCADE,
  storage_path  TEXT NOT NULL,
  public_path   TEXT,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_marketplace_listing_images_listing ON marketplace_listing_images(listing_id, sort_order);

CREATE TABLE marketplace_audit_log (
  id           BIGSERIAL PRIMARY KEY,
  actor_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  entity_type  TEXT NOT NULL,
  entity_id    TEXT NOT NULL,
  action       TEXT NOT NULL,
  before_data  JSONB,
  after_data   JSONB,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_marketplace_audit_entity ON marketplace_audit_log(entity_type, entity_id, created_at);

ALTER TABLE marketplace_categories     ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_sellers        ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_listings       ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_listing_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_audit_log      ENABLE ROW LEVEL SECURITY;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES
  ('marketplace-pending', 'marketplace-pending', false, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']),
  ('marketplace-public',  'marketplace-public',  true,  10485760, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])
ON CONFLICT (id) DO NOTHING;

INSERT INTO marketplace_categories (name, slug, sort_order) VALUES
  ('Furniture', 'furniture', 1),
  ('Electronics', 'electronics', 2),
  ('Clothing & Accessories', 'clothing-accessories', 3),
  ('Home & Kitchen', 'home-kitchen', 4),
  ('Books & Media', 'books-media', 5),
  ('Kids & Baby', 'kids-baby', 6),
  ('Sports & Outdoors', 'sports-outdoors', 7),
  ('Other', 'other', 99);
