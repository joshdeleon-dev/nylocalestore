-- Undo 013_marketplace_sales.sql. Paid/sold items return to 'reserved' so the old status check holds.

DROP FUNCTION IF EXISTS marketplace_set_seller_paid(INTEGER, BOOLEAN, UUID);
DROP FUNCTION IF EXISTS marketplace_set_buyer_paid(INTEGER, BOOLEAN, UUID);
DROP TABLE IF EXISTS marketplace_sales;

UPDATE marketplace_listings SET status = 'reserved', updated_at = now() WHERE status = 'paid';

ALTER TABLE marketplace_listings DROP CONSTRAINT marketplace_listings_status_check;
ALTER TABLE marketplace_listings ADD CONSTRAINT marketplace_listings_status_check CHECK (
  status IN ('submitted', 'published', 'reserved', 'sold', 'rejected', 'withdrawn', 'unpublished')
);
