import { NextRequest, NextResponse } from 'next/server';
import { supabase, supabaseAdmin } from '@/lib/supabase';
import { requireRole, ADMIN_MANAGER } from '@/lib/apiAuth';

const db = supabaseAdmin ?? supabase;

const ALLOWED_BUCKETS = ['product-images', 'hero-images'];
const MAX_BYTES = 10 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const auth = await requireRole(req, ADMIN_MANAGER);
  if (auth instanceof NextResponse) return auth;

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const bucket = (formData.get('bucket') as string) || 'product-images';

    if (!ALLOWED_BUCKETS.includes(bucket)) return NextResponse.json({ error: 'Invalid bucket' }, { status: 400 });
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    if (!file.type.startsWith('image/')) return NextResponse.json({ error: 'Only image files are allowed' }, { status: 400 });
    if (file.size > MAX_BYTES) return NextResponse.json({ error: 'Image must be 10 MB or smaller' }, { status: 400 });

    const ext = file.name.split('.').pop() ?? 'jpg';
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const arrayBuffer = await file.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);

    const { error } = await db.storage
      .from(bucket)
      .upload(filename, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (error) throw error;

    const { data: { publicUrl } } = db.storage.from(bucket).getPublicUrl(filename);

    return NextResponse.json({ url: publicUrl });
  } catch (err: any) {
    console.error('Upload error:', err);
    return NextResponse.json({ error: err.message || 'Upload failed' }, { status: 500 });
  }
}
