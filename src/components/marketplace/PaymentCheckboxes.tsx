'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { PaymentField } from '@/types/marketplace';

export interface PaymentRow {
  id: number;
  title: string;
  status: string;
  asking_price_cents: number;
  locale_percent: number;
  locale_amount_cents: number;
  seller_payout_cents: number;
  cover_url: string | null;
  seller?: { name: string; phone: string; email: string } | null;
  category?: { name: string } | null;
  buyer?: { id: number; buyer_name: string; buyer_phone: string; buyer_email: string; status: string } | null;
  sale?: {
    sale_price_cents: number;
    locale_percent: number;
    locale_amount_cents: number;
    seller_payout_cents: number;
    buyer_paid_at: string;
    buyer_paid_by_name: string | null;
    seller_paid_at: string | null;
    seller_paid_by_name: string | null;
  } | null;
}

const shortDate = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

// "Buyer has paid" / "Seller has been paid" for one listing. Unticking asks for confirmation.
export function PaymentCheckboxes({ row, onChanged, layout = 'row' }: { row: PaymentRow; onChanged: (row: PaymentRow) => void; layout?: 'row' | 'stack' }) {
  const [busy, setBusy] = useState<PaymentField | null>(null);
  const [confirmUntick, setConfirmUntick] = useState<PaymentField | null>(null);

  const buyerPaid = row.status === 'paid' || row.status === 'sold';
  const sellerPaid = row.status === 'sold';

  const send = async (field: PaymentField, paid: boolean) => {
    setBusy(field);
    setConfirmUntick(null);
    const res = await fetch(`/api/admin/marketplace/payments/${row.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ field, paid }),
    });
    const json = await res.json();
    setBusy(null);
    if (!res.ok) { toast.error(json.error || 'Update failed'); return; }
    toast.success(
      field === 'buyer_paid'
        ? paid ? 'Buyer payment recorded — item removed from the catalog' : 'Buyer payment unticked — item is reserved again'
        : paid ? 'Seller payout recorded — item sold' : 'Seller payout unticked'
    );
    onChanged(json.data);
  };

  const toggle = (field: PaymentField, checked: boolean) => {
    const currentlyChecked = field === 'buyer_paid' ? buyerPaid : sellerPaid;
    if (currentlyChecked && !checked) { setConfirmUntick(field); return; }
    send(field, checked);
  };

  const box = (field: PaymentField, label: string, checked: boolean, disabled: boolean, who: string | null | undefined, when: string | null | undefined) => (
    <label className={`flex items-start gap-2 ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}>
      {busy === field
        ? <Loader2 className="w-4 h-4 mt-0.5 animate-spin text-coffee-500" />
        : <input type="checkbox" className="checkbox mt-0.5" checked={checked} disabled={disabled || busy !== null} onChange={(e) => toggle(field, e.target.checked)} aria-label={label} />}
      <span className="leading-tight">
        <span className="block text-sm text-gray-900 whitespace-nowrap">{label}</span>
        {checked && when && <span className="block text-[11px] text-coffee-500 whitespace-nowrap">{shortDate(when)}{who ? ` · ${who}` : ''}</span>}
      </span>
    </label>
  );

  return (
    <div onClick={(e) => e.stopPropagation()} className="space-y-2">
      <div className={layout === 'row' ? 'flex flex-wrap gap-x-5 gap-y-2' : 'space-y-2'}>
        {box('buyer_paid', 'Buyer has paid', buyerPaid, sellerPaid || !['reserved', 'paid', 'sold'].includes(row.status), row.sale?.buyer_paid_by_name, row.sale?.buyer_paid_at)}
        {box('seller_paid', 'Seller has been paid', sellerPaid, !buyerPaid, row.sale?.seller_paid_by_name, row.sale?.seller_paid_at)}
      </div>
      {confirmUntick && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 space-y-2 max-w-sm">
          <p>
            {confirmUntick === 'buyer_paid'
              ? 'Untick “Buyer has paid”? The sale record is removed and the item goes back to Reserved (shown grayed out in the catalog).'
              : 'Untick “Seller has been paid”? The item goes back to awaiting seller payout.'}
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={() => send(confirmUntick, false)} className="btn btn-sm btn-danger">Untick</button>
            <button type="button" onClick={() => setConfirmUntick(null)} className="btn btn-sm btn-secondary">Keep</button>
          </div>
        </div>
      )}
    </div>
  );
}
