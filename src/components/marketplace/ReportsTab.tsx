'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useTableSort } from '@/hooks/useTableSort';
import { SortableHeader } from '@/components/SortableHeader';
import { formatCents } from '@/lib/marketplace';

export interface ReportSummary {
  sales_count: number;
  sold_count: number;
  total_sales_cents: number;
  locale_total_cents: number;
  seller_share_cents: number;
  paid_to_sellers_cents: number;
  owed_to_sellers_cents: number;
  awaiting_payout_count: number;
  pending_submissions: number;
  live_listings: number;
  awaiting_buyer_payment: number;
  open_reservations: number;
}

interface SaleRow {
  listing_id: number;
  title: string;
  category: string;
  status: string;
  seller_name: string;
  buyer_name: string;
  sale_price_cents: number;
  locale_percent: number;
  locale_amount_cents: number;
  seller_payout_cents: number;
  buyer_paid_at: string;
  seller_paid_at: string | null;
}

// Dates are New York calendar days
export const nyToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date());

type Preset = 'this_month' | 'last_month' | 'this_year' | 'all' | 'custom';

function presetRange(p: Preset): { from: string; to: string } {
  const today = nyToday();
  const [y, m] = today.split('-').map(Number);
  const pad = (n: number) => String(n).padStart(2, '0');
  const lastDay = (yy: number, mm: number) => new Date(Date.UTC(yy, mm, 0)).getUTCDate();
  if (p === 'this_month') return { from: `${y}-${pad(m)}-01`, to: today };
  if (p === 'last_month') {
    const ly = m === 1 ? y - 1 : y, lm = m === 1 ? 12 : m - 1;
    return { from: `${ly}-${pad(lm)}-01`, to: `${ly}-${pad(lm)}-${pad(lastDay(ly, lm))}` };
  }
  if (p === 'this_year') return { from: `${y}-01-01`, to: today };
  return { from: '', to: '' };
}

const PRESETS: { key: Preset; label: string }[] = [
  { key: 'this_month', label: 'This month' },
  { key: 'last_month', label: 'Last month' },
  { key: 'this_year', label: 'This year' },
  { key: 'all', label: 'All time' },
  { key: 'custom', label: 'Custom' },
];

export function StatTile({ label, value, hint, tone = 'default' }: { label: string; value: string; hint?: string; tone?: 'default' | 'accent' | 'warn' }) {
  const tones = { default: 'bg-white', accent: 'bg-coffee-900 text-white', warn: 'bg-amber-50 border-amber-200' };
  return (
    <div className={`rounded-xl border border-coffee-100 p-4 ${tones[tone]}`}>
      <p className={`text-xs font-medium uppercase tracking-wider ${tone === 'accent' ? 'text-coffee-200' : 'text-coffee-500'}`}>{label}</p>
      <p className={`text-2xl font-semibold mt-1 tabular-nums ${tone === 'accent' ? 'text-white' : 'text-gray-900'}`}>{value}</p>
      {hint && <p className={`text-xs mt-0.5 ${tone === 'accent' ? 'text-coffee-300' : 'text-coffee-500'}`}>{hint}</p>}
    </div>
  );
}

export function ReportsTab() {
  const [preset, setPreset] = useState<Preset>('this_month');
  const [range, setRange] = useState(presetRange('this_month'));
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [sales, setSales] = useState<SaleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  const { sorted: sortedSales, sortKey, sortDir, requestSort } = useTableSort(sales, {
    paid: (s) => new Date(s.buyer_paid_at).getTime(),
    item: (s) => s.title,
    buyer: (s) => s.buyer_name || null,
    seller: (s) => s.seller_name,
    price: (s) => s.sale_price_cents,
    locale: (s) => s.locale_amount_cents,
    payout: (s) => s.seller_payout_cents,
    status: (s) => (s.seller_paid_at ? 'Sold' : 'Awaiting payout'),
  });

  const query = () => {
    const p = new URLSearchParams();
    if (range.from) p.set('from', range.from);
    if (range.to) p.set('to', range.to);
    return p;
  };

  // Ignore responses for a range the user has already moved away from
  const latestRequest = useRef(0);

  const load = useCallback(async () => {
    if (range.from && range.to && range.from > range.to) return;
    const requestId = ++latestRequest.current;
    setLoading(true);
    const res = await fetch(`/api/admin/marketplace/reports?${query()}`);
    const json = await res.json();
    if (requestId !== latestRequest.current) return;
    if (res.ok) { setSummary(json.summary); setSales(json.sales); }
    else toast.error(json.error || 'Failed to load report');
    setLoading(false);
  }, [range]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  const choose = (p: Preset) => {
    setPreset(p);
    if (p !== 'custom') setRange(presetRange(p));
  };

  // Fetch (so the auth header is attached) and save the CSV
  const download = async () => {
    setDownloading(true);
    const q = query(); q.set('format', 'csv');
    const res = await fetch(`/api/admin/marketplace/reports?${q}`);
    setDownloading(false);
    if (!res.ok) { toast.error('Download failed'); return; }
    const blob = await res.blob();
    const name = /filename="([^"]+)"/.exec(res.headers.get('content-disposition') ?? '')?.[1] ?? 'marketplace-sales.csv';
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.key}
            onClick={() => choose(p.key)}
            className={`px-4 py-1.5 rounded-full text-sm border transition-colors ${
              preset === p.key ? 'bg-coffee-900 text-white border-coffee-900' : 'bg-white text-coffee-700 border-coffee-200 hover:bg-coffee-50'
            }`}
          >
            {p.label}
          </button>
        ))}
        {preset === 'custom' && (
          <div className="flex items-center gap-2">
            <input type="date" className="input py-1.5 w-auto" value={range.from} max={range.to || undefined} onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))} aria-label="From" />
            <span className="text-coffee-400">–</span>
            <input type="date" className="input py-1.5 w-auto" value={range.to} min={range.from || undefined} onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))} aria-label="To" />
          </div>
        )}
        <button onClick={download} disabled={downloading || loading} className="btn btn-secondary gap-2 ml-auto">
          {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} Download CSV
        </button>
      </div>

      {loading || !summary ? (
        <div className="card p-10 text-center text-sm text-coffee-400">Loading…</div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <StatTile label="Total sales" value={formatCents(summary.total_sales_cents)} hint={`${summary.sales_count} item${summary.sales_count === 1 ? '' : 's'} paid for`} tone="accent" />
            <StatTile label="For Locale" value={formatCents(summary.locale_total_cents)} hint="Donations from these sales" />
            <StatTile label="Sellers’ share" value={formatCents(summary.seller_share_cents)} hint="From these sales" />
            <StatTile label="Paid to sellers" value={formatCents(summary.paid_to_sellers_cents)} hint="Payouts made in this period" />
            <StatTile label="Owed to sellers" value={formatCents(summary.owed_to_sellers_cents)} hint={`${summary.awaiting_payout_count} awaiting payout · right now`} tone={summary.owed_to_sellers_cents > 0 ? 'warn' : 'default'} />
          </div>

          <div className="card overflow-hidden">
            {sales.length === 0 ? (
              <div className="p-10 text-center text-sm text-coffee-400">No sales in this period.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-coffee-50 text-left text-xs uppercase tracking-wider text-coffee-500">
                    <tr>
                      <SortableHeader label="Paid on" sortKey="paid" currentKey={sortKey} dir={sortDir} onSort={requestSort} className="!px-4" />
                      <SortableHeader label="Item" sortKey="item" currentKey={sortKey} dir={sortDir} onSort={requestSort} className="!px-4" />
                      <SortableHeader label="Buyer" sortKey="buyer" currentKey={sortKey} dir={sortDir} onSort={requestSort} className="!px-4" />
                      <SortableHeader label="Seller" sortKey="seller" currentKey={sortKey} dir={sortDir} onSort={requestSort} className="!px-4" />
                      <SortableHeader label="Sale price" sortKey="price" currentKey={sortKey} dir={sortDir} onSort={requestSort} className="!px-4" align="right" />
                      <SortableHeader label="For Locale" sortKey="locale" currentKey={sortKey} dir={sortDir} onSort={requestSort} className="!px-4" align="right" />
                      <SortableHeader label="Seller payout" sortKey="payout" currentKey={sortKey} dir={sortDir} onSort={requestSort} className="!px-4" align="right" />
                      <SortableHeader label="Status" sortKey="status" currentKey={sortKey} dir={sortDir} onSort={requestSort} className="!px-4" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-coffee-100">
                    {sortedSales.map((s) => (
                      <tr key={s.listing_id}>
                        <td className="px-4 py-3 whitespace-nowrap text-coffee-600">{new Date(s.buyer_paid_at).toLocaleDateString('en-US', { timeZone: 'America/New_York' })}</td>
                        <td className="px-4 py-3"><p className="text-gray-900">{s.title}</p><p className="text-xs text-coffee-400">{s.category || 'Uncategorized'}</p></td>
                        <td className="px-4 py-3 text-gray-900">{s.buyer_name || '—'}</td>
                        <td className="px-4 py-3 text-gray-900">{s.seller_name}</td>
                        <td className="px-4 py-3 text-right font-medium">{formatCents(s.sale_price_cents)}</td>
                        <td className="px-4 py-3 text-right text-coffee-600">{formatCents(s.locale_amount_cents)}<span className="block text-xs text-coffee-400">{s.locale_percent}%</span></td>
                        <td className="px-4 py-3 text-right">{formatCents(s.seller_payout_cents)}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${s.seller_paid_at ? 'bg-coffee-200 text-coffee-800' : 'bg-purple-100 text-purple-800'}`}>
                            {s.seller_paid_at ? 'Sold' : 'Awaiting payout'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-coffee-50 font-semibold text-gray-900">
                    <tr>
                      <td className="px-4 py-3" colSpan={4}>Totals · {summary.sales_count} sale{summary.sales_count === 1 ? '' : 's'}</td>
                      <td className="px-4 py-3 text-right">{formatCents(summary.total_sales_cents)}</td>
                      <td className="px-4 py-3 text-right">{formatCents(summary.locale_total_cents)}</td>
                      <td className="px-4 py-3 text-right">{formatCents(summary.seller_share_cents)}</td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
}
