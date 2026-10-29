#!/usr/bin/env node
// Seed sample marketplace listings (2 per category) into the STAGING database, with real
// photos from Wikimedia Commons (CC0 / public domain only, so no attribution is required).
// Refuses to run against any other project, so samples can never reach production.
//
// Usage (from the project root, with .env.local pointing at staging):
//   node supabase/scripts/seed-marketplace-samples.mjs           # add samples (replaces old samples)
//   node supabase/scripts/seed-marketplace-samples.mjs --remove  # remove all samples
//
// Samples are tied to the seller samples@nylocalestore.test and tagged in admin notes.

import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const STAGING_REF = 'eeqdzaggpyeurezgcfrx';
const SAMPLE_EMAIL = 'samples@nylocalestore.test';
const SAMPLE_NOTE = 'SAMPLE DATA — created by supabase/scripts/seed-marketplace-samples.mjs';
// Wikimedia asks automated clients to identify themselves
const USER_AGENT = 'NYLocaleStore-StagingSeed/1.0 (https://www.nylocalestore.com)';

const env = Object.fromEntries(
  fs.readFileSync(path.resolve('.env.local'), 'utf8').split('\n')
    .map((l) => l.match(/^\s*([A-Z_]+)\s*=\s*"?([^"\n]*)"?/)).filter(Boolean).map((m) => [m[1], m[2].trim()])
);
if (!env.NEXT_PUBLIC_SUPABASE_URL?.includes(STAGING_REF)) {
  console.error(`✗ .env.local does not point at the staging project (${STAGING_REF}). Refusing to run.`);
  process.exit(1);
}
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const commons = (file) => `https://commons.wikimedia.org/wiki/File:${file}`;
const thumb = (hashPath, file) => `https://upload.wikimedia.org/wikipedia/commons/thumb/${hashPath}/${file}/1280px-${file}`;
const original = (hashPath, file) => `https://upload.wikimedia.org/wikipedia/commons/${hashPath}/${file}`;

// status: published unless noted. Prices in cents. Each photo: { url, source (Commons page), license }
const SAMPLES = {
  furniture: [
    { title: 'Antique Mahogany Secretary Desk', condition: 'good', price: 45000, pct: 15,
      description: 'Inlaid mahogany secretary with a drop-front writing surface, interior cubbies and three drawers below. Heavy and solid — bring a helper to carry it.',
      photos: [{ url: thumb('e/ed', 'Secretary%2C_Netherlands%2C_mid_18th_century%2C_mahogany_with_inlaid_marquetry_-_Cincinnati_Art_Museum_-_DSC04422.JPG'), source: commons('Secretary,_Netherlands,_mid_18th_century,_mahogany_with_inlaid_marquetry_-_Cincinnati_Art_Museum_-_DSC04422.JPG'), license: 'CC0' }] },
    { title: 'Glass-Front Wooden Bookcase', condition: 'good', price: 22000, pct: 20,
      description: 'Tall wooden bookcase with glass doors and adjustable shelves. Keeps books dust-free. Light wear on the base.',
      photos: [{ url: thumb('b/b4', 'Bookcase_MET_ADA3165.jpg'), source: commons('Bookcase_MET_ADA3165.jpg'), license: 'CC0' }] },
  ],
  electronics: [
    { title: 'Portable Record Player in Wooden Case', condition: 'good', price: 8500, pct: 5, status: 'reserved',
      description: 'Vintage portable record player built into a wooden carrying case. Plays 33 and 45 RPM. Recently cleaned; the case shows its age.',
      photos: [{ url: thumb('7/7f', 'Portable_HMV_LP_-_gramophone-_phonograph-_record_player_encased_in_wooden_box.jpg'), source: commons('Portable_HMV_LP_-_gramophone-_phonograph-_record_player_encased_in_wooden_box.jpg'), license: 'CC0' }] },
    { title: '35mm Autofocus Film Camera', condition: 'like_new', price: 6500, pct: 10,
      description: '35mm SLR film camera with autofocus zoom lens. Shutter and meter work. Great starter camera for film photography.',
      photos: [{ url: thumb('b/be', 'Chinon_CP_9_AF_BW_1.JPG'), source: commons('Chinon_CP_9_AF_BW_1.JPG'), license: 'Public domain' }] },
  ],
  'clothing-accessories': [
    { title: 'Brown Leather Jacket, Size M', condition: 'good', price: 7500, pct: 15,
      description: 'Classic brown leather jacket, men’s medium. Nicely broken in with a soft, worn-in look. Zip front and two side pockets.',
      photos: [{ url: thumb('9/9f', 'Leather_jacket_golden_era.jpg'), source: commons('Leather_jacket_golden_era.jpg'), license: 'CC0' }] },
    { title: 'Vintage Tooled Leather Handbag', condition: 'good', price: 9000, pct: 0,
      description: 'Hand-tooled leather handbag with gilded detailing and a top handle. Interior is clean; minor wear on the corners.',
      photos: [
        { url: original('7/7d', '1935-45_Prada_handbag%2C_tooled_and_gilded_leather_02.jpg'), source: commons('1935-45_Prada_handbag,_tooled_and_gilded_leather_02.jpg'), license: 'CC0' },
        { url: original('a/a3', '1935-45_Prada_handbag%2C_tooled_and_gilded_leather_03.jpg'), source: commons('1935-45_Prada_handbag,_tooled_and_gilded_leather_03.jpg'), license: 'CC0' },
      ] },
  ],
  'home-kitchen': [
    { title: 'Hand-Painted Porcelain Teapot', condition: 'like_new', price: 4000, pct: 20,
      description: 'Decorative porcelain teapot with hand-painted floral design. No chips or cracks. Lovely for display or tea for two.',
      photos: [{ url: thumb('5/5e', 'Teapot_MET_DP-13600-002.jpg'), source: commons('Teapot_MET_DP-13600-002.jpg'), license: 'CC0' }] },
    { title: '12" Cast Iron Skillet', condition: 'like_new', price: 3000, pct: 15,
      description: 'Pre-seasoned 12-inch cast iron skillet with long handle and helper handle. Used a few times and re-seasoned.',
      photos: [{ url: thumb('4/4d', 'Victoria_Signature_Series_Skillet%2C_2023.jpg'), source: commons('Victoria_Signature_Series_Skillet,_2023.jpg'), license: 'CC0' }] },
  ],
  'books-media': [
    { title: 'Antique Hardcover Books (Set of 4)', condition: 'fair', price: 3500, pct: 10,
      description: 'Four old cloth-bound hardcovers with gilt lettering — great for a bookshelf display. Spines are worn; pages intact.',
      photos: [{ url: thumb('c/ca', 'Old_Books_01.JPG'), source: commons('Old_Books_01.JPG'), license: 'CC0' }] },
    { title: 'Vinyl Record Collection (30 LPs)', condition: 'good', price: 6000, pct: 5,
      description: 'Thirty LPs across rock, soul and jazz. Sleeves show some shelf wear; records play cleanly.',
      photos: [
        { url: thumb('1/1e', 'Vinyl_%2B_Grado_Headphones_%28Unsplash%29.jpg'), source: commons('Vinyl_+_Grado_Headphones_(Unsplash).jpg'), license: 'CC0' },
        { url: thumb('7/72', 'Vinyl_collection_at_a_record_store_%28Unsplash%29.jpg'), source: commons('Vinyl_collection_at_a_record_store_(Unsplash).jpg'), license: 'CC0' },
      ] },
  ],
  'kids-baby': [
    { title: 'Wooden Rocking Horse', condition: 'like_new', price: 5500, pct: 20,
      description: 'Solid wood rocking horse for toddlers, with handles and a wide, stable base. Smooth finish, no splinters.',
      photos: [{ url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/52/20241220_172041_DM_Drogerie_Markt%2C_Nowa_Sukcesja_shopping_mall%2C_Al._Politechniki_1%2C_%C5%81%C3%B3d%C5%BA%2C_Poland._rocking_horse_for_children._Not_for_sale._Shop_equipment.jpg/1280px-thumbnail.jpg',
        source: commons('20241220_172041_DM_Drogerie_Markt,_Nowa_Sukcesja_shopping_mall,_Al._Politechniki_1,_Łódź,_Poland._rocking_horse_for_children._Not_for_sale._Shop_equipment.jpg'), license: 'Public domain' }] },
    { title: 'Vintage Baby Pram', condition: 'fair', price: 12000, pct: 15,
      description: 'Classic coach-built pram with a fold-down hood and large spoked wheels. A charming display piece; wheels roll well.',
      photos: [{ url: thumb('c/c6', 'Old_pram_at_the_Mus%C3%A9e_Automobile_de_Vend%C3%A9e_pic-3.JPG'), source: commons('Old_pram_at_the_Musée_Automobile_de_Vendée_pic-3.JPG'), license: 'CC0' }] },
  ],
  'sports-outdoors': [
    { title: 'Road Bike, 54cm Frame', condition: 'good', price: 32000, pct: 10,
      description: 'Lightweight aluminum road bike, 54cm frame (fits roughly 5\'6"–5\'10"). Drop bars, clipless-ready pedals. Tuned up last month.',
      photos: [{ url: thumb('1/11', '%27Parked_Racer%27_in_Soho_on_%27Friday_party_night%27..jpg'), source: commons("'Parked_Racer'_in_Soho_on_'Friday_party_night'..jpg"), license: 'Public domain' }] },
    { title: 'Dome Camping Tent, 4-Person', condition: 'like_new', price: 9000, pct: 0,
      description: 'Four-person dome tent with rainfly, ground tarp and stakes. Used on two weekend trips. Packs into its carry bag.',
      photos: [{ url: thumb('1/18', 'Camping_tent_on_tarp.jpg'), source: commons('Camping_tent_on_tarp.jpg'), license: 'CC0' }] },
  ],
  other: [
    { title: 'Acoustic Guitar', condition: 'good', price: 11000, pct: 15,
      description: 'Full-size acoustic guitar with a cutaway body and fresh strings. Warm tone, comfortable action. Small ding on the back.',
      photos: [{ url: thumb('6/67', 'Fender_California_Series_Acoustic_Guitar_%28serial_no._CSC10001615%29_%282018-04-26_13.21.46_Piqsels.com_id_olkmb%29.jpg'), source: commons('Fender_California_Series_Acoustic_Guitar_(serial_no._CSC10001615)_(2018-04-26_13.21.46_Piqsels.com_id_olkmb).jpg'), license: 'CC0' }] },
    { title: 'Antique Wooden Wall Clock', condition: 'good', price: 7000, pct: 20, status: 'submitted',
      description: 'Round wall clock in a wooden case with a classic numbered dial. Keeps good time on a single AA battery.',
      photos: [{ url: thumb('3/3f', 'Antique_Wooden_SEC_Wall_Clock.jpg'), source: commons('Antique_Wooden_SEC_Wall_Clock.jpg'), license: 'CC0' }] },
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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function download(url) {
  await sleep(1000); // stay well under Wikimedia's rate limits
  for (let attempt = 1; attempt <= 5; attempt++) {
    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
    if (res.ok) {
      const bytes = Buffer.from(await res.arrayBuffer());
      if (bytes.length > 10 * 1024 * 1024) throw new Error(`Photo over 10 MB: ${url}`);
      return bytes;
    }
    if (res.status !== 429 && res.status < 500) throw new Error(`Download failed (${res.status}): ${url}`);
    const retryAfter = Number(res.headers.get('retry-after')) || 0;
    await sleep(Math.max(retryAfter * 1000, 4000 * attempt));
  }
  throw new Error(`Download failed after retries: ${url}`);
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

  const summary = [];
  let minutesAgo = 0;

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
          admin_notes: `${SAMPLE_NOTE}\nPhotos: ${s.photos.map((p) => `${p.source} (${p.license})`).join(', ')}`,
          published_at: status === 'submitted' ? null : publishedAt,
          reviewed_at: status === 'submitted' ? null : publishedAt,
          created_at: publishedAt,
        })
        .select('id, locale_amount_cents, seller_payout_cents')
        .single();
      if (error) throw error;

      for (const [i, photo] of s.photos.entries()) {
        const bytes = await download(photo.url);
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
        category: cat.name, title: s.title, status, photos: s.photos.length,
        price: `$${(s.price / 100).toFixed(2)}`, forLocale: `${s.pct}% = $${(listing.locale_amount_cents / 100).toFixed(2)}`,
        payout: `$${(listing.seller_payout_cents / 100).toFixed(2)}`,
      });
    }
  }

  console.table(summary);
  console.log(`✓ Added ${summary.length} sample listings to staging.`);
}

main().catch((e) => { console.error('✗', e.message ?? e); process.exit(1); });
