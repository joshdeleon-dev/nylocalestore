import { NextRequest, NextResponse } from 'next/server';
import { supabase, supabaseAdmin } from '@/lib/supabase';

const db = supabaseAdmin ?? supabase;

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const productId = url.searchParams.get('product_id');
    const limit = parseInt(url.searchParams.get('limit') || '1000');

    let query = db
      .from('inventory_logs')
      .select('product_id, quantity_change, adjustment_reason, previous_stock, new_stock, created_at')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (productId) query = query.eq('product_id', parseInt(productId));

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching inventory logs:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch inventory logs' }, { status: 500 });
  }
}
