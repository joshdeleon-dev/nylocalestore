import { NextRequest, NextResponse } from 'next/server';
import { supabase, supabaseAdmin } from '@/lib/supabase';
import { requireRole, ADMIN_ONLY } from '@/lib/apiAuth';

const db = supabaseAdmin ?? supabase;

export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ADMIN_ONLY);
  if (auth instanceof NextResponse) return auth;

  const { data, error } = await db.from('roles').select('id, name, description').order('id');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}
