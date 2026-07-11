-- Add original_stock to inventory table
-- This value is set once when the product is first created and never changes.
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS original_stock INT;

-- Backfill existing rows: original_stock = current_stock (best approximation for existing data)
UPDATE inventory SET original_stock = current_stock WHERE original_stock IS NULL;
