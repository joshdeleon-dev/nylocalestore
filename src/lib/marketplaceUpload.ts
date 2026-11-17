'use client';

// Browser side of the signed-upload flow: ask the server for one-time upload URLs,
// send each photo straight to the private bucket, return the stored paths.

import { supabase } from '@/lib/supabase';

export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
export const MAX_PHOTOS = 10;

export function checkPhoto(file: File): string | null {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) return `${file.name}: use a JPG, PNG or WebP photo`;
  if (file.size > MAX_PHOTO_BYTES) return `${file.name}: photos must be 10 MB or smaller`;
  return null;
}

export async function uploadPhotos(signEndpoint: string, files: File[], extraBody: object = {}): Promise<string[]> {
  const res = await fetch(signEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...extraBody, action: 'sign', files: files.map((f) => ({ type: f.type, size: f.size })) }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Could not start upload');

  const uploads: { path: string; token: string }[] = json.uploads;
  await Promise.all(
    uploads.map(async ({ path, token }, i) => {
      const { error } = await supabase.storage
        .from('marketplace-pending')
        // Short CDN cache so photos of an unpublished listing stop loading within minutes
        .uploadToSignedUrl(path, token, files[i], { contentType: files[i].type, cacheControl: '300' });
      if (error) throw new Error(`${files[i].name}: ${error.message}`);
    })
  );
  return uploads.map((u) => u.path);
}
