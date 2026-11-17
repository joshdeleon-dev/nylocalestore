-- Undo 015_marketplace_flagship.sql.

DROP INDEX IF EXISTS idx_marketplace_listings_flagship;
ALTER TABLE marketplace_listings DROP COLUMN IF EXISTS is_flagship, DROP COLUMN IF EXISTS flagship_manual;
