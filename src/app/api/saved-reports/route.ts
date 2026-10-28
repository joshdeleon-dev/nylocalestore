import { NextRequest, NextResponse } from 'next/server';
import { supabase, supabaseAdmin } from '@/lib/supabase';
import { requireRole, ADMIN_MANAGER } from '@/lib/apiAuth';

const db = supabaseAdmin ?? supabase;

export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ADMIN_MANAGER);
  if (auth instanceof NextResponse) return auth;

  const { data, error } = await db
    .from('saved_reports')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) {
    // Table may not exist yet (migration pending) — return empty gracefully
    if (error.message?.includes('saved_reports') || error.code === 'PGRST200' || error.code === '42P01') {
      return NextResponse.json({ reports: [] });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ reports: data });
}

export async function POST(req: NextRequest) {
  const auth = await requireRole(req, ADMIN_MANAGER);
  if (auth instanceof NextResponse) return auth;

  try {
    const token = req.headers.get('authorization')?.slice(7);
    let created_by: string | undefined;
    if (token) {
      const { data: { user } } = await db.auth.getUser(token);
      created_by = user?.id;
    }

    const body = await req.json();
    const { name, source, fields, filters } = body;

    if (!name || !source || !fields?.length) {
      return NextResponse.json({ error: 'name, source and fields are required' }, { status: 400 });
    }

    const { data, error } = await db
      .from('saved_reports')
      .insert({ name, source, fields, filters: filters ?? {}, created_by })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ report: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const auth = await requireRole(req, ADMIN_MANAGER);
  if (auth instanceof NextResponse) return auth;

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    const { error } = await db.from('saved_reports').delete().eq('id', parseInt(id));
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
