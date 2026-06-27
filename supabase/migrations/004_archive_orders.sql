-- Add is_archived flag to orders table
-- Archived orders are hidden from the Orders module UI but remain in all reports

ALTER TABLE orders ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT FALSE;

-- Index for fast filtering of non-archived orders (the common case)
CREATE INDEX IF NOT EXISTS idx_orders_is_archived ON orders (is_archived);
