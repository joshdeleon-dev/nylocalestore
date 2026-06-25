import { NextRequest, NextResponse } from 'next/server';
import { supabase, supabaseAdmin } from '@/lib/supabase';

const db = supabaseAdmin ?? supabase;

async function verifyStaff(req: NextRequest) {
  const token = req.headers.get('authorization')?.slice(7);
  if (!token) return null;
  const { data: { user } } = await db.auth.getUser(token);
  if (!user) return null;
  const { data: profile } = await db.from('users').select('*, role:roles(name)').eq('id', user.id).single();
  const role = (profile as any)?.role?.name;
  if (!['ADMIN', 'MANAGER'].includes(role)) return null;
  return user;
}

export async function POST(req: NextRequest) {
  if (!await verifyStaff(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try {
    const body = await req.json();
    const { data, error } = await db.from('categories').insert(body).select().single();
    if (error) throw error;
    return NextResponse.json({ category: data });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  if (!await verifyStaff(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try {
    const { id, ...updates } = await req.json();
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    const { data, error } = await db.from('categories').update(updates).eq('id', id).select().single();
    if (error) throw error;
    return NextResponse.json({ category: data });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  if (!await verifyStaff(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    const { error } = await db.from('categories').delete().eq('id', parseInt(id));
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
