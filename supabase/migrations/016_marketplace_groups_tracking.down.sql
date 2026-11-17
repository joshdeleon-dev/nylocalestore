-- Undo 016_marketplace_groups_tracking.sql (restores the migration 014 marketplace_reserve).

DROP FUNCTION IF EXISTS marketplace_reserve(INTEGER, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, SMALLINT, TEXT, INTEGER);

CREATE OR REPLACE FUNCTION marketplace_reserve(
  p_listing_id INTEGER,
  p_buyer_name TEXT, p_buyer_email TEXT, p_buyer_phone TEXT,
  p_email_norm TEXT, p_phone_norm TEXT,
  p_pickup_type TEXT, p_street TEXT, p_unit TEXT, p_city TEXT, p_state TEXT, p_zip TEXT,
  p_token_hash TEXT,
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
    pickup_type, pickup_street, pickup_unit, pickup_city, pickup_state, pickup_zip, token_hash
  ) VALUES (
    p_listing_id, p_buyer_name, p_buyer_email, p_buyer_phone, p_email_norm, p_phone_norm,
    p_pickup_type, p_street, p_unit, p_city, p_state, p_zip, p_token_hash
  ) RETURNING id INTO v_id;

  UPDATE marketplace_listings SET status = 'reserved', updated_at = now() WHERE id = p_listing_id;
  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION marketplace_reserve(INTEGER, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION marketplace_reserve(INTEGER, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER) TO service_role;

ALTER TABLE marketplace_listings DROP COLUMN IF EXISTS seller_token_hash;
ALTER TABLE marketplace_reservations
  DROP CONSTRAINT IF EXISTS buyer_group_or_reason,
  DROP COLUMN IF EXISTS buyer_group_number,
  DROP COLUMN IF EXISTS buyer_no_group_reason;
ALTER TABLE marketplace_sellers
  DROP CONSTRAINT IF EXISTS seller_group_or_reason,
  DROP COLUMN IF EXISTS group_number,
  DROP COLUMN IF EXISTS no_group_reason;
