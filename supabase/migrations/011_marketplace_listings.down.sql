-- Undo 011_marketplace_listings.sql. Removes only marketplace objects; food tables are untouched.
-- Storage buckets must be emptied first (Supabase dashboard → Storage) or the bucket deletes fail.

DROP TABLE IF EXISTS marketplace_audit_log;
DROP TABLE IF EXISTS marketplace_listing_images;
DROP TABLE IF EXISTS marketplace_listings;
DROP TABLE IF EXISTS marketplace_sellers;
DROP TABLE IF EXISTS marketplace_categories;

DELETE FROM storage.buckets WHERE id IN ('marketplace-pending', 'marketplace-public');
