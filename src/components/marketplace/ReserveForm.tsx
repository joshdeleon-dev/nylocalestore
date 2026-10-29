'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, MapPin, Truck } from 'lucide-react';
import { MAX_OPEN_RESERVATIONS } from '@/lib/marketplace';
import { PickupType } from '@/types/marketplace';

// Pickup choice (Locale / Other address) is hidden for now: everything is picked up at the
// Locale. The database and API still support 'other' — set this to true to bring the options back.
const SHOW_PICKUP_OPTIONS = false;

const emptyForm = {
  buyer_name: '', buyer_email: '', buyer_phone: '',
  pickup_type: 'locale' as PickupType,
  pickup_street: '', pickup_unit: '', pickup_city: '', pickup_state: 'NY', pickup_zip: '',
};

export function ReserveForm({ slug, base }: { slug: string; base: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const res = await fetch('/api/marketplace/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, ...form }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || 'Something went wrong — please try again');
        if (res.status === 409 || res.status === 404) router.refresh();
        return;
      }
      router.push(`${base}/reservation/${json.token}`);
    } catch {
      setError('Something went wrong — please try again');
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="w-full rounded-full bg-coffee-900 text-white font-medium py-3.5 hover:bg-coffee-700 transition-colors"
        >
          Request to Reserve
        </button>
        <p className="text-xs text-coffee-500 text-center mt-2">Free to reserve. You pay only if you decide to buy.</p>
      </>
    );
  }

  const pickupOption = (value: PickupType, Icon: typeof MapPin, label: string, hint: string) => (
    <label
      className={`flex-1 flex items-start gap-3 rounded-xl border p-3.5 cursor-pointer transition-colors ${
        form.pickup_type === value ? 'border-coffee-900 bg-coffee-50' : 'border-coffee-200 hover:bg-coffee-50/60'
      }`}
    >
      <input type="radio" name="pickup_type" value={value} checked={form.pickup_type === value} onChange={() => set('pickup_type', value)} className="mt-1 accent-coffee-900" />
      <span>
        <span className="flex items-center gap-1.5 font-medium text-coffee-900 text-sm"><Icon className="w-4 h-4" /> {label}</span>
        <span className="block text-xs text-coffee-500 mt-0.5">{hint}</span>
      </span>
    </label>
  );

  return (
    <form onSubmit={submit} className="rounded-2xl border border-coffee-200 bg-white p-5 space-y-4">
      <div>
        <h2 className="font-serif text-xl text-coffee-900">Reserve this item</h2>
        <p className="text-sm text-coffee-500 mt-0.5">We’ll hold it for you and reach out to arrange the details.</p>
      </div>

      <div>
        <label className="label" htmlFor="buyer_name">Full name *</label>
        <input id="buyer_name" className="input" value={form.buyer_name} onChange={(e) => set('buyer_name', e.target.value)} required maxLength={120} autoComplete="name" />
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="buyer_email">Email *</label>
          <input id="buyer_email" type="email" className="input" value={form.buyer_email} onChange={(e) => set('buyer_email', e.target.value)} required maxLength={200} autoComplete="email" />
        </div>
        <div>
          <label className="label" htmlFor="buyer_phone">Phone *</label>
          <input id="buyer_phone" type="tel" className="input" value={form.buyer_phone} onChange={(e) => set('buyer_phone', e.target.value)} required maxLength={40} autoComplete="tel" />
        </div>
      </div>

      {SHOW_PICKUP_OPTIONS ? (
        <fieldset>
          <legend className="label">Pickup</legend>
          <div className="flex flex-col sm:flex-row gap-2">
            {pickupOption('locale', MapPin, 'Locale', 'Pick up in person at the Locale')}
            {pickupOption('other', Truck, 'Other', 'Pick up at a different address')}
          </div>
        </fieldset>
      ) : (
        <p className="flex items-center gap-2 rounded-xl bg-coffee-50 px-4 py-3 text-sm text-coffee-700">
          <MapPin className="w-4 h-4 flex-shrink-0" /> Pickup is in person at the Locale.
        </p>
      )}

      {SHOW_PICKUP_OPTIONS && form.pickup_type === 'other' && (
        <div className="space-y-3 rounded-xl bg-coffee-50 p-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="label" htmlFor="pickup_street">Street address *</label>
              <input id="pickup_street" className="input" value={form.pickup_street} onChange={(e) => set('pickup_street', e.target.value)} required maxLength={200} autoComplete="address-line1" />
            </div>
            <div>
              <label className="label" htmlFor="pickup_unit">Apt / Unit</label>
              <input id="pickup_unit" className="input" value={form.pickup_unit} onChange={(e) => set('pickup_unit', e.target.value)} maxLength={50} autoComplete="address-line2" />
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="col-span-2">
              <label className="label" htmlFor="pickup_city">City *</label>
              <input id="pickup_city" className="input" value={form.pickup_city} onChange={(e) => set('pickup_city', e.target.value)} required maxLength={100} autoComplete="address-level2" />
            </div>
            <div>
              <label className="label" htmlFor="pickup_state">State *</label>
              <input id="pickup_state" className="input" value={form.pickup_state} onChange={(e) => set('pickup_state', e.target.value)} required maxLength={50} autoComplete="address-level1" />
            </div>
            <div>
              <label className="label" htmlFor="pickup_zip">ZIP *</label>
              <input id="pickup_zip" className="input" value={form.pickup_zip} onChange={(e) => set('pickup_zip', e.target.value)} required inputMode="numeric" pattern="\d{5}(-\d{4})?" maxLength={10} autoComplete="postal-code" />
            </div>
          </div>
        </div>
      )}

      {error && <p className="rounded-lg bg-red-50 text-red-700 text-sm px-4 py-3" role="alert">{error}</p>}

      <div className="flex gap-2">
        <button type="button" onClick={() => { setOpen(false); setError(''); }} className="rounded-full border border-coffee-200 text-coffee-700 font-medium px-5 py-3 hover:bg-coffee-50">
          Cancel
        </button>
        <button type="submit" disabled={busy} className="flex-1 rounded-full bg-coffee-900 text-white font-medium py-3 hover:bg-coffee-700 transition-colors disabled:opacity-60 inline-flex items-center justify-center gap-2">
          {busy && <Loader2 className="w-4 h-4 animate-spin" />}
          {busy ? 'Reserving…' : 'Reserve item'}
        </button>
      </div>
      <p className="text-xs text-coffee-400 text-center">Up to {MAX_OPEN_RESERVATIONS} items on hold at a time.</p>
    </form>
  );
}
