'use client';

import { useCallback, useEffect, useState } from 'react';
import { ImageOff, MapPin, Truck } from 'lucide-react';
import toast from 'react-hot-toast';
import { useTableSort } from '@/hooks/useTableSort';
import { SortableHeader } from '@/components/SortableHeader';
import { ReservationPanel, daysSince } from './ReservationPanel';
import { RESERVATION_STATUS_BADGE, RESERVATION_STATUS_LABELS, formatCents } from '@/lib/marketplace';
import { MarketplaceReservation } from '@/types/marketplace';

type View = 'open' | 'closed' | 'all';

interface Props {
  onOpenListing: (listingId: number) => void;
  onChanged: () => void;
}

export function ReservationsTab({ onOpenListing, onChanged }: Props) {
  const [view, setView] = useState<View>('open');
  const [rows, setRows] = useState<MarketplaceReservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<MarketplaceReservation | null>(null);

  const { sorted, sortKey, sortDir, requestSort } = useTableSort(rows, {
    item: (r) => r.listing?.title,
    buyer: (r) => r.buyer_name,
    pickup: (r) => (r.pickup_type === 'locale' ? 'Locale' : `Other ${r.pickup_city ?? ''}`),
    status: (r) => RESERVATION_STATUS_LABELS[r.status],
    // Open view shows days reserved (ascending = newest first); other views show the date
    reserved: (r) => (view === 'open' ? -1 : 1) * new Date(r.created_at).getTime(),
  });

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/admin/marketplace/reservations?view=${view}`);
    const json = await res.json();
    if (res.ok) setRows(json.data);
    else toast.error(json.error || 'Failed to load reservations');
    setLoading(false);
  }, [view]);

  useEffect(() => { load(); }, [load]);

  return (
    <>
      <div className="flex gap-2">
        {(['open', 'closed', 'all'] as View[]).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`px-4 py-1.5 rounded-full text-sm border capitalize transition-colors ${
              view === v ? 'bg-coffee-900 text-white border-coffee-900' : 'bg-white text-coffee-700 border-coffee-200 hover:bg-coffee-50'
            }`}
          >
            {v}
          </button>
        ))}
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-sm text-coffee-400">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="p-10 text-center text-sm text-coffee-400">{view === 'open' ? 'No open reservations.' : 'No reservations.'}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-coffee-50 text-left text-xs uppercase tracking-wider text-coffee-500">
                <tr>
                  <SortableHeader label="Item" sortKey="item" currentKey={sortKey} dir={sortDir} onSort={requestSort} className="!px-4" />
                  <SortableHeader label="Buyer" sortKey="buyer" currentKey={sortKey} dir={sortDir} onSort={requestSort} className="!px-4" />
                  <SortableHeader label="Pickup" sortKey="pickup" currentKey={sortKey} dir={sortDir} onSort={requestSort} className="!px-4" />
                  <SortableHeader label="Status" sortKey="status" currentKey={sortKey} dir={sortDir} onSort={requestSort} className="!px-4" />
                  <SortableHeader label={view === 'open' ? 'Reserved for' : 'Reserved'} sortKey="reserved" currentKey={sortKey} dir={sortDir} onSort={requestSort} className="!px-4" align="right" />
                </tr>
              </thead>
              <tbody className="divide-y divide-coffee-100">
                {sorted.map((r) => {
                  const days = daysSince(r.created_at);
                  return (
                    <tr key={r.id} onClick={() => setSelected(r)} className="cursor-pointer hover:bg-coffee-50/60">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-lg bg-coffee-100 overflow-hidden flex-shrink-0 flex items-center justify-center">
                            {r.listing?.cover_url
                              // eslint-disable-next-line @next/next/no-img-element
                              ? <img src={r.listing.cover_url} alt="" className="w-full h-full object-cover" />
                              : <ImageOff className="w-4 h-4 text-coffee-300" />}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-gray-900 truncate max-w-[220px]">{r.listing?.title}</p>
                            <p className="text-xs text-coffee-400">{r.listing && formatCents(r.listing.asking_price_cents)} · #{r.id}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-gray-900">{r.buyer_name}</p>
                        <p className="text-xs text-coffee-400">{r.buyer_phone}</p>
                      </td>
                      <td className="px-4 py-3">
                        {r.pickup_type === 'locale'
                          ? <span className="inline-flex items-center gap-1 text-coffee-700"><MapPin className="w-3.5 h-3.5" /> Locale</span>
                          : <span className="inline-flex items-center gap-1 text-coffee-700"><Truck className="w-3.5 h-3.5" /> Other · {r.pickup_city}</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${RESERVATION_STATUS_BADGE[r.status]}`}>{RESERVATION_STATUS_LABELS[r.status]}</span>
                      </td>
                      <td className={`px-4 py-3 text-right whitespace-nowrap ${view === 'open' && days >= 7 ? 'text-red-700 font-medium' : 'text-coffee-600'}`}>
                        {view === 'open' ? `${days} day${days === 1 ? '' : 's'}` : new Date(r.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selected && (
        <ReservationPanel
          reservation={selected}
          onClose={() => setSelected(null)}
          onChanged={(updated) => { setSelected(updated); load(); onChanged(); }}
          onOpenListing={(id) => { setSelected(null); onOpenListing(id); }}
        />
      )}
    </>
  );
}
