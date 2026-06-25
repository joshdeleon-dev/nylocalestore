import { NextRequest, NextResponse } from 'next/server';
import { supabase, supabaseAdmin } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const categoryId = url.searchParams.get('category_id');
    const all = url.searchParams.get('all') === 'true';
    const limit = parseInt(url.searchParams.get('limit') || '500');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    const db = supabaseAdmin ?? supabase;

    let query = db
      .from('products')
      .select('*', { count: 'exact' })
      .order('display_order')
      .range(offset, offset + limit - 1);

    if (!all) query = query.eq('is_available', true);
    if (categoryId) query = query.eq('category_id', parseInt(categoryId));

    const { data, count, error } = await query;

    if (error) throw error;

    return NextResponse.json({ success: true, data, total: count });
  } catch (error) {
    console.error('Error fetching products:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch products' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description, category_id, base_price, image_url, display_order } = body;

    if (!name || !category_id || base_price === undefined) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const { data: product, error } = await supabase
      .from('products')
      .insert({
        name,
        description,
        category_id,
        base_price,
        image_url,
        display_order: display_order || 0,
        is_available: true,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(
      {
        success: true,
        data: product,
        message: 'Product created successfully',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating product:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create product' },
      { status: 500 }
    );
  }
}
