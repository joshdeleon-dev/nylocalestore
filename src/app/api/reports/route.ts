import { NextRequest, NextResponse } from 'next/server';
import { supabase, supabaseAdmin } from '@/lib/supabase';

const db = supabaseAdmin ?? supabase;

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const type = url.searchParams.get('type') || 'sales';
    const startDate = url.searchParams.get('start_date');
    const endDate = url.searchParams.get('end_date');
    const locationId = url.searchParams.get('location_id');

    if (type === 'sales') {
      return await getSalesReport(startDate, endDate, locationId);
    } else if (type === 'inventory') {
      return await getInventoryReport(locationId);
    } else {
      return NextResponse.json({ success: false, error: 'Invalid report type' }, { status: 400 });
    }
  } catch (error) {
    console.error('Error generating report:', error);
    return NextResponse.json({ success: false, error: 'Failed to generate report' }, { status: 500 });
  }
}

async function getSalesReport(
  startDate?: string | null,
  endDate?: string | null,
  locationId?: string | null
) {
  const etToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date());
  const etYesterday = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(
    new Date(Date.now() - 86400000)
  );
  const start = startDate || etYesterday;
  const end = endDate || etToday;

  let query = db
    .from('orders')
    .select('*, order_items(*, product:products(*))')
    .gte('sales_date', start)
    .lte('sales_date', end);

  if (locationId) query = query.eq('location_id', parseInt(locationId));

  const { data: orders, error } = await query;
  if (error) throw error;

  const completed = (orders || []).filter((o: any) => o.status === 'COMPLETED');
  const revenue = completed.reduce((s: number, o: any) => s + o.total, 0);
  const averageTicket = completed.length > 0 ? revenue / completed.length : 0;

  const productSales: Record<string, { quantity: number; revenue: number }> = {};
  (orders || []).forEach((order: any) => {
    (order.order_items || []).forEach((item: any) => {
      const key = item.product?.name || 'Unknown';
      if (!productSales[key]) productSales[key] = { quantity: 0, revenue: 0 };
      productSales[key].quantity += item.quantity;
      productSales[key].revenue += item.line_total;
    });
  });

  const topProducts = Object.entries(productSales)
    .sort(([, a], [, b]) => b.revenue - a.revenue)
    .slice(0, 10);

  return NextResponse.json({
    success: true,
    data: {
      period: { start, end },
      metrics: {
        revenue: Math.round(revenue * 100) / 100,
        total_orders: (orders || []).length,
        average_ticket: Math.round(averageTicket * 100) / 100,
        completed_orders: completed.length,
        cancelled_orders: (orders || []).filter((o: any) => o.status === 'CANCELLED').length,
      },
      top_products: topProducts,
    },
  });
}

async function getInventoryReport(locationId?: string | null) {
  let query = db
    .from('inventory')
    .select('*, product:products(name), location:locations(name)');

  if (locationId) query = query.eq('location_id', parseInt(locationId));

  const { data: inventory, error } = await query;
  if (error) throw error;

  return NextResponse.json({
    success: true,
    data: {
      total_items: (inventory || []).length,
      low_stock: (inventory || []).filter((i: any) => i.current_stock <= i.low_stock_threshold),
      out_of_stock: (inventory || []).filter((i: any) => i.current_stock === 0),
      inventory: inventory || [],
    },
  });
}
