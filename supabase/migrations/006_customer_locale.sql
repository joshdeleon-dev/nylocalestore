-- Add customer_locale column to orders for "Other Locale" orders
-- group_number = 0 is the sentinel; customer_locale stores the locale name
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_locale TEXT;
