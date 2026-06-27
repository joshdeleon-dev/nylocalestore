-- Add is_archived flag to products table
-- Archived products are hidden from the product module UI and the customer storefront
-- but are still referenced in order history and included in all reports

ALTER TABLE products ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_products_is_archived ON products (is_archived);
