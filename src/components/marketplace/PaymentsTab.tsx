'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ImageOff } from 'lucide-react';
import toast from 'react-hot-toast';
import { PaymentCheckboxes, PaymentRow } from './PaymentCheckboxes';
import { formatCents } from '@/lib/marketplace';

type View = 'awaiting_buyer' | 'awaiting_payout' | 'sold';

const VIEWS: { key: View; label: string; empty: string }[] = [
  { key: 'awaiting_buyer', label: 'Awaiting buyer payment', empty: 'No reserved items waiting for payment.' },
  { key: 'awaiting_payout', label: 'Awaiting seller payout', empty: 'No sellers waiting to be paid.' },
  { key: 'sold', label: 'Sold', empty: 'No sold items yet.' },
];

export function PaymentsTab({ onOpenListing, onChanged }: { onOpenListing: (id: number) => void; onChanged: () => void }) {
  const [view, setView] = useState<View>('awaiting_buyer');
  const [rows, setRows] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Always load the view that's showing *now*, and drop responses for a view the user has left
  const viewRef = useRef(view);
  const reloadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    const requested = viewRef.current;
    setLoading(true);
    const res = await fetch(`/api/admin/marketplace/payments?view=${requested}`);
    const json = await res.json();
    if (viewRef.current !== requested) return;
    if (res.ok) setRows(json.data);
    else toast.error(json.error || 'Failed to load payments');
    setLoading(false);
  }, []);

  useEffect(() => {
    viewRef.current = view;
    if (reloadTimer.current) clearTimeout(reloadTimer.current);
    load();
  }, [view, load]);

  // Clear rows in the same render as the view change, so the old view's rows never flash under the new heading
  const switchView = (v: View) => {
    if (v === view) return;
    setRows([]);
    setLoading(true);
    setView(v);
  };

  useEffect(() => () => { if (reloadTimer.current) clearTimeout(reloadTimer.current); }, []);

  // A ticked row moves to another view; keep it briefly so the change is visible, then reload
  const handleChanged = (updated: PaymentRow) => {
    setRows((rs) => rs.map((r) => (r.id === updated.id ? updated : r)));
    onChanged();
    if (reloadTimer.current) clearTimeout(reloadTimer.current);
    reloadTimer.current = setTimeout(load, 900);
  };

  const owed = view === 'awaiting_payout' ? rows.reduce((t, r) => t + (r.sale?.seller_payout_cents ?? r.seller_payout_cents), 0) : 0;

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {VIEWS.map((v) => (
          <button
            key={v.key}
            onClick={() => switchView(v.key)}
            className={`px-4 py-1.5 rounded-full text-sm border transition-colors ${
              view === v.key ? 'bg-coffee-900 text-white border-coffee-900' : 'bg-white text-coffee-700 border-coffee-200 hover:bg-coffee-50'
            }`}
          >
            {v.label}
          </button>
        ))}
        {view === 'awaiting_payout' && !loading && rows.length > 0 && (
          <span className="ml-auto text-sm text-coffee-700">Owed to sellers: <span className="font-semibold text-gray-900">{formatCents(owed)}</span></span>
        )}
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-sm text-coffee-400">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="p-10 text-center text-sm text-coffee-400">{VIEWS.find((v) => v.key === view)!.empty}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-coffee-50 text-left text-xs uppercase tracking-wider text-coffee-500">
                <tr>
                  <th className="px-4 py-3">Item</th>
                  <th className="px-4 py-3">Buyer</th>
                  <th className="px-4 py-3">Seller</th>
                  <th className="px-4 py-3 text-right">Asking price</th>
                  <th className="px-4 py-3 text-right">For Locale</th>
                  <th className="px-4 py-3 text-right">Pay seller</th>
                  <th className="px-4 py-3">Payment</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-coffee-100">
                {rows.map((r) => {
                  // Paid items show the snapshot taken at payment time
                  const price = r.sale?.sale_price_cents ?? r.asking_price_cents;
                  const pct = Number(r.sale?.locale_percent ?? r.locale_percent);
                  const locale = r.sale?.locale_amount_cents ?? r.locale_amount_cents;
                  const payout = r.sale?.seller_payout_cents ?? r.seller_payout_cents;
                  return (
                    <tr key={r.id} className="align-top hover:bg-coffee-50/60">
                      <td className="px-4 py-3">
                        <button type="button" onClick={() => onOpenListing(r.id)} className="flex items-center gap-3 text-left">
                          <div className="w-12 h-12 rounded-lg bg-coffee-100 overflow-hidden flex-shrink-0 flex items-center justify-center">
                            {r.cover_url
                              // eslint-disable-next-line @next/next/no-img-element
                              ? <img src={r.cover_url} alt="" className="w-full h-full object-cover" />
                              : <ImageOff className="w-4 h-4 text-coffee-300" />}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-gray-900 truncate max-w-[200px] hover:underline">{r.title}</p>
                            <p className="text-xs text-coffee-400">{r.category?.name ?? 'Uncategorized'}</p>
                          </div>
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        {r.buyer ? (<><p className="text-gray-900">{r.buyer.buyer_name}</p><p className="text-xs text-coffee-400">{r.buyer.buyer_phone}</p></>) : <span className="text-coffee-400">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-gray-900">{r.seller?.name}</p>
                        <p className="text-xs text-coffee-400">{r.seller?.phone}</p>
                      </td>
                      <td className="px-4 py-3 text-right font-medium">{formatCents(price)}</td>
                      <td className="px-4 py-3 text-right text-coffee-600">
                        {formatCents(locale)}
                        <span className="block text-xs text-coffee-400">{pct}%</span>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold">{formatCents(payout)}</td>
                      <td className="px-4 py-3"><PaymentCheckboxes row={r} onChanged={handleChanged} layout="stack" /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
