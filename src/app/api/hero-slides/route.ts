import { NextRequest, NextResponse } from 'next/server';
import { supabase, supabaseAdmin } from '@/lib/supabase';

const db = supabaseAdmin ?? supabase;

export async function GET() {
  const { data, error } = await db
    .from('hero_slides')
    .select('*')
    .order('display_order');
  if (error) {
    // Table may not exist yet (migration pending) — return empty gracefully
    if (error.message?.includes('hero_slides') || error.code === 'PGRST200' || error.code === '42P01') {
      return NextResponse.json({ slides: [] });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ slides: data });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { data, error } = await db.from('hero_slides').insert(body).select().single();
    if (error) throw error;
    return NextResponse.json({ slide: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, ...updates } = body;
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    const { data, error } = await db.from('hero_slides').update(updates).eq('id', id).select().single();
    if (error) throw error;
    return NextResponse.json({ slide: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    const { error } = await db.from('hero_slides').delete().eq('id', parseInt(id));
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
