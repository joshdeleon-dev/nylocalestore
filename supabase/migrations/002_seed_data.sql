-- NY Locale Store - Seed Data
-- Insert initial roles, permissions, categories, products, and modifiers

-- ============================================================================
-- INSERT ROLES
-- ============================================================================

INSERT INTO roles (name, description) VALUES
  ('ADMIN', 'Full system access'),
  ('MANAGER', 'Store management - orders, inventory, products, reports'),
  ('BARISTA', 'Barista dashboard - orders, order status, sticker printing'),
  ('CASHIER', 'Cashier dashboard - orders, payment status, completion'),
  ('CUSTOMER', 'Customer ordering app - place orders only')
ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- INSERT PERMISSIONS
-- ============================================================================

INSERT INTO permissions (name, description, resource, action) VALUES
  -- Admin permissions
  ('admin:full_access', 'Full system access', 'admin', 'all'),
  
  -- Orders permissions
  ('orders:view', 'View orders', 'orders', 'read'),
  ('orders:create', 'Create orders', 'orders', 'create'),
  ('orders:update', 'Update orders', 'orders', 'update'),
  ('orders:cancel', 'Cancel orders', 'orders', 'delete'),
  
  -- Inventory permissions
  ('inventory:view', 'View inventory', 'inventory', 'read'),
  ('inventory:adjust', 'Adjust inventory', 'inventory', 'update'),
  ('inventory:view_reports', 'View inventory reports', 'inventory', 'report'),
  
  -- Products permissions
  ('products:view', 'View products', 'products', 'read'),
  ('products:create', 'Create products', 'products', 'create'),
  ('products:update', 'Update products', 'products', 'update'),
  ('products:delete', 'Delete products', 'products', 'delete'),
  
  -- Reports permissions
  ('reports:view', 'View reports', 'reports', 'read'),
  ('reports:create_custom', 'Create custom reports', 'reports', 'create'),
  ('reports:export', 'Export reports', 'reports', 'export'),
  
  -- Users permissions
  ('users:manage', 'Manage users', 'users', 'manage'),
  
  -- Sticker printing permissions
  ('sticker:print', 'Print order stickers', 'sticker', 'print'),
  
  -- Audit logs permissions
  ('audit:view', 'View audit logs', 'audit', 'read')
ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- ASSIGN PERMISSIONS TO ROLES
-- ============================================================================

-- Admin gets all permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p 
WHERE r.name = 'ADMIN'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Manager permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT 
  (SELECT id FROM roles WHERE name = 'MANAGER'),
  id
FROM permissions 
WHERE name IN (
  'orders:view', 'orders:create', 'orders:update', 'orders:cancel',
  'inventory:view', 'inventory:adjust', 'inventory:view_reports',
  'products:view', 'products:create', 'products:update', 'products:delete',
  'reports:view', 'reports:create_custom', 'reports:export',
  'audit:view'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Barista permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT 
  (SELECT id FROM roles WHERE name = 'BARISTA'),
  id
FROM permissions 
WHERE name IN (
  'orders:view', 'orders:update',
  'sticker:print',
  'audit:view'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Cashier permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT 
  (SELECT id FROM roles WHERE name = 'CASHIER'),
  id
FROM permissions 
WHERE name IN (
  'orders:view', 'orders:update',
  'audit:view'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Customer permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT 
  (SELECT id FROM roles WHERE name = 'CUSTOMER'),
  id
FROM permissions 
WHERE name IN (
  'orders:view', 'orders:create'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- ============================================================================
-- INSERT LOCATIONS
-- ============================================================================

INSERT INTO locations (name, address, phone, tax_rate) VALUES
  ('NY Locale Store - Downtown', '123 Main St, New York, NY 10001', '(212) 555-0100', 0.0875),
  ('NY Locale Store - Uptown', '456 Park Ave, New York, NY 10022', '(212) 555-0200', 0.0875),
  ('NY Locale Store - Brooklyn', '789 Flatbush Ave, Brooklyn, NY 11201', '(718) 555-0300', 0.0875)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- INSERT CATEGORIES
-- ============================================================================

INSERT INTO categories (name, description, display_order, is_active) VALUES
  ('Espresso Drinks', 'Espresso-based beverages', 1, true),
  ('Cold Brew', 'Cold coffee drinks', 2, true),
  ('Tea', 'Hot and cold tea options', 3, true),
  ('Pastries', 'Baked goods and pastries', 4, true),
  ('Sandwiches', 'Breakfast and lunch sandwiches', 5, true),
  ('Salads', 'Fresh salads and bowls', 6, true),
  ('Breakfast', 'Breakfast items', 7, true),
  ('Add-ons', 'Extra shots, syrups, and more', 8, true)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- INSERT PRODUCTS - ESPRESSO DRINKS
-- ============================================================================

INSERT INTO products (name, description, category_id, base_price, is_available, display_order) VALUES
  ('Espresso', 'Single or double shot', (SELECT id FROM categories WHERE name = 'Espresso Drinks'), 2.95, true, 1),
  ('Americano', 'Espresso with hot water', (SELECT id FROM categories WHERE name = 'Espresso Drinks'), 3.45, true, 2),
  ('Macchiato', 'Espresso marked with milk foam', (SELECT id FROM categories WHERE name = 'Espresso Drinks'), 3.95, true, 3),
  ('Cappuccino', 'Espresso with steamed milk and foam', (SELECT id FROM categories WHERE name = 'Espresso Drinks'), 4.45, true, 4),
  ('Latte', 'Espresso with steamed milk', (SELECT id FROM categories WHERE name = 'Espresso Drinks'), 4.45, true, 5),
  ('Flat White', 'Espresso with velvety milk', (SELECT id FROM categories WHERE name = 'Espresso Drinks'), 4.95, true, 6),
  ('Mocha', 'Espresso with chocolate and milk', (SELECT id FROM categories WHERE name = 'Espresso Drinks'), 4.95, true, 7),
  ('Cortado', 'Equal parts espresso and steamed milk', (SELECT id FROM categories WHERE name = 'Espresso Drinks'), 3.95, true, 8)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- INSERT PRODUCTS - COLD BREW
-- ============================================================================

INSERT INTO products (name, description, category_id, base_price, is_available, display_order) VALUES
  ('Cold Brew', 'Smooth cold brewed coffee', (SELECT id FROM categories WHERE name = 'Cold Brew'), 3.95, true, 1),
  ('Iced Latte', 'Cold brew with milk and ice', (SELECT id FROM categories WHERE name = 'Cold Brew'), 4.45, true, 2),
  ('Iced Cappuccino', 'Cold espresso with milk and ice', (SELECT id FROM categories WHERE name = 'Cold Brew'), 4.45, true, 3),
  ('Iced Americano', 'Cold espresso with water and ice', (SELECT id FROM categories WHERE name = 'Cold Brew'), 3.95, true, 4),
  ('Iced Mocha', 'Cold espresso with chocolate and milk', (SELECT id FROM categories WHERE name = 'Cold Brew'), 4.95, true, 5)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- INSERT PRODUCTS - TEA
-- ============================================================================

INSERT INTO products (name, description, category_id, base_price, is_available, display_order) VALUES
  ('Hot Tea', 'Selection of premium hot teas', (SELECT id FROM categories WHERE name = 'Tea'), 2.95, true, 1),
  ('Iced Tea', 'Refreshing iced tea options', (SELECT id FROM categories WHERE name = 'Tea'), 3.45, true, 2),
  ('Chai Latte', 'Spiced chai with steamed milk', (SELECT id FROM categories WHERE name = 'Tea'), 4.45, true, 3),
  ('Matcha Latte', 'Powdered green tea with milk', (SELECT id FROM categories WHERE name = 'Tea'), 4.95, true, 4)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- INSERT PRODUCTS - PASTRIES
-- ============================================================================

INSERT INTO products (name, description, category_id, base_price, is_available, display_order) VALUES
  ('Croissant', 'Buttery French croissant', (SELECT id FROM categories WHERE name = 'Pastries'), 3.95, true, 1),
  ('Blueberry Muffin', 'Fresh blueberry muffin', (SELECT id FROM categories WHERE name = 'Pastries'), 3.45, true, 2),
  ('Chocolate Croissant', 'Croissant with dark chocolate', (SELECT id FROM categories WHERE name = 'Pastries'), 4.45, true, 3),
  ('Bagel', 'Fresh bagel with cream cheese', (SELECT id FROM categories WHERE name = 'Pastries'), 3.95, true, 4),
  ('Cookie', 'Chocolate chip or oatmeal raisin', (SELECT id FROM categories WHERE name = 'Pastries'), 2.95, true, 5)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- INSERT MODIFIER GROUPS & MODIFIERS
-- ============================================================================

-- Size modifier group
INSERT INTO modifier_groups (name, is_required, min_selection, max_selection) VALUES
  ('Size', true, 1, 1)
ON CONFLICT DO NOTHING;

INSERT INTO modifiers (modifier_group_id, name, price_adjustment, display_order) VALUES
  ((SELECT id FROM modifier_groups WHERE name = 'Size'), 'Small', 0.00, 1),
  ((SELECT id FROM modifier_groups WHERE name = 'Size'), 'Medium', 0.50, 2),
  ((SELECT id FROM modifier_groups WHERE name = 'Size'), 'Large', 1.00, 3)
ON CONFLICT DO NOTHING;

-- Milk modifier group
INSERT INTO modifier_groups (name, is_required, min_selection, max_selection) VALUES
  ('Milk', false, 0, 1)
ON CONFLICT DO NOTHING;

INSERT INTO modifiers (modifier_group_id, name, price_adjustment, display_order) VALUES
  ((SELECT id FROM modifier_groups WHERE name = 'Milk'), 'Whole Milk', 0.00, 1),
  ((SELECT id FROM modifier_groups WHERE name = 'Milk'), 'Oat Milk', 0.75, 2),
  ((SELECT id FROM modifier_groups WHERE name = 'Milk'), 'Almond Milk', 0.75, 3),
  ((SELECT id FROM modifier_groups WHERE name = 'Milk'), 'Coconut Milk', 0.75, 4),
  ((SELECT id FROM modifier_groups WHERE name = 'Milk'), 'Soy Milk', 0.50, 5)
ON CONFLICT DO NOTHING;

-- Add-ons modifier group
INSERT INTO modifier_groups (name, is_required, min_selection, max_selection) VALUES
  ('Add-ons', false, 0, 5)
ON CONFLICT DO NOTHING;

INSERT INTO modifiers (modifier_group_id, name, price_adjustment, display_order) VALUES
  ((SELECT id FROM modifier_groups WHERE name = 'Add-ons'), 'Extra Shot', 0.75, 1),
  ((SELECT id FROM modifier_groups WHERE name = 'Add-ons'), 'Vanilla Syrup', 0.50, 2),
  ((SELECT id FROM modifier_groups WHERE name = 'Add-ons'), 'Caramel Syrup', 0.50, 3),
  ((SELECT id FROM modifier_groups WHERE name = 'Add-ons'), 'Hazelnut Syrup', 0.50, 4),
  ((SELECT id FROM modifier_groups WHERE name = 'Add-ons'), 'Honey', 0.50, 5),
  ((SELECT id FROM modifier_groups WHERE name = 'Add-ons'), 'Cinnamon', 0.25, 6),
  ((SELECT id FROM modifier_groups WHERE name = 'Add-ons'), 'Whipped Cream', 0.75, 7)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- ASSIGN MODIFIERS TO PRODUCTS
-- ============================================================================

-- Espresso drinks get all modifier groups
INSERT INTO product_modifier_groups (product_id, modifier_group_id, display_order)
SELECT p.id, mg.id, mg.id 
FROM products p, modifier_groups mg
WHERE p.category_id = (SELECT id FROM categories WHERE name = 'Espresso Drinks')
ON CONFLICT DO NOTHING;

-- Cold brew drinks get all modifier groups
INSERT INTO product_modifier_groups (product_id, modifier_group_id, display_order)
SELECT p.id, mg.id, mg.id 
FROM products p, modifier_groups mg
WHERE p.category_id = (SELECT id FROM categories WHERE name = 'Cold Brew')
ON CONFLICT DO NOTHING;

-- Tea drinks get size and add-ons
INSERT INTO product_modifier_groups (product_id, modifier_group_id, display_order)
SELECT p.id, mg.id, mg.id 
FROM products p, modifier_groups mg
WHERE p.category_id = (SELECT id FROM categories WHERE name = 'Tea')
  AND mg.name IN ('Size', 'Add-ons')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- INSERT INVENTORY
-- ============================================================================

INSERT INTO inventory (product_id, location_id, current_stock, low_stock_threshold)
SELECT p.id, l.id, 50, 10
FROM products p, locations l
ON CONFLICT (product_id, location_id) DO NOTHING;

-- ============================================================================
-- SETTINGS
-- ============================================================================

INSERT INTO settings (location_id, key, value, data_type)
SELECT l.id, 'store_name', l.name, 'string'
FROM locations l
ON CONFLICT (location_id, key) DO NOTHING;

INSERT INTO settings (location_id, key, value, data_type)
SELECT l.id, 'estimated_wait_time', '15', 'number'
FROM locations l
ON CONFLICT (location_id, key) DO NOTHING;
