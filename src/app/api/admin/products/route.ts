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

async function upsertInventory(productId: number, stock: number) {
  const { data: existing } = await db.from('inventory')
    .select('id')
    .eq('product_id', productId)
    .eq('location_id', 1)
    .single();

  if (existing) {
    // Never overwrite original_stock — only current_stock changes after creation
    await db.from('inventory').update({ current_stock: stock }).eq('id', existing.id);
  } else {
    await db.from('inventory').insert({
      product_id: productId, location_id: 1,
      current_stock: stock, original_stock: stock,
      low_stock_threshold: 5, unit_of_measure: 'units',
    });
  }
}

export async function POST(req: NextRequest) {
  if (!await verifyStaff(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try {
    const { modifier_group_ids = [], stock, ...payload } = await req.json();
    const { data, error } = await db.from('products').insert(payload).select().single();
    if (error) throw error;
    if (modifier_group_ids.length > 0) {
      await db.from('product_modifier_groups').insert(
        modifier_group_ids.map((id: number, i: number) => ({
          product_id: data.id, modifier_group_id: id, display_order: i,
        }))
      );
    }
    // Always create an inventory record for new products; default to 0 if stock not provided
    await upsertInventory(data.id, stock !== undefined && stock !== '' ? parseInt(stock) || 0 : 0);
    return NextResponse.json({ product: data });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  if (!await verifyStaff(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try {
    const { id, modifier_group_ids, stock, ...payload } = await req.json();
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    const { data, error } = await db.from('products').update(payload).eq('id', id).select().single();
    if (error) throw error;
    if (modifier_group_ids !== undefined) {
      await db.from('product_modifier_groups').delete().eq('product_id', id);
      if (modifier_group_ids.length > 0) {
        await db.from('product_modifier_groups').insert(
          modifier_group_ids.map((mgId: number, i: number) => ({
            product_id: id, modifier_group_id: mgId, display_order: i,
          }))
        );
      }
    }
    if (stock !== undefined && stock !== '') {
      await upsertInventory(id, parseInt(stock) || 0);
    }
    return NextResponse.json({ product: data });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  if (!await verifyStaff(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    const productId = parseInt(id);

    // If order_items reference this product, soft-delete to preserve order history
    const { count } = await db.from('order_items').select('id', { count: 'exact', head: true }).eq('product_id', productId);
    if (count && count > 0) {
      const { error } = await db.from('products').update({ is_available: false }).eq('id', productId);
      if (error) throw error;
      return NextResponse.json({ ok: true, softDeleted: true });
    }

    // No order history — safe to hard delete
    await db.from('inventory').delete().eq('product_id', productId);
    await db.from('product_modifier_groups').delete().eq('product_id', productId);

    const { error } = await db.from('products').delete().eq('id', productId);
    if (error) throw error;
    return NextResponse.json({ ok: true, softDeleted: false });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
