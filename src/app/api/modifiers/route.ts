import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const productId = url.searchParams.get('product_id');

    if (productId) {
      const { data, error } = await supabase
        .from('product_modifier_groups')
        .select('*, modifier_group:modifier_groups(*, modifiers(*))')
        .eq('product_id', productId)
        .order('display_order');
      if (error) throw error;
      return NextResponse.json({ success: true, data });
    }

    const { data, error } = await supabase
      .from('modifier_groups')
      .select('*, modifiers(*)')
      .order('display_order');
    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to fetch modifiers' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, is_required, min_selection, max_selection, display_order } = body;

    if (!name) {
      return NextResponse.json({ success: false, error: 'Name is required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('modifier_groups')
      .insert({ name, is_required: is_required ?? false, min_selection: min_selection ?? 0, max_selection, display_order: display_order ?? 0 })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to create modifier group' }, { status: 500 });
  }
}
