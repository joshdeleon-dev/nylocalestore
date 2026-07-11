import { NextRequest, NextResponse } from 'next/server';
import { supabase, supabaseAdmin } from '@/lib/supabase';

const db = supabaseAdmin ?? supabase;

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date());
    const startDate = url.searchParams.get('start_date') || today;
    const endDate   = url.searchParams.get('end_date')   || today;
    const groupNum  = url.searchParams.get('group_number');

    let ordersQuery = db
      .from('orders')
      .select('total, status')
      .gte('sales_date', startDate)
      .lte('sales_date', endDate);

    if (groupNum) ordersQuery = ordersQuery.eq('group_number', parseInt(groupNum));

    const [ordersRes, activeRes, invRes] = await Promise.all([
      ordersQuery,
      db.from('orders').select('id').in('status', ['NEW', 'ACCEPTED', 'IN_PROGRESS', 'READY']),
      db.from('inventory').select('current_stock, low_stock_threshold'),
    ]);

    const orders = ordersRes.data || [];
    const completed = orders.filter((o) => o.status === 'COMPLETED');
    const revenue = completed.reduce((s: number, o: any) => s + Number(o.total), 0);
    const avg = completed.length ? revenue / completed.length : 0;
    const lowStock = (invRes.data || []).filter(
      (i: any) => i.current_stock <= i.low_stock_threshold
    ).length;

    return NextResponse.json({
      revenue_today: revenue,
      orders_today: orders.length,
      avg_order_value: avg,
      active_orders: (activeRes.data || []).length,
      low_stock_count: lowStock,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
