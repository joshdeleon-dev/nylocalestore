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
  if (!['ADMIN', 'MANAGER', 'BARISTA'].includes(role)) return null;
  return user;
}

// GET — fetch all modifier groups with their modifiers
export async function GET() {
  const { data, error } = await db
    .from('modifier_groups')
    .select('*, modifiers(*)')
    .order('display_order');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const groups = (data || []).map((g: any) => ({
    ...g,
    modifiers: (g.modifiers || []).sort((a: any, b: any) => a.display_order - b.display_order),
  }));
  return NextResponse.json({ data: groups });
}

// Handles both modifier_groups and modifiers via ?entity= param
export async function POST(req: NextRequest) {
  if (!await verifyStaff(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try {
    const { entity, ...body } = await req.json();
    const table = entity === 'group' ? 'modifier_groups' : 'modifiers';
    const { data, error } = await db.from(table).insert(body).select().single();
    if (error) throw error;
    return NextResponse.json({ data });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  if (!await verifyStaff(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try {
    const { entity, id, ...updates } = await req.json();
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    const table = entity === 'group' ? 'modifier_groups' : 'modifiers';
    const { data, error } = await db.from(table).update(updates).eq('id', id).select().single();
    if (error) throw error;
    return NextResponse.json({ data });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  if (!await verifyStaff(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const entity = searchParams.get('entity');
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    const table = entity === 'group' ? 'modifier_groups' : 'modifiers';
    const { error } = await db.from(table).delete().eq('id', parseInt(id));
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
