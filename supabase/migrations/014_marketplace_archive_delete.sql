-- Marketplace: archive and permanent delete.
-- Archiving is a flag, not a status, so an item keeps its status and restores exactly as it was.
-- Undo with 014_marketplace_archive_delete.down.sql.

ALTER TABLE marketplace_listings
  ADD COLUMN archived_at TIMESTAMPTZ,
  ADD COLUMN archived_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX idx_marketplace_listings_archived ON marketplace_listings(archived_at);

-- Same as migration 012, plus: archived items can't be reserved
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
    pickup_type, pickup_street, pickup_unit, pickup_city, pickup_state, pickup_zip, token_hash
  ) VALUES (
    p_listing_id, p_buyer_name, p_buyer_email, p_buyer_phone, p_email_norm, p_phone_norm,
    p_pickup_type, p_street, p_unit, p_city, p_state, p_zip, p_token_hash
  ) RETURNING id INTO v_id;

  UPDATE marketplace_listings SET status = 'reserved', updated_at = now() WHERE id = p_listing_id;
  RETURN v_id;
END;
$$;

-- Permanently delete a listing with its images, reservations and sale, its seller if they have no
-- other listings, and its audit history (which holds personal details). Leaves one audit row with no
-- personal data. Returns the storage paths for the caller to remove. Raises:
--   MP008 not found · MP009 open reservation · MP010 buyer paid, seller still owed
CREATE OR REPLACE FUNCTION marketplace_delete_listing(p_listing_id INTEGER, p_actor UUID)
RETURNS TEXT[]
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_listing marketplace_listings%ROWTYPE;
  v_paths TEXT[];
BEGIN
  SELECT * INTO v_listing FROM marketplace_listings WHERE id = p_listing_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Listing not found' USING ERRCODE = 'MP008'; END IF;

  IF EXISTS (SELECT 1 FROM marketplace_reservations WHERE listing_id = p_listing_id AND status IN ('requested', 'confirmed')) THEN
    RAISE EXCEPTION 'This item has an open reservation — cancel it first' USING ERRCODE = 'MP009';
  END IF;
  IF v_listing.status = 'paid' THEN
    RAISE EXCEPTION 'The seller is still owed for this item — pay them or untick “Buyer has paid” first' USING ERRCODE = 'MP010';
  END IF;

  SELECT COALESCE(array_agg(storage_path), '{}') INTO v_paths FROM marketplace_listing_images WHERE listing_id = p_listing_id;

  DELETE FROM marketplace_audit_log
  WHERE (entity_type = 'listing' AND entity_id = p_listing_id::text)
     OR (entity_type = 'reservation' AND entity_id IN (SELECT id::text FROM marketplace_reservations WHERE listing_id = p_listing_id));

  -- Images, reservations and the sale cascade with the listing
  DELETE FROM marketplace_listings WHERE id = p_listing_id;

  DELETE FROM marketplace_sellers s
  WHERE s.id = v_listing.seller_id
    AND NOT EXISTS (SELECT 1 FROM marketplace_listings l WHERE l.seller_id = s.id);

  INSERT INTO marketplace_audit_log (actor_id, entity_type, entity_id, action, before_data)
  VALUES (p_actor, 'listing', p_listing_id::text, 'delete', jsonb_build_object(
    'title', v_listing.title, 'status', v_listing.status, 'asking_price_cents', v_listing.asking_price_cents
  ));

  RETURN v_paths;
END;
$$;

REVOKE ALL ON FUNCTION marketplace_delete_listing(INTEGER, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION marketplace_delete_listing(INTEGER, UUID) TO service_role;
