import { NextRequest, NextResponse } from 'next/server';
import { supabase, supabaseAdmin } from '@/lib/supabase';

const db = supabaseAdmin ?? supabase;

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const roleId = url.searchParams.get('role_id');
    const isActive = url.searchParams.get('is_active');

    let query = db
      .from('users')
      .select('*, role:roles(name), location:locations(name)')
      .order('created_at', { ascending: false });

    if (roleId) query = query.eq('role_id', roleId);
    if (isActive !== null) query = query.eq('is_active', isActive === 'true');

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to fetch users' }, { status: 500 });
  }
}
