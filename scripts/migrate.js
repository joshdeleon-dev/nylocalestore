#!/usr/bin/env node
// Run: node scripts/migrate.js
// Requires: SUPABASE_DB_URL env var
// Get it from: Supabase Dashboard > Project Settings > Database > Connection string (URI)
// Format: postgresql://postgres:[password]@db.[ref].supabase.co:5432/postgres

import postgres from 'postgres';

const DB_URL = process.env.SUPABASE_DB_URL;
if (!DB_URL) {
  console.error('Missing SUPABASE_DB_URL. Get it from Supabase Dashboard > Project Settings > Database.');
  process.exit(1);
}

const sql = postgres(DB_URL, { ssl: 'require' });

const migration = `
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT false;

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

CREATE TABLE IF NOT EXISTS saved_reports (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('orders', 'inventory')),
  fields JSONB NOT NULL DEFAULT '[]',
  filters JSONB NOT NULL DEFAULT '{}',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE hero_slides ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'hero_slides' AND policyname = 'Public read hero_slides') THEN
    CREATE POLICY "Public read hero_slides" ON hero_slides FOR SELECT USING (true);
  END IF;
END $$;

ALTER TABLE saved_reports ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'saved_reports' AND policyname = 'Public read saved_reports') THEN
    CREATE POLICY "Public read saved_reports" ON saved_reports FOR SELECT USING (true);
  END IF;
END $$;
`;

try {
  await sql.unsafe(migration);
  console.log('Migration applied successfully.');
} catch (err) {
  console.error('Migration failed:', err.message);
} finally {
  await sql.end();
}
