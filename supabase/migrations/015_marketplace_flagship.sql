-- Marketplace: "100% for Flagship" mark.
-- is_flagship is derived: automatic at a 100% donation, or set manually by an admin on any item.
-- Undo with 015_marketplace_flagship.down.sql.

ALTER TABLE marketplace_listings
  ADD COLUMN flagship_manual BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN is_flagship BOOLEAN GENERATED ALWAYS AS (locale_percent = 100 OR flagship_manual) STORED;

CREATE INDEX idx_marketplace_listings_flagship ON marketplace_listings(published_at DESC) WHERE is_flagship;
