'use client';

import { useState } from 'react';
import { Mail, MapPin, Phone, X } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  RESERVATION_ACTIONS, RESERVATION_STATUS_BADGE, RESERVATION_STATUS_LABELS, formatCents, formatPickup,
} from '@/lib/marketplace';
import { MarketplaceReservation, ReservationAction } from '@/types/marketplace';

const ACTION_LABELS: Record<ReservationAction, string> = {
  confirm: 'Confirm',
  complete: 'Mark picked up',
  cancel: 'Cancel reservation',
  no_show: 'Mark no-show',
};

const ACTION_STYLE: Record<ReservationAction, string> = {
  confirm: 'btn-primary',
  complete: 'btn-primary',
  cancel: 'btn-secondary text-red-600 hover:bg-red-50',
  no_show: 'btn-secondary',
};

export const daysSince = (iso: string) => Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000));

interface Props {
  reservation: MarketplaceReservation;
  onClose: () => void;
  onChanged: (updated: MarketplaceReservation) => void;
  onOpenListing: (listingId: number) => void;
}

export function ReservationPanel({ reservation: r, onClose, onChanged, onOpenListing }: Props) {
  const [notes, setNotes] = useState(r.admin_notes ?? '');
  const [pending, setPending] = useState<ReservationAction | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const send = async (body: object, success: string) => {
    setBusy(true);
    const res = await fetch(`/api/admin/marketplace/reservations/${r.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    setBusy(false);
    if (!res.ok) { toast.error(json.error || 'Failed'); return; }
    toast.success(success);
    setPending(null);
    setReason('');
    onChanged(json.data);
  };

  const run = (action: ReservationAction) => {
    // Releasing actions ask for confirmation (and an optional reason) first
    if (action === 'cancel' || action === 'no_show') { setPending(action); return; }
    send({ action }, action === 'confirm' ? 'Reservation confirmed' : 'Marked as picked up');
  };

  const actions = RESERVATION_ACTIONS[r.status];
  const open = r.status === 'requested' || r.status === 'confirmed';

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-lg h-full bg-white shadow-xl flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-coffee-100">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Reservation #{r.id}</h2>
            <div className="flex items-center gap-2 mt-1">
              <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${RESERVATION_STATUS_BADGE[r.status]}`}>{RESERVATION_STATUS_LABELS[r.status]}</span>
              {open && <span className="text-xs text-coffee-500">Reserved {daysSince(r.created_at)} day{daysSince(r.created_at) === 1 ? '' : 's'} ago</span>}
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-md text-coffee-400 hover:text-coffee-700 hover:bg-coffee-50" aria-label="Close"><X className="w-5 h-5" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {actions.length > 0 && (
            <section className="space-y-3">
              {pending ? (
                <div className="rounded-xl border border-coffee-200 bg-coffee-50 p-4 space-y-3">
                  <p className="text-sm text-coffee-800">
                    {pending === 'cancel' ? 'Cancel this reservation?' : 'Mark this buyer as a no-show?'} The item goes back on sale right away.
                  </p>
                  <input className="input" placeholder="Reason (optional)" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={1000} />
                  <div className="flex gap-2">
                    <button disabled={busy} onClick={() => send({ action: pending, reason: reason || undefined }, pending === 'cancel' ? 'Reservation canceled — item is back on sale' : 'Marked no-show — item is back on sale')} className="btn btn-danger btn-sm">
                      {pending === 'cancel' ? 'Yes, cancel' : 'Yes, mark no-show'}
                    </button>
                    <button onClick={() => setPending(null)} className="btn btn-secondary btn-sm">Back</button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {actions.map((a) => (
                    <button key={a} disabled={busy} onClick={() => run(a)} className={`btn btn-sm ${ACTION_STYLE[a]}`}>{ACTION_LABELS[a]}</button>
                  ))}
                </div>
              )}
            </section>
          )}

          {r.listing && (
            <section>
              <h3 className="text-sm font-semibold text-gray-900 mb-2">Item</h3>
              <button type="button" onClick={() => onOpenListing(r.listing!.id)} className="w-full flex items-center gap-3 rounded-xl border border-coffee-100 p-3 text-left hover:bg-coffee-50">
                <div className="w-14 h-14 rounded-lg bg-coffee-100 overflow-hidden flex-shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {r.listing.cover_url && <img src={r.listing.cover_url} alt="" className="w-full h-full object-cover" />}
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-gray-900 truncate">{r.listing.title}</p>
                  <p className="text-sm text-coffee-600">{formatCents(r.listing.asking_price_cents)} · open listing →</p>
                </div>
              </button>
            </section>
          )}

          <section className="space-y-2">
            <h3 className="text-sm font-semibold text-gray-900">Buyer</h3>
            <p className="text-gray-900">{r.buyer_name}</p>
            <div className="flex flex-col gap-1.5 text-sm">
              <a href={`tel:${r.buyer_phone}`} className="inline-flex items-center gap-2 text-coffee-700 hover:text-coffee-900"><Phone className="w-4 h-4" /> {r.buyer_phone}</a>
              <a href={`mailto:${r.buyer_email}`} className="inline-flex items-center gap-2 text-coffee-700 hover:text-coffee-900"><Mail className="w-4 h-4" /> {r.buyer_email}</a>
            </div>
          </section>

          <section className="space-y-2">
            <h3 className="text-sm font-semibold text-gray-900">Pickup</h3>
            <p className="flex items-start gap-2 text-gray-900">
              <MapPin className="w-4 h-4 mt-1 flex-shrink-0 text-coffee-500" />
              <span>{r.pickup_type === 'locale' ? 'Locale' : <>Other address<br /><span className="text-coffee-700">{formatPickup(r)}</span></>}</span>
            </p>
          </section>

          {(r.cancel_reason || r.canceled_by) && (
            <section className="space-y-1 text-sm">
              <h3 className="text-sm font-semibold text-gray-900">Closed</h3>
              {r.canceled_by && <p className="text-coffee-700">Canceled by {r.canceled_by === 'buyer' ? 'the buyer (from their link)' : 'staff'}</p>}
              {r.cancel_reason && <p className="text-coffee-700">Reason: {r.cancel_reason}</p>}
            </section>
          )}

          <section className="space-y-2">
            <label className="label" htmlFor="res-notes">Staff notes (private)</label>
            <textarea id="res-notes" className="input min-h-[90px] resize-y" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} placeholder="e.g. Called 10/28, pickup Saturday afternoon" />
            <button disabled={busy || notes === (r.admin_notes ?? '')} onClick={() => send({ admin_notes: notes || null }, 'Notes saved')} className="btn btn-secondary btn-sm">Save notes</button>
          </section>

          <section className="text-xs text-coffee-500 space-y-0.5">
            <p>Reserved {new Date(r.created_at).toLocaleString()}</p>
            {r.confirmed_at && <p>Confirmed {new Date(r.confirmed_at).toLocaleString()}</p>}
            {r.closed_at && <p>Closed {new Date(r.closed_at).toLocaleString()}</p>}
          </section>
        </div>
      </div>
    </div>
  );
}
