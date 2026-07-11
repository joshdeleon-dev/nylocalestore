import { NextRequest, NextResponse } from 'next/server';
import { supabase, supabaseAdmin } from '@/lib/supabase';

const db = supabaseAdmin ?? supabase;

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const locationId = url.searchParams.get('location_id');
    const productId = url.searchParams.get('product_id');
    const lowStockOnly = url.searchParams.get('low_stock_only') === 'true';
    const limit = parseInt(url.searchParams.get('limit') || '100');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    let query = db
      .from('inventory')
      .select('*, original_stock, product:products!inner(name, is_available, is_archived), location:locations(name)', { count: 'exact' })
      .eq('location_id', locationId ? parseInt(locationId) : 1)
      .eq('product.is_archived', false)
      .eq('product.is_available', true);

    if (productId) query = query.eq('product_id', parseInt(productId));
    if (lowStockOnly) query = query.lt('current_stock', 'low_stock_threshold');

    const { data, count, error } = await query
      .order('current_stock')
      .range(offset, offset + limit - 1);

    if (error) throw error;

    return NextResponse.json({ success: true, data, total: count });
  } catch (error) {
    console.error('Error fetching inventory:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch inventory' }, { status: 500 });
  }
}

// Upsert inventory stock for a product (used when setting stock from product form)
export async function PUT(request: NextRequest) {
  try {
    const { product_id, location_id = 1, current_stock, low_stock_threshold = 5 } = await request.json();
    if (!product_id || current_stock === undefined) {
      return NextResponse.json({ success: false, error: 'product_id and current_stock required' }, { status: 400 });
    }

    const { data: existing } = await db.from('inventory')
      .select('id')
      .eq('product_id', product_id)
      .eq('location_id', location_id)
      .single();

    let result;
    if (existing) {
      const { data, error } = await db.from('inventory')
        .update({ current_stock, low_stock_threshold })
        .eq('id', existing.id)
        .select()
        .single();
      if (error) throw error;
      result = data;
    } else {
      const { data, error } = await db.from('inventory')
        .insert({ product_id, location_id, current_stock, low_stock_threshold, unit_of_measure: 'units' })
        .select()
        .single();
      if (error) throw error;
      result = data;
    }

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('Error upserting inventory:', error);
    return NextResponse.json({ success: false, error: 'Failed to update inventory' }, { status: 500 });
  }
}

// Adjust inventory by delta (used by inventory pages)
export async function POST(request: NextRequest) {
  try {
    const { product_id, location_id, quantity_change, adjustment_reason } = await request.json();

    if (!product_id || !location_id || quantity_change === undefined) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }

    const { data: inventory, error: fetchError } = await db
      .from('inventory')
      .select('*')
      .eq('product_id', product_id)
      .eq('location_id', location_id)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') throw fetchError;
    if (!inventory) {
      return NextResponse.json({ success: false, error: 'Inventory record not found' }, { status: 404 });
    }

    const previousStock = inventory.current_stock;
    const newStock = Math.max(0, previousStock + quantity_change);

    const { error: updateError } = await db.from('inventory')
      .update({ current_stock: newStock })
      .eq('id', inventory.id);
    if (updateError) throw updateError;

    await db.from('inventory_logs').insert({
      product_id,
      location_id,
      quantity_change,
      adjustment_reason: adjustment_reason || 'manual_adjustment',
      previous_stock: previousStock,
      new_stock: newStock,
    });

    return NextResponse.json({ success: true, data: { previous_stock: previousStock, new_stock: newStock } });
  } catch (error) {
    console.error('Error adjusting inventory:', error);
    return NextResponse.json({ success: false, error: 'Failed to adjust inventory' }, { status: 500 });
  }
}

// Direct update by inventory row ID (used by admin/manager inventory adjustment modals)
export async function PATCH(request: NextRequest) {
  try {
    const { id, current_stock } = await request.json();
    if (!id || current_stock === undefined) {
      return NextResponse.json({ success: false, error: 'id and current_stock required' }, { status: 400 });
    }
    const { data, error } = await db.from('inventory')
      .update({ current_stock: Math.max(0, current_stock) })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Error updating inventory:', error);
    return NextResponse.json({ success: false, error: 'Failed to update inventory' }, { status: 500 });
  }
}
