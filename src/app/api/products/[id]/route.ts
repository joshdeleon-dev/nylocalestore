import { NextRequest, NextResponse } from 'next/server';
import { supabase, supabaseAdmin } from '@/lib/supabase';

const db = supabaseAdmin ?? supabase;

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const { data, error } = await db
      .from('products')
      .select(
        `*,
        modifier_groups:product_modifier_groups(
          modifier_group:modifier_groups(*, modifiers(*))
        )`
      )
      .eq('id', id)
      .single();

    if (error) throw error;
    if (!data) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });

    const { data: invData } = await db
      .from('inventory')
      .select('current_stock')
      .eq('product_id', id)
      .eq('location_id', 1)
      .single();

    return NextResponse.json({ success: true, data: { ...data, current_stock: invData?.current_stock ?? null } });
  } catch (err) {
    return NextResponse.json({ success: false, error: 'Failed to fetch product' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const body = await req.json();
    const { name, description, category_id, base_price, is_available, display_order } = body;

    const { data, error } = await supabase
      .from('products')
      .update({ name, description, category_id, base_price, is_available, display_order })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (err) {
    return NextResponse.json({ success: false, error: 'Failed to update product' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const { error } = await supabase.from('products').delete().eq('id', id);
    if (error) throw error;
    return NextResponse.json({ success: true, message: 'Product deleted' });
  } catch (err) {
    return NextResponse.json({ success: false, error: 'Failed to delete product' }, { status: 500 });
  }
}
