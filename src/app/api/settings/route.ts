import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const locationId = url.searchParams.get('location_id');

    let query = supabase.from('locations').select('*').eq('is_active', true);
    if (locationId) query = query.eq('id', locationId);

    const { data, error } = await query.limit(1).single();
    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to fetch settings' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { location_id, name, address, phone, tax_rate, estimated_wait_time, store_status, ordering_status } = body;

    if (!location_id) {
      return NextResponse.json({ success: false, error: 'location_id is required' }, { status: 400 });
    }

    const updates: Record<string, any> = {};
    if (name !== undefined) updates.name = name;
    if (address !== undefined) updates.address = address;
    if (phone !== undefined) updates.phone = phone;
    if (tax_rate !== undefined) updates.tax_rate = tax_rate;
    if (estimated_wait_time !== undefined) updates.estimated_wait_time = estimated_wait_time;
    if (store_status !== undefined) updates.store_status = store_status;
    if (ordering_status !== undefined) updates.ordering_status = ordering_status;

    const { data, error } = await supabase
      .from('locations')
      .update(updates)
      .eq('id', location_id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to update settings' }, { status: 500 });
  }
}
