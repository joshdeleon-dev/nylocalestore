import { NextRequest, NextResponse } from 'next/server';
import { supabase, supabaseAdmin } from '@/lib/supabase';
import { generateOrderNumber, calculateTax, calculateTotal } from '@/utils/helpers';

// Returns the current business date in Eastern time (NY): "2024-12-24"
// Needed so late-night orders record the correct NY date, not the next UTC day
function salesDateEastern(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date());
}

const db = supabaseAdmin ?? supabase;

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const status = url.searchParams.get('status');
    const statuses = url.searchParams.get('statuses');
    const startDate = url.searchParams.get('start_date');
    const limit = parseInt(url.searchParams.get('limit') || '100');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    let query = db
      .from('orders')
      .select('*, order_items(*, order_item_modifiers(*), product:products(id, name))', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) query = query.eq('status', status);
    else if (statuses) query = query.in('status', statuses.split(','));
    if (startDate) query = query.gte('sales_date', startDate);

    const { data, count, error } = await query;
    if (error) throw error;

    const mapped = (data || []).map((order: any) => ({
      ...order,
      items: (order.order_items || []).map((item: any) => ({
        ...item,
        modifiers: item.order_item_modifiers || [],
      })),
    }));

    return NextResponse.json({
      success: true,
      data: mapped,
      total: count,
      page: Math.floor(offset / limit) + 1,
      per_page: limit,
      total_pages: Math.ceil((count || 0) / limit),
    });
  } catch (error: any) {
    console.error('Error fetching orders:', error);
    return NextResponse.json({ success: false, error: error.message || 'Failed to fetch orders' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      customer_name,
      customer_phone,
      group_number,
      items,
      notes,
      payment_method = 'CASH',
      tax_rate = 0,
      order_date: clientOrderDate,
      sales_date: clientSalesDate,
    } = body;

    if (!customer_name || group_number == null || !items || items.length === 0) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }

    // Calculate subtotal using provided unit_price or look up base_price
    let subtotal = 0;
    const enrichedItems: { product_id: number; quantity: number; unit_price: number; line_total: number; modifiers: any[] }[] = [];

    for (const item of items) {
      let unitPrice = item.unit_price;
      if (!unitPrice) {
        const { data: product } = await db.from('products').select('base_price').eq('id', item.product_id).single();
        if (!product) continue;
        unitPrice = product.base_price;
      }
      const modifierPrice = (item.modifiers || []).reduce((sum: number, m: any) => sum + (m.price_adjustment || 0), 0);
      unitPrice = unitPrice + modifierPrice;
      const lineTotal = unitPrice * item.quantity;
      subtotal += lineTotal;
      enrichedItems.push({ product_id: item.product_id, quantity: item.quantity, unit_price: unitPrice, line_total: lineTotal, modifiers: item.modifiers || [] });
    }

    const tax = calculateTax(subtotal, tax_rate);
    const total = calculateTotal(subtotal, tax);

    // Create order
    const { data: order, error: orderError } = await db
      .from('orders')
      .insert({
        order_number: generateOrderNumber(),
        customer_name,
        customer_phone: customer_phone || null,
        group_number: Number(group_number),
        status: 'NEW',
        payment_method,
        payment_status: 'PENDING',
        subtotal,
        tax,
        total,
        notes: notes || null,
        order_date: clientOrderDate || new Date().toISOString(),
        sales_date: clientSalesDate || salesDateEastern(),
      })
      .select()
      .single();

    if (orderError) throw orderError;

    // Insert order items and modifiers
    for (const item of enrichedItems) {
      const { data: orderItem, error: itemError } = await db
        .from('order_items')
        .insert({
          order_id: order.id,
          product_id: item.product_id,
          quantity: item.quantity,
          unit_price: item.unit_price,
          line_total: item.line_total,
        })
        .select()
        .single();

      if (itemError) throw itemError;

      for (const modifier of item.modifiers) {
        if (!modifier.id) continue;
        await db.from('order_item_modifiers').insert({
          order_item_id: orderItem.id,
          modifier_id: modifier.id,
          name: modifier.name,
          price_adjustment: modifier.price_adjustment || 0,
        });
      }

      // Deduct from inventory (location 1 = NY Locale Store - Downtown)
      const { data: inv } = await db.from('inventory')
        .select('id, current_stock')
        .eq('product_id', item.product_id)
        .eq('location_id', 1)
        .single();
      if (inv && inv.current_stock > 0) {
        await db.from('inventory')
          .update({ current_stock: Math.max(0, inv.current_stock - item.quantity) })
          .eq('id', inv.id);
      }
    }

    return NextResponse.json({ success: true, data: order }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating order:', error);
    return NextResponse.json({ success: false, error: error.message || 'Failed to create order' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const token = request.headers.get('authorization')?.slice(7);
  if (!token) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  const { data: { user } } = await db.auth.getUser(token);
  if (!user) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  const { data: profile } = await db.from('users').select('*, role:roles(name)').eq('id', user.id).single();
  if (!['ADMIN', 'MANAGER'].includes((profile as any)?.role?.name)) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }
  try {
    const { ids } = await request.json();
    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ success: false, error: 'ids array required' }, { status: 400 });
    }
    let deleted = 0;
    for (const orderId of ids as number[]) {
      const { data: orderItems } = await db.from('order_items').select('product_id, quantity').eq('order_id', orderId);
      for (const item of (orderItems || []) as { product_id: number; quantity: number }[]) {
        const { data: inv } = await db.from('inventory').select('id, current_stock').eq('product_id', item.product_id).eq('location_id', 1).single();
        if (inv) await db.from('inventory').update({ current_stock: (inv as any).current_stock + item.quantity }).eq('id', (inv as any).id);
      }
      const { error } = await db.from('orders').delete().eq('id', orderId);
      if (!error) deleted++;
    }
    return NextResponse.json({ success: true, deleted });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Failed to delete orders' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { id, ...updates } = await request.json();
    if (!id) return NextResponse.json({ success: false, error: 'id required' }, { status: 400 });

    // Auto-set timestamp fields
    if (updates.status === 'COMPLETED' && !updates.completed_date) {
      updates.completed_date = new Date().toISOString();
    }
    if (updates.status === 'CANCELLED' && !updates.cancelled_date) {
      updates.cancelled_date = new Date().toISOString();
    }

    const { data, error } = await db.from('orders').update(updates).eq('id', id).select().single();
    if (error) throw error;
    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('Error updating order:', error);
    return NextResponse.json({ success: false, error: error.message || 'Failed to update order' }, { status: 500 });
  }
}
