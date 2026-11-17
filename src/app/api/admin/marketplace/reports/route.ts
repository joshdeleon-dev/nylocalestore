import { NextRequest, NextResponse } from 'next/server';
import { requireRole, ADMIN_MANAGER } from '@/lib/apiAuth';
import { CONDITION_LABELS, RESERVATION_STATUS_LABELS, STATUS_LABELS, formatPickup, groupLabel } from '@/lib/marketplace';
import { ReportBasis, ReportItem } from '@/lib/marketplaceReport';
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

// One pivot-report row per item. 'sold' = items whose buyer paid in the range; 'all' = items submitted in the range.
async function loadReportItems(basis: ReportBasis, start: string | null, end: string | null): Promise<ReportItem[]> {
  let q = db
    .from('marketplace_listings')
    .select('id, title, condition, status, is_flagship, archived_at, locale_percent, asking_price_cents, locale_amount_cents, seller_payout_cents, created_at, category:marketplace_categories(name), seller:marketplace_sellers(name, email, phone, group_number, no_group_reason), sale:marketplace_sales' + (basis === 'sold' ? '!inner' : '') + '(reservation_id, sale_price_cents, locale_percent, locale_amount_cents, seller_payout_cents, buyer_paid_at, seller_paid_at), reservations:marketplace_reservations(id, buyer_name, buyer_email, buyer_phone, buyer_group_number, buyer_no_group_reason, pickup_type, pickup_street, pickup_unit, pickup_city, pickup_state, pickup_zip, status, created_at)')
    .order('id', { ascending: false })
    .limit(5000);
  const col = basis === 'sold' ? 'sale.buyer_paid_at' : 'created_at';
  if (start) q = q.gte(col, start);
  if (end) q = q.lt(col, end);
  const { data, error } = await q;
  if (error) throw error;

  return (data ?? []).map((l: any) => {
    const sale = (Array.isArray(l.sale) ? l.sale[0] : l.sale) ?? null;
    const reservations: any[] = l.reservations ?? [];
    // The buyer who paid, else whoever holds it now
    const buyer = (sale?.reservation_id && reservations.find((r) => r.id === sale.reservation_id))
      ?? reservations.filter((r) => r.status === 'requested' || r.status === 'confirmed').sort((a, b) => b.created_at.localeCompare(a.created_at))[0]
      ?? null;
    return {
      listing_id: l.id,
      item: l.title,
      category: l.category?.name ?? 'Uncategorized',
      condition: CONDITION_LABELS[l.condition as keyof typeof CONDITION_LABELS] ?? l.condition,
      status: STATUS_LABELS[l.status as keyof typeof STATUS_LABELS] ?? l.status,
      flagship: l.is_flagship ? 'Yes' : 'No',
      archived: l.archived_at ? 'Yes' : 'No',
      locale_percent: Number(sale?.locale_percent ?? l.locale_percent),
      submitted_date: nyDate(l.created_at),
      seller_name: l.seller?.name ?? '',
      seller_email: l.seller?.email ?? '',
      seller_phone: l.seller?.phone ?? '',
      seller_group: groupLabel(l.seller?.group_number, l.seller?.no_group_reason),
      seller_no_group_reason: l.seller?.no_group_reason ?? '',
      buyer_name: buyer?.buyer_name ?? '',
      buyer_email: buyer?.buyer_email ?? '',
      buyer_phone: buyer?.buyer_phone ?? '',
      buyer_group: buyer ? groupLabel(buyer.buyer_group_number, buyer.buyer_no_group_reason) : '',
      buyer_no_group_reason: buyer?.buyer_no_group_reason ?? '',
      pickup: buyer ? formatPickup(buyer) : '',
      reservation_status: buyer ? RESERVATION_STATUS_LABELS[buyer.status as keyof typeof RESERVATION_STATUS_LABELS] ?? buyer.status : '',
      sold_date: nyDate(sale?.buyer_paid_at ?? null),
      seller_paid: sale ? (sale.seller_paid_at ? 'Yes' : 'No') : '',
      seller_paid_date: nyDate(sale?.seller_paid_at ?? null),
      asking_price_cents: l.asking_price_cents,
      sale_price_cents: sale?.sale_price_cents ?? null,
      locale_amount_cents: sale?.locale_amount_cents ?? l.locale_amount_cents,
      seller_payout_cents: sale?.seller_payout_cents ?? l.seller_payout_cents,
    };
  });
}

// ?from=YYYY-MM-DD&to=YYYY-MM-DD (inclusive, New York days; both optional = all time)
// &view=items&basis=sold|all → pivot report rows instead of the summary
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

  if (url.searchParams.get('view') === 'items') {
    const basis: ReportBasis = url.searchParams.get('basis') === 'all' ? 'all' : 'sold';
    try {
      return NextResponse.json({ success: true, basis, items: await loadReportItems(basis, start, end) });
    } catch (e: any) {
      console.error('Report items failed:', e);
      return NextResponse.json({ success: false, error: e.message ?? 'Failed to load report' }, { status: 500 });
    }
  }

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

  const count = (status: string) => db.from('marketplace_listings').select('id', { count: 'exact', head: true }).eq('status', status).is('archived_at', null);
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

  return NextResponse.json({ success: true, summary, sales: sold });
}
