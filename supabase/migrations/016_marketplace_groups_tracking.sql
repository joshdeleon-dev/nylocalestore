-- Marketplace: group numbers for sellers and buyers, and the seller's private tracking link.
-- Group is 1–14, or "None" (stored as NULL group with a reason). Rows from before this
-- migration have neither and show as "Not set".
-- Undo with 016_marketplace_groups_tracking.down.sql.

ALTER TABLE marketplace_sellers
  ADD COLUMN group_number SMALLINT CHECK (group_number BETWEEN 1 AND 14),
  ADD COLUMN no_group_reason TEXT,
  ADD CONSTRAINT seller_group_or_reason CHECK (group_number IS NULL OR no_group_reason IS NULL);

ALTER TABLE marketplace_reservations
  ADD COLUMN buyer_group_number SMALLINT CHECK (buyer_group_number BETWEEN 1 AND 14),
  ADD COLUMN buyer_no_group_reason TEXT,
  ADD CONSTRAINT buyer_group_or_reason CHECK (buyer_group_number IS NULL OR buyer_no_group_reason IS NULL);

-- Only a SHA-256 hash of the seller's tracking token is stored (like reservations)
ALTER TABLE marketplace_listings ADD COLUMN seller_token_hash TEXT UNIQUE;

-- Same as migration 014, plus the buyer's group
DROP FUNCTION marketplace_reserve(INTEGER, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER);

CREATE OR REPLACE FUNCTION marketplace_reserve(
  p_listing_id INTEGER,
  p_buyer_name TEXT, p_buyer_email TEXT, p_buyer_phone TEXT,
  p_email_norm TEXT, p_phone_norm TEXT,
  p_pickup_type TEXT, p_street TEXT, p_unit TEXT, p_city TEXT, p_state TEXT, p_zip TEXT,
  p_token_hash TEXT,
  p_group_number SMALLINT DEFAULT NULL,
  p_no_group_reason TEXT DEFAULT NULL,
  p_max_open INTEGER DEFAULT 3
) RETURNS INTEGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_status TEXT;
  v_archived TIMESTAMPTZ;
  v_open INTEGER;
  v_id INTEGER;
BEGIN
  -- Serialize reservations for the same buyer so the limit can't be raced
  PERFORM pg_advisory_xact_lock(hashtext('mp-buyer-email:' || p_email_norm));
  PERFORM pg_advisory_xact_lock(hashtext('mp-buyer-phone:' || p_phone_norm));

  SELECT status, archived_at INTO v_status, v_archived FROM marketplace_listings WHERE id = p_listing_id FOR UPDATE;
  IF v_status IS DISTINCT FROM 'published' OR v_archived IS NOT NULL THEN
    RAISE EXCEPTION 'Listing is not available' USING ERRCODE = 'MP001';
  END IF;

  SELECT count(*) INTO v_open FROM marketplace_reservations
  WHERE status IN ('requested', 'confirmed') AND (buyer_email_norm = p_email_norm OR buyer_phone_norm = p_phone_norm);
  IF v_open >= p_max_open THEN
    RAISE EXCEPTION 'Buyer reservation limit reached' USING ERRCODE = 'MP002';
  END IF;

  INSERT INTO marketplace_reservations (
    listing_id, buyer_name, buyer_email, buyer_phone, buyer_email_norm, buyer_phone_norm,
    pickup_type, pickup_street, pickup_unit, pickup_city, pickup_state, pickup_zip, token_hash,
    buyer_group_number, buyer_no_group_reason
  ) VALUES (
    p_listing_id, p_buyer_name, p_buyer_email, p_buyer_phone, p_email_norm, p_phone_norm,
    p_pickup_type, p_street, p_unit, p_city, p_state, p_zip, p_token_hash,
    p_group_number, p_no_group_reason
  ) RETURNING id INTO v_id;

  UPDATE marketplace_listings SET status = 'reserved', updated_at = now() WHERE id = p_listing_id;
  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION marketplace_reserve(INTEGER, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, SMALLINT, TEXT, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION marketplace_reserve(INTEGER, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, SMALLINT, TEXT, INTEGER) TO service_role;
