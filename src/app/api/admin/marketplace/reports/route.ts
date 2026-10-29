import { NextRequest, NextResponse } from 'next/server';
import { requireRole, ADMIN_MANAGER } from '@/lib/apiAuth';
import { CONDITION_LABELS } from '@/lib/marketplace';
import { db } from '@/lib/marketplaceServer';

// UTC instant of midnight in New York on the given YYYY-MM-DD (handles daylight saving)
function nyMidnight(date: string) {
  const [y, m, d] = date.split('-').map(Number);
  const guess = Date.UTC(y, m - 1, d, 5); // 05:00 UTC ≈ midnight NY
  const nyHour = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', hourCycle: 'h23' }).format(guess));
  return new Date(guess - nyHour * 3_600_000);
}

const isDate = (s: string | null): s is string => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
const sum = (rows: any[], key: string) => rows.reduce((t, r) => t + (r[key] ?? 0), 0);
const nyDate = (iso: string | null) => (iso ? new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date(iso)) : '');

// ?from=YYYY-MM-DD&to=YYYY-MM-DD (inclusive, New York days; both optional = all time) &format=csv
export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ADMIN_MANAGER);
  if (auth instanceof NextResponse) return auth;

  const url = new URL(req.url);
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');
  if ((from && !isDate(from)) || (to && !isDate(to))) {
    return NextResponse.json({ success: false, error: 'Dates must be YYYY-MM-DD' }, { status: 400 });
  }
  const start = isDate(from) ? nyMidnight(from).toISOString() : null;
  const end = isDate(to) ? new Date(nyMidnight(to).getTime() + 86_400_000).toISOString() : null; // exclusive

  // Sales whose buyer paid within the range
  let salesQuery = db
    .from('marketplace_sales')
    .select('*, listing:marketplace_listings(id, title, condition, status, category:marketplace_categories(name), seller:marketplace_sellers(name, phone, email)), reservation:marketplace_reservations(buyer_name, buyer_phone, buyer_email)')
    .order('buyer_paid_at', { ascending: false });
  if (start) salesQuery = salesQuery.gte('buyer_paid_at', start);
  if (end) salesQuery = salesQuery.lt('buyer_paid_at', end);

  // Seller payouts made within the range (may belong to sales from earlier ranges)
  let payoutsQuery = db.from('marketplace_sales').select('seller_payout_cents').not('seller_paid_at', 'is', null);
  if (start) payoutsQuery = payoutsQuery.gte('seller_paid_at', start);
  if (end) payoutsQuery = payoutsQuery.lt('seller_paid_at', end);

  const count = (status: string) => db.from('marketplace_listings').select('id', { count: 'exact', head: true }).eq('status', status);
  const [sales, payouts, owed, submitted, published, reserved, openReservations] = await Promise.all([
    salesQuery,
    payoutsQuery,
    db.from('marketplace_sales').select('seller_payout_cents').is('seller_paid_at', null),
    count('submitted'),
    count('published'),
    count('reserved'),
    db.from('marketplace_reservations').select('id', { count: 'exact', head: true }).in('status', ['requested', 'confirmed']),
  ]);
  if (sales.error) return NextResponse.json({ success: false, error: sales.error.message }, { status: 500 });

  const rows = sales.data ?? [];
  const actorIds = [...new Set(rows.flatMap((r: any) => [r.buyer_paid_by, r.seller_paid_by]).filter(Boolean))];
  const { data: actors } = actorIds.length ? await db.from('users').select('id, full_name').in('id', actorIds) : { data: [] as any[] };
  const names = new Map((actors ?? []).map((a: any) => [a.id, a.full_name]));

  const sold = rows.map((r: any) => ({
    listing_id: r.listing_id,
    title: r.listing?.title ?? '',
    category: r.listing?.category?.name ?? '',
    condition: r.listing ? CONDITION_LABELS[r.listing.condition as keyof typeof CONDITION_LABELS] : '',
    status: r.seller_paid_at ? 'Sold' : 'Awaiting seller payout',
    seller_name: r.listing?.seller?.name ?? '',
    seller_phone: r.listing?.seller?.phone ?? '',
    buyer_name: r.reservation?.buyer_name ?? '',
    buyer_phone: r.reservation?.buyer_phone ?? '',
    sale_price_cents: r.sale_price_cents,
    locale_percent: Number(r.locale_percent),
    locale_amount_cents: r.locale_amount_cents,
    seller_payout_cents: r.seller_payout_cents,
    buyer_paid_at: r.buyer_paid_at,
    buyer_paid_by: names.get(r.buyer_paid_by) ?? '',
    seller_paid_at: r.seller_paid_at,
    seller_paid_by: names.get(r.seller_paid_by) ?? '',
  }));

  const summary = {
    from: from ?? null,
    to: to ?? null,
    sales_count: rows.length,
    sold_count: rows.filter((r: any) => r.seller_paid_at).length,
    total_sales_cents: sum(rows, 'sale_price_cents'),
    locale_total_cents: sum(rows, 'locale_amount_cents'),
    seller_share_cents: sum(rows, 'seller_payout_cents'),
    paid_to_sellers_cents: sum(payouts.data ?? [], 'seller_payout_cents'),
    // Current balances, regardless of range
    owed_to_sellers_cents: sum(owed.data ?? [], 'seller_payout_cents'),
    awaiting_payout_count: owed.data?.length ?? 0,
    pending_submissions: submitted.count ?? 0,
    live_listings: published.count ?? 0,
    awaiting_buyer_payment: reserved.count ?? 0,
    open_reservations: openReservations.count ?? 0,
  };

  if (url.searchParams.get('format') === 'csv') {
    const money = (c: number) => (c / 100).toFixed(2);
    const header = ['Listing ID', 'Item', 'Category', 'Condition', 'Status', 'Seller', 'Seller phone', 'Buyer', 'Buyer phone', 'Sale price', 'For Locale %', 'For Locale', 'Seller payout', 'Buyer paid (date)', 'Buyer paid (by)', 'Seller paid (date)', 'Seller paid (by)'];
    const lines = sold.map((s) => [
      s.listing_id, s.title, s.category, s.condition, s.status, s.seller_name, s.seller_phone, s.buyer_name, s.buyer_phone,
      money(s.sale_price_cents), s.locale_percent, money(s.locale_amount_cents), money(s.seller_payout_cents),
      nyDate(s.buyer_paid_at), s.buyer_paid_by, nyDate(s.seller_paid_at), s.seller_paid_by,
    ]);
    lines.push([], ['Totals', '', '', '', `${summary.sales_count} sales`, '', '', '', '', money(summary.total_sales_cents), '', money(summary.locale_total_cents), money(summary.seller_share_cents)]);
    // Quote every cell; neutralise spreadsheet formulas in user-entered text
    const cell = (v: unknown) => {
      let s = String(v ?? '');
      if (/^[=+\-@\t\r]/.test(s) && Number.isNaN(Number(s))) s = `'${s}`;
      return `"${s.replace(/"/g, '""')}"`;
    };
    const csv = [header, ...lines].map((l) => l.map(cell).join(',')).join('\r\n');
    const name = `marketplace-sales_${from ?? 'all'}_${to ?? 'time'}.csv`;
    return new NextResponse('﻿' + csv, {
      headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${name}"` },
    });
  }

  return NextResponse.json({ success: true, summary, sales: sold });
}
