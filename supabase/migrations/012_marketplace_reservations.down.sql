-- Undo 012_marketplace_reservations.sql. Reserved items go back on sale first.

UPDATE marketplace_listings SET status = 'published', updated_at = now()
WHERE status = 'reserved'
  AND id IN (SELECT listing_id FROM marketplace_reservations WHERE status IN ('requested', 'confirmed'));

DROP FUNCTION IF EXISTS marketplace_update_reservation(INTEGER, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS marketplace_reserve(INTEGER, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER);
DROP TABLE IF EXISTS marketplace_reservations;
