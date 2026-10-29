-- Marketplace Phase 4: payments.
-- "Buyer has paid" creates a sale (with a snapshot of price / For Locale / payout) and moves
-- the listing to 'paid' (hidden from the public catalog). "Seller has been paid" marks it 'sold'.
-- Both can be unticked to correct mistakes; every change is audited by the API.
-- Undo with 013_marketplace_sales.down.sql.

-- New listing status between reserved and sold
ALTER TABLE marketplace_listings DROP CONSTRAINT marketplace_listings_status_check;
ALTER TABLE marketplace_listings ADD CONSTRAINT marketplace_listings_status_check CHECK (
  status IN ('submitted', 'published', 'reserved', 'paid', 'sold', 'rejected', 'withdrawn', 'unpublished')
);

CREATE TABLE marketplace_sales (
  id                   SERIAL PRIMARY KEY,
  listing_id           INTEGER NOT NULL REFERENCES marketplace_listings(id) ON DELETE CASCADE,
  reservation_id       INTEGER REFERENCES marketplace_reservations(id) ON DELETE SET NULL,

  -- Snapshot at the moment the buyer paid, so later listing edits can't change past sales
  sale_price_cents     INTEGER NOT NULL CHECK (sale_price_cents >= 0),
  locale_percent       NUMERIC(5, 2) NOT NULL CHECK (locale_percent BETWEEN 0 AND 100),
  locale_amount_cents  INTEGER NOT NULL CHECK (locale_amount_cents >= 0),
  seller_payout_cents  INTEGER NOT NULL CHECK (seller_payout_cents >= 0),
  CONSTRAINT sale_amounts_reconcile CHECK (locale_amount_cents + seller_payout_cents = sale_price_cents),

  buyer_paid_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  buyer_paid_by        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  seller_paid_at       TIMESTAMPTZ,
  seller_paid_by       UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One sale per listing: an item can never be sold twice
CREATE UNIQUE INDEX one_sale_per_listing ON marketplace_sales(listing_id);
CREATE INDEX idx_marketplace_sales_buyer_paid ON marketplace_sales(buyer_paid_at);
CREATE INDEX idx_marketplace_sales_seller_paid ON marketplace_sales(seller_paid_at);

ALTER TABLE marketplace_sales ENABLE ROW LEVEL SECURITY;

-- Errors: MP005 wrong listing state · MP006 no reservation to pay for · MP007 seller already paid

CREATE OR REPLACE FUNCTION marketplace_set_buyer_paid(p_listing_id INTEGER, p_paid BOOLEAN, p_actor UUID)
RETURNS TEXT
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_listing marketplace_listings%ROWTYPE;
  v_reservation INTEGER;
  v_sale marketplace_sales%ROWTYPE;
BEGIN
  SELECT * INTO v_listing FROM marketplace_listings WHERE id = p_listing_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Listing not found' USING ERRCODE = 'MP005'; END IF;

  IF p_paid THEN
    IF v_listing.status <> 'reserved' THEN
      RAISE EXCEPTION 'Only reserved items can be marked paid (item is %)', v_listing.status USING ERRCODE = 'MP005';
    END IF;
    SELECT id INTO v_reservation FROM marketplace_reservations
    WHERE listing_id = p_listing_id AND status IN ('requested', 'confirmed', 'completed')
    ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
    IF v_reservation IS NULL THEN
      RAISE EXCEPTION 'No reservation found for this item' USING ERRCODE = 'MP006';
    END IF;

    -- Paying at pickup completes the reservation
    UPDATE marketplace_reservations SET status = 'completed', closed_at = COALESCE(closed_at, now()), updated_at = now()
    WHERE id = v_reservation AND status IN ('requested', 'confirmed');

    INSERT INTO marketplace_sales (listing_id, reservation_id, sale_price_cents, locale_percent, locale_amount_cents, seller_payout_cents, buyer_paid_by)
    VALUES (p_listing_id, v_reservation, v_listing.asking_price_cents, v_listing.locale_percent, v_listing.locale_amount_cents, v_listing.seller_payout_cents, p_actor);

    UPDATE marketplace_listings SET status = 'paid', updated_at = now() WHERE id = p_listing_id;
    RETURN 'paid';
  END IF;

  -- Untick: only while the seller hasn't been paid
  IF v_listing.status <> 'paid' THEN
    RAISE EXCEPTION 'Buyer payment can only be unticked before the seller is paid (item is %)', v_listing.status USING ERRCODE = 'MP005';
  END IF;
  SELECT * INTO v_sale FROM marketplace_sales WHERE listing_id = p_listing_id FOR UPDATE;
  IF v_sale.seller_paid_at IS NOT NULL THEN
    RAISE EXCEPTION 'Untick "Seller has been paid" first' USING ERRCODE = 'MP007';
  END IF;
  DELETE FROM marketplace_sales WHERE listing_id = p_listing_id;
  UPDATE marketplace_listings SET status = 'reserved', updated_at = now() WHERE id = p_listing_id;
  RETURN 'reserved';
END;
$$;

CREATE OR REPLACE FUNCTION marketplace_set_seller_paid(p_listing_id INTEGER, p_paid BOOLEAN, p_actor UUID)
RETURNS TEXT
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_status TEXT;
BEGIN
  SELECT status INTO v_status FROM marketplace_listings WHERE id = p_listing_id FOR UPDATE;
  IF v_status IS NULL THEN RAISE EXCEPTION 'Listing not found' USING ERRCODE = 'MP005'; END IF;

  IF p_paid THEN
    IF v_status <> 'paid' THEN
      RAISE EXCEPTION 'Tick "Buyer has paid" first (item is %)', v_status USING ERRCODE = 'MP005';
    END IF;
    UPDATE marketplace_sales SET seller_paid_at = now(), seller_paid_by = p_actor, updated_at = now() WHERE listing_id = p_listing_id;
    UPDATE marketplace_listings SET status = 'sold', updated_at = now() WHERE id = p_listing_id;
    RETURN 'sold';
  END IF;

  IF v_status <> 'sold' THEN
    RAISE EXCEPTION 'Seller payment is not ticked (item is %)', v_status USING ERRCODE = 'MP005';
  END IF;
  UPDATE marketplace_sales SET seller_paid_at = NULL, seller_paid_by = NULL, updated_at = now() WHERE listing_id = p_listing_id;
  UPDATE marketplace_listings SET status = 'paid', updated_at = now() WHERE id = p_listing_id;
  RETURN 'paid';
END;
$$;

REVOKE ALL ON FUNCTION marketplace_set_buyer_paid(INTEGER, BOOLEAN, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION marketplace_set_seller_paid(INTEGER, BOOLEAN, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION marketplace_set_buyer_paid(INTEGER, BOOLEAN, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION marketplace_set_seller_paid(INTEGER, BOOLEAN, UUID) TO service_role;
