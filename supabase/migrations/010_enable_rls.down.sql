-- Undo 010_enable_rls.sql (restores the previous, insecure state). Emergency use only.

DROP POLICY IF EXISTS "Admins update locations" ON locations;
DROP POLICY IF EXISTS "Public read categories" ON categories;
DROP POLICY IF EXISTS "Public read locations" ON locations;
DROP POLICY IF EXISTS "Public read modifier_groups" ON modifier_groups;
DROP POLICY IF EXISTS "Public read modifiers" ON modifiers;
DROP POLICY IF EXISTS "Public read product_modifier_groups" ON product_modifier_groups;

ALTER TABLE announcements          DISABLE ROW LEVEL SECURITY;
ALTER TABLE categories             DISABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_logs         DISABLE ROW LEVEL SECURITY;
ALTER TABLE locations              DISABLE ROW LEVEL SECURITY;
ALTER TABLE modifier_groups        DISABLE ROW LEVEL SECURITY;
ALTER TABLE modifiers              DISABLE ROW LEVEL SECURITY;
ALTER TABLE order_item_modifiers   DISABLE ROW LEVEL SECURITY;
ALTER TABLE order_items            DISABLE ROW LEVEL SECURITY;
ALTER TABLE permissions            DISABLE ROW LEVEL SECURITY;
ALTER TABLE product_modifier_groups DISABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions       DISABLE ROW LEVEL SECURITY;
ALTER TABLE roles                  DISABLE ROW LEVEL SECURITY;
ALTER TABLE settings               DISABLE ROW LEVEL SECURITY;

DROP FUNCTION IF EXISTS public.is_admin();
