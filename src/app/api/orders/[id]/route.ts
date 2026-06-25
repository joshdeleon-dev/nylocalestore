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
  if (!['ADMIN', 'MANAGER'].includes(role)) return null;
  return user;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const { data, error } = await db
      .from('orders')
      .select('*, order_items(*, order_item_modifiers(*), product:products(id, name, base_price, image_url))')
      .eq('id', parseInt(id))
      .single();

    if (error) throw error;
    if (!data) {
      return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });
    }

    const order = {
      ...data,
      items: (data.order_items || []).map((item: any) => ({
        ...item,
        modifiers: item.order_item_modifiers || [],
      })),
    };

    return NextResponse.json({ success: true, data: order });
  } catch (error) {
    console.error('Error fetching order:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch order' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!await verifyStaff(request)) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { id } = await params;
    const orderId = parseInt(id);
    const body = await request.json();
    const {
      customer_name,
      customer_phone,
      group_number,
      payment_method,
      notes,
      order_date,
      sales_date,
      items,
    } = body;

    if (!customer_name || !items || items.length === 0) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }

    // 1. Restore inventory for existing items before replacing them
    const { data: oldItems } = await db
      .from('order_items')
      .select('product_id, quantity')
      .eq('order_id', orderId);

    for (const item of (oldItems || []) as { product_id: number; quantity: number }[]) {
      const { data: inv } = await db
        .from('inventory')
        .select('id, current_stock')
        .eq('product_id', item.product_id)
        .eq('location_id', 1)
        .single();
      if (inv) {
        await db
          .from('inventory')
          .update({ current_stock: (inv as any).current_stock + item.quantity })
          .eq('id', (inv as any).id);
      }
    }

    // 2. Delete old order items (FK cascades to order_item_modifiers)
    await db.from('order_items').delete().eq('order_id', orderId);

    // 3. Build new items and calculate totals
    let subtotal = 0;
    const enriched: { product_id: number; quantity: number; unit_price: number; line_total: number; modifiers: any[] }[] = [];

    for (const item of items) {
      let unitPrice = item.unit_price;
      if (!unitPrice) {
        const { data: product } = await db.from('products').select('base_price').eq('id', item.product_id).single();
        unitPrice = (product as any)?.base_price || 0;
      }
      const lineTotal = unitPrice * item.quantity;
      subtotal += lineTotal;
      enriched.push({ product_id: item.product_id, quantity: item.quantity, unit_price: unitPrice, line_total: lineTotal, modifiers: item.modifiers || [] });
    }

    const total = Math.round(subtotal * 100) / 100;

    // 4. Insert new order items and deduct inventory
    for (const item of enriched) {
      const { data: orderItem, error: itemErr } = await db
        .from('order_items')
        .insert({ order_id: orderId, product_id: item.product_id, quantity: item.quantity, unit_price: item.unit_price, line_total: item.line_total })
        .select()
        .single();
      if (itemErr) throw itemErr;

      for (const mod of item.modifiers) {
        await db.from('order_item_modifiers').insert({
          order_item_id: (orderItem as any).id,
          modifier_id: mod.id,
          name: mod.name,
          price_adjustment: mod.price_adjustment || 0,
        });
      }

      const { data: inv } = await db
        .from('inventory')
        .select('id, current_stock')
        .eq('product_id', item.product_id)
        .eq('location_id', 1)
        .single();
      if (inv && (inv as any).current_stock > 0) {
        await db
          .from('inventory')
          .update({ current_stock: Math.max(0, (inv as any).current_stock - item.quantity) })
          .eq('id', (inv as any).id);
      }
    }

    // 5. Update the order record
    const { data: order, error } = await db
      .from('orders')
      .update({
        customer_name,
        customer_phone: customer_phone || null,
        group_number: Number(group_number) || 1,
        payment_method,
        notes: notes || null,
        order_date,
        sales_date,
        subtotal,
        tax: 0,
        total,
      })
      .eq('id', orderId)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, data: order });
  } catch (error) {
    console.error('Error editing order:', error);
    return NextResponse.json({ success: false, error: 'Failed to update order' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!await verifyStaff(request)) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { id } = await params;
    const orderId = parseInt(id);

    // Fetch order items to restore inventory
    const { data: orderItems } = await db
      .from('order_items')
      .select('product_id, quantity')
      .eq('order_id', orderId);

    // Restore inventory for each item
    if (orderItems && orderItems.length > 0) {
      for (const item of orderItems as { product_id: number; quantity: number }[]) {
        const { data: inv } = await db
          .from('inventory')
          .select('id, current_stock')
          .eq('product_id', item.product_id)
          .eq('location_id', 1)
          .single();

        if (inv) {
          await db
            .from('inventory')
            .update({ current_stock: (inv as any).current_stock + item.quantity })
            .eq('id', (inv as any).id);
        }
      }
    }

    // Delete the order (FK cascades remove order_items + order_item_modifiers)
    const { error } = await db.from('orders').delete().eq('id', orderId);
    if (error) throw error;

    return NextResponse.json({ success: true, message: 'Order deleted and inventory restored' });
  } catch (error) {
    console.error('Error deleting order:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete order' }, { status: 500 });
  }
}
