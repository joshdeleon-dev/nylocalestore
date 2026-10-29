#!/usr/bin/env node
// Seed sample marketplace listings (2 per category) into the STAGING database, with
// generated photos. Refuses to run against any other project, so samples can never
// reach production.
//
// Usage (from the project root, with .env.local pointing at staging):
//   node supabase/scripts/seed-marketplace-samples.mjs           # add samples (replaces old samples)
//   node supabase/scripts/seed-marketplace-samples.mjs --remove  # remove all samples
//
// Samples are tied to the seller samples@nylocalestore.test and tagged in admin notes.

import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { chromium } from 'playwright';

const STAGING_REF = 'eeqdzaggpyeurezgcfrx';
const SAMPLE_EMAIL = 'samples@nylocalestore.test';
const SAMPLE_NOTE = 'SAMPLE DATA — created by supabase/scripts/seed-marketplace-samples.mjs';

const env = Object.fromEntries(
  fs.readFileSync(path.resolve('.env.local'), 'utf8').split('\n')
    .map((l) => l.match(/^\s*([A-Z_]+)\s*=\s*"?([^"\n]*)"?/)).filter(Boolean).map((m) => [m[1], m[2].trim()])
);
if (!env.NEXT_PUBLIC_SUPABASE_URL?.includes(STAGING_REF)) {
  console.error(`✗ .env.local does not point at the staging project (${STAGING_REF}). Refusing to run.`);
  process.exit(1);
}
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

// status: published unless noted. Prices in cents.
const SAMPLES = {
  furniture: [
    { title: 'Mid-Century Walnut Desk', condition: 'good', price: 18000, pct: 15, emoji: '🪑', colors: ['#c49a6c', '#6b4a2b'],
      description: 'Solid walnut writing desk with two drawers. 48" W x 24" D x 30" H. Light surface wear on top, drawers slide smoothly.' },
    { title: 'Oak Bookshelf, 5 Shelves', condition: 'like_new', price: 9500, pct: 20, emoji: '📚', colors: ['#d8b98f', '#8a6a44'],
      description: 'Sturdy oak bookshelf, 72" tall. Adjustable shelves. Bought last year, moving and can’t take it with us.' },
  ],
  electronics: [
    { title: 'Bluetooth Bookshelf Speakers (Pair)', condition: 'like_new', price: 12000, pct: 10, emoji: '🔊', colors: ['#5b6b7a', '#1f2a33'],
      description: 'Powered speakers with Bluetooth and optical input. Includes remote and original box. Great sound for a small room.' },
    { title: 'Vintage Turntable', condition: 'good', price: 8500, pct: 5, emoji: '🎶', colors: ['#7a5c4f', '#2e211b'], status: 'reserved',
      description: 'Belt-drive turntable from the 1980s, recently serviced with a new belt. Plays 33 and 45 RPM. Dust cover has small scratches.' },
  ],
  'clothing-accessories': [
    { title: 'Wool Winter Coat, Size M', condition: 'like_new', price: 6000, pct: 15, emoji: '🧥', colors: ['#8a8f99', '#3d4048'],
      description: 'Charcoal wool-blend overcoat, women’s medium. Worn a handful of times, dry cleaned. Fully lined with inside pocket.' },
    { title: 'Leather Crossbody Bag', condition: 'good', price: 3500, pct: 0, emoji: '👜', colors: ['#b07a4f', '#5c3a22'],
      description: 'Genuine leather crossbody with adjustable strap and two inner pockets. Some softening of the leather from use.' },
  ],
  'home-kitchen': [
    { title: 'Stand Mixer, 5 Quart', condition: 'good', price: 15000, pct: 20, emoji: '🍰', colors: ['#e3a6a1', '#9c4a45'],
      description: 'Tilt-head stand mixer with whisk, paddle and dough hook. Works perfectly. Minor scuffs on the base.' },
    { title: 'Handmade Ceramic Vase', condition: 'new', price: 4500, pct: 15, emoji: '🏺', colors: ['#9bb7a8', '#3f5e52'],
      description: 'Wheel-thrown stoneware vase, about 30 cm tall, glazed sage green. Never used.' },
  ],
  'books-media': [
    { title: 'Classic Novels Box Set (10 Books)', condition: 'good', price: 2500, pct: 10, emoji: '📖', colors: ['#c9b38a', '#6d5a3a'],
      description: 'Paperback set including Pride and Prejudice, Moby-Dick, Jane Eyre and more. Spines show light reading wear.' },
    { title: 'Jazz Vinyl Records Collection', condition: 'fair', price: 4000, pct: 5, emoji: '💿', colors: ['#3c3c46', '#121218'],
      description: '15 jazz LPs from the 60s and 70s. Sleeves show age; records play well with occasional surface noise.' },
  ],
  'kids-baby': [
    { title: 'Convertible Wooden Crib', condition: 'like_new', price: 13000, pct: 15, emoji: '🧸', colors: ['#f0d9b5', '#b8925a'],
      description: 'Converts from crib to toddler bed. Solid pine, non-toxic finish. Mattress not included. Assembly instructions included.' },
    { title: 'Kids’ Balance Bike', condition: 'good', price: 4000, pct: 20, emoji: '🚲', colors: ['#8ec5e6', '#2f6d94'],
      description: 'Lightweight balance bike for ages 2–5. Adjustable seat, air tires recently inflated. A few cosmetic scratches.' },
  ],
  'sports-outdoors': [
    { title: 'Road Bike, 54cm Frame', condition: 'good', price: 32000, pct: 10, emoji: '🚴', colors: ['#d97a4a', '#7a3416'],
      description: 'Aluminum road bike, 18 speeds, 54cm frame (fits roughly 5\'6"–5\'10"). Tuned up last month, new brake pads.' },
    { title: 'Camping Tent, 4-Person', condition: 'like_new', price: 9000, pct: 0, emoji: '⛺', colors: ['#7fae7a', '#2f5a2b'],
      description: 'Dome tent with rainfly, footprint and stakes. Used on two weekend trips. Packs into its carry bag.' },
  ],
  other: [
    { title: 'Acoustic Guitar with Case', condition: 'good', price: 11000, pct: 15, emoji: '🎸', colors: ['#d6a35c', '#7a4f1c'],
      description: 'Full-size dreadnought acoustic, new strings. Comes with padded gig bag and a few picks. Small ding on the back.' },
    { title: 'Framed Botanical Prints (Set of 3)', condition: 'like_new', price: 5000, pct: 20, emoji: '🌿', colors: ['#bcd0a4', '#5d7340'], status: 'submitted',
      description: 'Three matching botanical art prints in natural wood frames, 11" x 14" each. Ready to hang.' },
  ],
};

const slugify = (t) => t.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);

async function removeSamples() {
  const { data: sellers } = await db.from('marketplace_sellers').select('id').eq('email', SAMPLE_EMAIL);
  const sellerIds = (sellers ?? []).map((s) => s.id);
  if (!sellerIds.length) return 0;
  const { data: listings } = await db.from('marketplace_listings').select('id').in('seller_id', sellerIds);
  for (const l of listings ?? []) {
    const { data: imgs } = await db.from('marketplace_listing_images').select('storage_path').eq('listing_id', l.id);
    const paths = (imgs ?? []).map((i) => i.storage_path);
    if (paths.length) {
      await db.storage.from('marketplace-pending').remove(paths);
      await db.storage.from('marketplace-public').remove(paths);
    }
    await db.from('marketplace_audit_log').delete().eq('entity_type', 'listing').eq('entity_id', String(l.id));
  }
  await db.from('marketplace_listings').delete().in('seller_id', sellerIds);
  await db.from('marketplace_sellers').delete().in('id', sellerIds);
  return listings?.length ?? 0;
}

async function renderPhotos(page, sample) {
  const [a, b] = sample.colors;
  const shots = [];
  for (const variant of [0, 1]) {
    const angle = variant ? 45 : 145;
    await page.setContent(`
      <div style="width:1000px;height:1000px;display:flex;flex-direction:column;align-items:center;justify-content:center;
                  background:linear-gradient(${angle}deg,${a},${b});font-family:Georgia,serif;color:#fff;position:relative">
        <div style="font-size:${variant ? 300 : 360}px;line-height:1;filter:drop-shadow(0 18px 30px rgba(0,0,0,.25))">${sample.emoji}</div>
        <div style="position:absolute;bottom:56px;font-size:30px;letter-spacing:.18em;text-transform:uppercase;opacity:.75">Sample photo ${variant + 1}</div>
      </div>`);
    shots.push(await page.screenshot({ type: 'jpeg', quality: 82 }));
  }
  return shots;
}

async function main() {
  const removed = await removeSamples();
  if (process.argv.includes('--remove')) {
    console.log(`✓ Removed ${removed} sample listing(s) from staging.`);
    return;
  }
  if (removed) console.log(`→ Replaced ${removed} existing sample listing(s)`);

  const { data: cats } = await db.from('marketplace_categories').select('id, slug, name');
  const bySlug = new Map((cats ?? []).map((c) => [c.slug, c]));

  const { data: seller, error: sellerErr } = await db
    .from('marketplace_sellers')
    .insert({ name: 'Sample Seller', email: SAMPLE_EMAIL, phone: '(000) 000-0000', consent_at: new Date().toISOString() })
    .select('id')
    .single();
  if (sellerErr) throw sellerErr;

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1000, height: 1000 } });
  const summary = [];
  let minutesAgo = 0;

  try {
    for (const [catSlug, samples] of Object.entries(SAMPLES)) {
      const cat = bySlug.get(catSlug);
      if (!cat) { console.warn(`! Category ${catSlug} not found — skipped`); continue; }

      for (const s of samples) {
        const status = s.status ?? 'published';
        // Stagger publish times so "Newest first" has a stable, varied order
        const publishedAt = new Date(Date.now() - (minutesAgo += 37) * 60_000).toISOString();

        let slug = slugify(s.title);
        const { data: clash } = await db.from('marketplace_listings').select('id').eq('slug', slug).maybeSingle();
        if (clash) slug = `${slug}-sample`;

        const { data: listing, error } = await db
          .from('marketplace_listings')
          .insert({
            seller_id: seller.id,
            category_id: cat.id,
            title: s.title,
            slug,
            description: s.description,
            condition: s.condition,
            asking_price_cents: s.price,
            locale_percent: s.pct,
            status,
            admin_notes: SAMPLE_NOTE,
            published_at: status === 'submitted' ? null : publishedAt,
            reviewed_at: status === 'submitted' ? null : publishedAt,
            created_at: publishedAt,
          })
          .select('id, locale_amount_cents, seller_payout_cents')
          .single();
        if (error) throw error;

        const photos = await renderPhotos(page, s);
        for (const [i, bytes] of photos.entries()) {
          const storagePath = `listings/${listing.id}/sample-${i + 1}.jpg`;
          const { error: upErr } = await db.storage
            .from('marketplace-pending')
            .upload(storagePath, bytes, { contentType: 'image/jpeg', cacheControl: '300', upsert: true });
          if (upErr) throw upErr;
          let publicPath = null;
          if (status !== 'submitted') {
            const { error: cpErr } = await db.storage
              .from('marketplace-pending')
              .copy(storagePath, storagePath, { destinationBucket: 'marketplace-public' });
            if (cpErr && !/exists/i.test(cpErr.message)) throw cpErr;
            publicPath = storagePath;
          }
          const { error: imgErr } = await db
            .from('marketplace_listing_images')
            .insert({ listing_id: listing.id, storage_path: storagePath, public_path: publicPath, sort_order: i });
          if (imgErr) throw imgErr;
        }

        await db.from('marketplace_audit_log').insert({
          actor_id: null, entity_type: 'listing', entity_id: String(listing.id), action: 'seed_sample',
          before_data: null, after_data: { status, note: SAMPLE_NOTE },
        });

        summary.push({
          category: cat.name, title: s.title, status,
          price: `$${(s.price / 100).toFixed(2)}`, forLocale: `${s.pct}% = $${(listing.locale_amount_cents / 100).toFixed(2)}`,
          payout: `$${(listing.seller_payout_cents / 100).toFixed(2)}`,
        });
      }
    }
  } finally {
    await browser.close();
  }

  console.table(summary);
  console.log(`✓ Added ${summary.length} sample listings to staging.`);
}

main().catch((e) => { console.error('✗', e.message ?? e); process.exit(1); });
