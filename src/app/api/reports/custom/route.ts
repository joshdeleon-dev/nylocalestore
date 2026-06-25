import { NextRequest, NextResponse } from 'next/server';
import { supabase, supabaseAdmin } from '@/lib/supabase';

const db = supabaseAdmin ?? supabase;

const CURRENCY_FIELDS = new Set(['subtotal', 'tax', 'total', 'unit_price', 'line_total']);
const DATE_FIELDS = new Set(['order_date', 'sales_date', 'created_at', 'updated_at', 'completed_date', 'cancelled_date']);
const ITEM_FIELDS = new Set(['product_name', 'category', 'quantity', 'unit_price', 'line_total', 'modifiers']);

function fmtCurrency(v: any) {
  if (v === null || v === undefined) return '';
  return `$${Number(v).toFixed(2)}`;
}

const ET = 'America/New_York';

function fmtDate(v: any) {
  if (!v) return '';
  // Date-only strings (YYYY-MM-DD) — parse components to avoid UTC midnight shift
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
    const [y, m, d] = (v as string).split('-').map(Number);
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric', month: 'short', day: 'numeric', timeZone: ET,
    }).format(new Date(y, m - 1, d));
  }
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZone: ET,
  }).format(new Date(v));
}

function fmtValue(field: string, value: any) {
  if (value === null || value === undefined) return '';
  if (CURRENCY_FIELDS.has(field)) return fmtCurrency(value);
  if (DATE_FIELDS.has(field)) return fmtDate(value);
  return String(value);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { source, fields, filters = {} } = body as {
      source: 'orders' | 'inventory';
      fields: string[];
      filters: { start_date?: string; end_date?: string; status?: string };
    };

    if (!fields?.length) {
      return NextResponse.json({ error: 'No fields selected' }, { status: 400 });
    }

    if (source === 'orders') return ordersReport(fields, filters);
    if (source === 'inventory') return inventoryReport(fields);

    return NextResponse.json({ error: 'Invalid source' }, { status: 400 });
  } catch (err) {
    console.error('Custom report error:', err);
    return NextResponse.json({ error: 'Failed to generate report' }, { status: 500 });
  }
}

async function ordersReport(
  fields: string[],
  filters: { start_date?: string; end_date?: string; status?: string }
) {
  const needsItems = fields.some((f) => ITEM_FIELDS.has(f));

  const selectStr = needsItems
    ? `order_number, status, order_date, sales_date, created_at, updated_at, completed_date, cancelled_date, payment_method, payment_status, subtotal, tax, total, customer_name, customer_phone, group_number, notes, order_items(quantity, unit_price, line_total, product:products(name, category:categories(name)), order_item_modifiers(name))`
    : `order_number, status, order_date, sales_date, created_at, updated_at, completed_date, cancelled_date, payment_method, payment_status, subtotal, tax, total, customer_name, customer_phone, group_number, notes`;

  let query = db.from('orders').select(selectStr).order('created_at', { ascending: false }).limit(2000);

  if (filters.start_date) query = query.gte('sales_date', filters.start_date);
  if (filters.end_date) query = query.lte('sales_date', filters.end_date);
  if (filters.status) query = query.eq('status', filters.status);

  const { data: orders, error } = await query;
  if (error) throw error;

  const orderFields = fields.filter((f) => !ITEM_FIELDS.has(f));

  const rows: Record<string, string | number>[] = [];

  for (const order of orders ?? []) {
    const base: Record<string, string | number> = {};
    for (const f of orderFields) base[f] = fmtValue(f, (order as any)[f]);

    if (needsItems) {
      const items: any[] = (order as any).order_items ?? [];
      if (items.length === 0) {
        // Order with no items — emit one row with blank item fields
        const row = { ...base };
        for (const f of fields) if (ITEM_FIELDS.has(f)) row[f] = '';
        rows.push(row);
      } else {
        for (const item of items) {
          const row = { ...base };
          if (fields.includes('product_name')) row.product_name = item.product?.name ?? '';
          if (fields.includes('category')) row.category = item.product?.category?.name ?? '';
          if (fields.includes('quantity')) row.quantity = item.quantity ?? 0;
          if (fields.includes('unit_price')) row.unit_price = fmtCurrency(item.unit_price);
          if (fields.includes('line_total')) row.line_total = fmtCurrency(item.line_total);
          if (fields.includes('modifiers'))
            row.modifiers = ((item.order_item_modifiers as any[]) ?? []).map((m) => m.name).join(', ');
          rows.push(row);
        }
      }
    } else {
      rows.push(base);
    }
  }

  return NextResponse.json({ rows, total: rows.length });
}

async function inventoryReport(fields: string[]) {
  const needsLogs = fields.some((f) => ['quantity_change', 'adjustment_reason'].includes(f));

  if (needsLogs) {
    const { data: logs, error } = await db
      .from('inventory_logs')
      .select('quantity_change, adjustment_reason, new_stock, product:products(name)')
      .order('created_at', { ascending: false })
      .limit(2000);

    if (error) throw error;

    const rows = (logs ?? []).map((log: any) => {
      const row: Record<string, string | number> = {};
      if (fields.includes('product_name')) row.product_name = log.product?.name ?? '';
      if (fields.includes('current_stock')) row.current_stock = log.new_stock ?? 0;
      if (fields.includes('quantity_change')) row.quantity_change = log.quantity_change ?? 0;
      if (fields.includes('adjustment_reason')) row.adjustment_reason = log.adjustment_reason ?? '';
      return row;
    });

    return NextResponse.json({ rows, total: rows.length });
  }

  const { data: inv, error } = await db
    .from('inventory')
    .select('current_stock, product:products(name)')
    .order('product_id');

  if (error) throw error;

  const rows = (inv ?? []).map((i: any) => {
    const row: Record<string, string | number> = {};
    if (fields.includes('product_name')) row.product_name = i.product?.name ?? '';
    if (fields.includes('current_stock')) row.current_stock = i.current_stock ?? 0;
    return row;
  });

  return NextResponse.json({ rows, total: rows.length });
}
