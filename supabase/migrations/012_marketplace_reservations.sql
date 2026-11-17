-- Marketplace Phase 3: reservations.
-- Buyers reserve published items; the item shows as Reserved until an admin (or the buyer,
-- via their private link) releases it. Reservations never expire on their own.
-- Undo with 012_marketplace_reservations.down.sql.

CREATE TABLE marketplace_reservations (
  id                SERIAL PRIMARY KEY,
  listing_id        INTEGER NOT NULL REFERENCES marketplace_listings(id) ON DELETE CASCADE,

  -- Buyer details are admin-only; the *_norm columns power the per-buyer limit
  buyer_name        TEXT NOT NULL,
  buyer_email       TEXT NOT NULL,
  buyer_phone       TEXT NOT NULL,
  buyer_email_norm  TEXT NOT NULL,
  buyer_phone_norm  TEXT NOT NULL,

  pickup_type       TEXT NOT NULL CHECK (pickup_type IN ('locale', 'other')),
  pickup_street     TEXT,
  pickup_unit       TEXT,
  pickup_city       TEXT,
  pickup_state      TEXT,
  pickup_zip        TEXT,
  CONSTRAINT other_pickup_needs_address CHECK (
    pickup_type = 'locale'
    OR (pickup_street IS NOT NULL AND pickup_city IS NOT NULL AND pickup_state IS NOT NULL AND pickup_zip IS NOT NULL)
  ),

  status            TEXT NOT NULL DEFAULT 'requested' CHECK (
    status IN ('requested', 'confirmed', 'completed', 'canceled', 'no_show')
  ),
  canceled_by       TEXT CHECK (canceled_by IN ('buyer', 'admin')),
  cancel_reason     TEXT,
  admin_notes       TEXT,

  -- Only a SHA-256 hash of the buyer's private link token is stored
  token_hash        TEXT NOT NULL UNIQUE,

  confirmed_at      TIMESTAMPTZ,
  closed_at         TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- At most one open reservation per item, enforced by the database
CREATE UNIQUE INDEX one_open_reservation_per_listing
  ON marketplace_reservations(listing_id) WHERE status IN ('requested', 'confirmed');

CREATE INDEX idx_marketplace_reservations_status ON marketplace_reservations(status, created_at);
CREATE INDEX idx_marketplace_reservations_email ON marketplace_reservations(buyer_email_norm) WHERE status IN ('requested', 'confirmed');
CREATE INDEX idx_marketplace_reservations_phone ON marketplace_reservations(buyer_phone_norm) WHERE status IN ('requested', 'confirmed');

ALTER TABLE marketplace_reservations ENABLE ROW LEVEL SECURITY;

-- Reserve a published listing atomically. Raises:
--   MP001 listing not available · MP002 buyer already holds the maximum open reservations
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
  v_open INTEGER;
  v_id INTEGER;
BEGIN
  -- Serialize reservations for the same buyer so the limit can't be raced
  PERFORM pg_advisory_xact_lock(hashtext('mp-buyer-email:' || p_email_norm));
  PERFORM pg_advisory_xact_lock(hashtext('mp-buyer-phone:' || p_phone_norm));

  SELECT status INTO v_status FROM marketplace_listings WHERE id = p_listing_id FOR UPDATE;
  IF v_status IS DISTINCT FROM 'published' THEN
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

-- Move a reservation to a new status. Canceling or no-show puts the item back on sale.
-- Raises MP003 if the transition isn't allowed from the current status.
CREATE OR REPLACE FUNCTION marketplace_update_reservation(
  p_reservation_id INTEGER,
  p_status TEXT,
  p_canceled_by TEXT DEFAULT NULL,
  p_reason TEXT DEFAULT NULL
) RETURNS TEXT
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_current TEXT;
  v_listing INTEGER;
BEGIN
  SELECT status, listing_id INTO v_current, v_listing FROM marketplace_reservations WHERE id = p_reservation_id FOR UPDATE;
  IF v_current IS NULL THEN
    RAISE EXCEPTION 'Reservation not found' USING ERRCODE = 'MP004';
  END IF;

  IF NOT (
    (v_current = 'requested' AND p_status IN ('confirmed', 'completed', 'canceled', 'no_show'))
    OR (v_current = 'confirmed' AND p_status IN ('completed', 'canceled', 'no_show'))
  ) THEN
    RAISE EXCEPTION 'Cannot change reservation from % to %', v_current, p_status USING ERRCODE = 'MP003';
  END IF;

  UPDATE marketplace_reservations SET
    status = p_status,
    canceled_by = CASE WHEN p_status = 'canceled' THEN p_canceled_by ELSE canceled_by END,
    cancel_reason = CASE WHEN p_status IN ('canceled', 'no_show') THEN p_reason ELSE cancel_reason END,
    confirmed_at = CASE WHEN p_status = 'confirmed' THEN now() ELSE confirmed_at END,
    closed_at = CASE WHEN p_status IN ('completed', 'canceled', 'no_show') THEN now() ELSE closed_at END,
    updated_at = now()
  WHERE id = p_reservation_id;

  IF p_status IN ('canceled', 'no_show') THEN
    UPDATE marketplace_listings SET status = 'published', updated_at = now()
    WHERE id = v_listing AND status = 'reserved';
  END IF;

  RETURN p_status;
END;
$$;

-- Only the server (service role) may call these
REVOKE ALL ON FUNCTION marketplace_reserve(INTEGER, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION marketplace_update_reservation(INTEGER, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION marketplace_reserve(INTEGER, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION marketplace_update_reservation(INTEGER, TEXT, TEXT, TEXT) TO service_role;
