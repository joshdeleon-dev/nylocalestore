-- Add is_featured column to products
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT false;

-- Hero slides table for homepage carousel
CREATE TABLE IF NOT EXISTS hero_slides (
  id SERIAL PRIMARY KEY,
  title TEXT,
  subtitle TEXT,
  cta_text TEXT DEFAULT 'Order Now',
  cta_href TEXT DEFAULT '/#menu',
  image_url TEXT NOT NULL,
  display_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Saved reports table
CREATE TABLE IF NOT EXISTS saved_reports (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('orders', 'inventory')),
  fields JSONB NOT NULL DEFAULT '[]',
  filters JSONB NOT NULL DEFAULT '{}',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS for hero_slides (public read, admin write via service role)
ALTER TABLE hero_slides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read hero_slides" ON hero_slides FOR SELECT USING (true);

-- RLS for saved_reports (admin/manager only via service role)
ALTER TABLE saved_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read saved_reports" ON saved_reports FOR SELECT USING (true);
