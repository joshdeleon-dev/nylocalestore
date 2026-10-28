-- Lock down tables that had row level security disabled.
-- Without RLS, the public anon key (shipped to every browser) could read AND write
-- these tables directly — e.g. renaming roles to grant admin access.
-- API routes use the service role key, which bypasses RLS, so they are unaffected.

-- True when the signed-in user is an active ADMIN
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM users u JOIN roles r ON r.id = u.role_id
    WHERE u.id = auth.uid() AND u.is_active AND r.name = 'ADMIN'
  );
$$;

ALTER TABLE announcements          ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories             ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_logs         ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations              ENABLE ROW LEVEL SECURITY;
ALTER TABLE modifier_groups        ENABLE ROW LEVEL SECURITY;
ALTER TABLE modifiers              ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_item_modifiers   ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items            ENABLE ROW LEVEL SECURITY;
ALTER TABLE permissions            ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_modifier_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings               ENABLE ROW LEVEL SECURITY;

-- Menu data the browser reads directly (storefront and dashboards)
CREATE POLICY "Public read categories"              ON categories              FOR SELECT USING (true);
CREATE POLICY "Public read locations"               ON locations               FOR SELECT USING (true);
CREATE POLICY "Public read modifier_groups"         ON modifier_groups         FOR SELECT USING (true);
CREATE POLICY "Public read modifiers"               ON modifiers               FOR SELECT USING (true);
CREATE POLICY "Public read product_modifier_groups" ON product_modifier_groups FOR SELECT USING (true);

-- Admin settings page updates store status/details directly from the browser
CREATE POLICY "Admins update locations" ON locations FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- All other access to these tables goes through the API (service role) only.
