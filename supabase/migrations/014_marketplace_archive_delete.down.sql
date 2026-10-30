-- Undo 014_marketplace_archive_delete.sql. Deleted listings can't be brought back.
-- Restore marketplace_reserve by re-running its definition from 012_marketplace_reservations.sql.

DROP FUNCTION IF EXISTS marketplace_delete_listing(INTEGER, UUID);
DROP INDEX IF EXISTS idx_marketplace_listings_archived;
ALTER TABLE marketplace_listings DROP COLUMN IF EXISTS archived_by, DROP COLUMN IF EXISTS archived_at;
