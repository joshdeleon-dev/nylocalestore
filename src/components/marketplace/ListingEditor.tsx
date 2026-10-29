'use client';

import { useEffect, useRef, useState } from 'react';
import { X, Upload, Trash2, Star, Loader2, History, Phone, Mail } from 'lucide-react';
import toast from 'react-hot-toast';
import { ImageLightbox } from './ImageLightbox';
import { LocaleSplitCalculator } from './LocaleSplitCalculator';
import { checkPhoto, uploadPhotos } from '@/lib/marketplaceUpload';
import { PaymentCheckboxes, PaymentRow } from './PaymentCheckboxes';
import {
  ALLOWED_ACTIONS, CONDITION_LABELS, STATUS_BADGE, STATUS_LABELS, formatCents,
} from '@/lib/marketplace';
import {
  ListingAction, ListingCondition, MarketplaceAuditEntry, MarketplaceCategory, MarketplaceListing,
} from '@/types/marketplace';

interface Props {
  listingId: number | null; // null = create a new listing
  categories: MarketplaceCategory[];
  onClose: () => void;
  onChanged: () => void;
}

const ACTION_LABELS: Record<ListingAction, string> = {
  publish: 'Publish',
  unpublish: 'Unpublish',
  reject: 'Reject',
  withdraw: 'Withdraw',
  reopen: 'Reopen for review',
  release: 'Return to sale',
};

const ACTION_STYLE: Record<ListingAction, string> = {
  publish: 'btn-primary',
  unpublish: 'btn-secondary',
  reject: 'btn-secondary text-red-600 hover:bg-red-50',
  withdraw: 'btn-secondary',
  reopen: 'btn-secondary',
  release: 'btn-secondary',
};

const emptyForm = {
  title: '',
  description: '',
  condition: 'good' as ListingCondition,
  category_id: '' as number | '',
  asking_price_cents: null as number | null,
  locale_percent: 0,
  admin_notes: '',
  seller: { name: '', email: '', phone: '' },
};

export function ListingEditor({ listingId, categories, onClose, onChanged }: Props) {
  const [id, setId] = useState<number | null>(listingId);
  const [listing, setListing] = useState<MarketplaceListing | null>(null);
  const [history, setHistory] = useState<MarketplaceAuditEntry[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(listingId != null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [zoomIndex, setZoomIndex] = useState<number | null>(null);
  const [payment, setPayment] = useState<PaymentRow | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const applyListing = (l: MarketplaceListing) => {
    setListing(l);
    setForm({
      title: l.title,
      description: l.description,
      condition: l.condition,
      category_id: l.category_id ?? '',
      asking_price_cents: l.asking_price_cents,
      locale_percent: Number(l.locale_percent),
      admin_notes: l.admin_notes ?? '',
      seller: { name: l.seller?.name ?? '', email: l.seller?.email ?? '', phone: l.seller?.phone ?? '' },
    });
  };

  const load = async (listingIdToLoad: number) => {
    const res = await fetch(`/api/admin/marketplace/listings/${listingIdToLoad}`);
    const json = await res.json();
    if (!res.ok) { toast.error(json.error || 'Failed to load listing'); onClose(); return; }
    applyListing(json.data);
    // Reserved / paid / sold items get the payment section
    if (['reserved', 'paid', 'sold'].includes(json.data.status)) {
      const pay = await fetch(`/api/admin/marketplace/payments/${listingIdToLoad}`).then((r) => r.json()).catch(() => null);
      setPayment(pay?.data ?? null);
    } else {
      setPayment(null);
    }
    setHistory(json.history ?? []);
    setLoading(false);
  };

  useEffect(() => { if (listingId != null) load(listingId); }, [listingId]); // eslint-disable-line react-hooks/exhaustive-deps

  const setField = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm((f) => ({ ...f, [key]: value }));
  const setSeller = (key: keyof typeof form.seller, value: string) => setForm((f) => ({ ...f, seller: { ...f.seller, [key]: value } }));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.asking_price_cents == null) { toast.error('Enter a valid price'); return; }
    setSaving(true);
    const body = {
      title: form.title,
      description: form.description,
      condition: form.condition,
      category_id: form.category_id === '' ? null : form.category_id,
      asking_price_cents: form.asking_price_cents,
      locale_percent: form.locale_percent,
      admin_notes: form.admin_notes || null,
      seller: form.seller,
    };
    const res = await fetch(id ? `/api/admin/marketplace/listings/${id}` : '/api/admin/marketplace/listings', {
      method: id ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    setSaving(false);
    if (!res.ok) { toast.error(json.error || 'Save failed'); return; }
    toast.success(id ? 'Listing saved' : 'Listing created — now add photos');
    onChanged();
    if (!id) setId(json.data.id);
    await load(json.data.id);
  };

  const runAction = async (action: ListingAction, reason?: string) => {
    if (!id) return;
    setSaving(true);
    const res = await fetch(`/api/admin/marketplace/listings/${id}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, reason }),
    });
    const json = await res.json();
    setSaving(false);
    if (!res.ok) { toast.error(json.error || 'Action failed'); return; }
    toast.success(`Listing ${STATUS_LABELS[json.data.status as keyof typeof STATUS_LABELS].toLowerCase()}`);
    setRejecting(false);
    setRejectReason('');
    onChanged();
    await load(id);
  };

  const upload = async (fileList: FileList | null) => {
    if (!id || !fileList?.length) return;
    const files = Array.from(fileList);
    const problem = files.map(checkPhoto).find(Boolean);
    if (fileInput.current) fileInput.current.value = '';
    if (problem) { toast.error(problem); return; }

    setUploading(true);
    try {
      const endpoint = `/api/admin/marketplace/listings/${id}/images`;
      const paths = await uploadPhotos(endpoint, files);
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'attach', paths }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Upload failed');
      onChanged();
      await load(id);
    } catch (e: any) {
      toast.error(e.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const removeImage = async (imageId: number) => {
    if (!id) return;
    const res = await fetch(`/api/admin/marketplace/listings/${id}/images?imageId=${imageId}`, { method: 'DELETE' });
    const json = await res.json();
    if (!res.ok) { toast.error(json.error || 'Remove failed'); return; }
    onChanged();
    await load(id);
  };

  const makeCover = async (imageId: number) => {
    if (!id || !listing?.images) return;
    const order = [imageId, ...listing.images.map((i) => i.id).filter((i) => i !== imageId)];
    const res = await fetch(`/api/admin/marketplace/listings/${id}/images`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order }),
    });
    if (!res.ok) { toast.error('Reorder failed'); return; }
    onChanged();
    await load(id);
  };

  const actions = listing ? ALLOWED_ACTIONS[listing.status] : [];
  const readOnly = listing?.status === 'sold' || listing?.status === 'paid';

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-2xl h-full bg-white shadow-xl flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-coffee-100">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-gray-900 truncate">{id ? listing?.title ?? 'Listing' : 'New listing'}</h2>
            {listing && (
              <div className="flex items-center gap-2 mt-1">
                <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[listing.status]}`}>
                  {STATUS_LABELS[listing.status]}
                </span>
                <span className="text-xs text-coffee-400">#{listing.id} · /{listing.slug}</span>
              </div>
            )}
          </div>
          <button onClick={onClose} className="p-2 rounded-md text-coffee-400 hover:text-coffee-700 hover:bg-coffee-50" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center text-coffee-400 text-sm">
            <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading…
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            {/* Status actions */}
            {listing && (actions.length > 0 || listing.rejection_reason || listing.status === 'reserved') && (
              <div className="px-6 py-4 border-b border-coffee-100 bg-coffee-50/60 space-y-3">
                {listing.status === 'reserved' && (
                  <p className="text-sm text-blue-800">
                    This item is reserved. Manage the reservation from the <span className="font-medium">Reservations</span> tab.
                    “Return to sale” is only for an item whose pickup was completed but never paid.
                  </p>
                )}
                {listing.rejection_reason && (
                  <p className="text-sm text-red-700"><span className="font-medium">Rejected:</span> {listing.rejection_reason}</p>
                )}
                {rejecting ? (
                  <div className="space-y-2">
                    <label className="label">Reason for rejecting</label>
                    <textarea className="input min-h-[70px] resize-none" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="e.g. Prohibited item, photos unclear…" autoFocus />
                    <div className="flex gap-2">
                      <button type="button" disabled={saving || !rejectReason.trim()} onClick={() => runAction('reject', rejectReason)} className="btn btn-danger btn-sm">Confirm reject</button>
                      <button type="button" onClick={() => setRejecting(false)} className="btn btn-secondary btn-sm">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {actions.map((a) => (
                      <button
                        key={a}
                        type="button"
                        disabled={saving}
                        onClick={() => (a === 'reject' ? setRejecting(true) : runAction(a))}
                        className={`btn btn-sm ${ACTION_STYLE[a]}`}
                      >
                        {ACTION_LABELS[a]}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {payment && (
              <section className="px-6 py-4 border-b border-coffee-100 space-y-3">
                <h3 className="text-sm font-semibold text-gray-900">Payment</h3>
                <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                  <div><dt className="text-xs text-coffee-500">Asking price</dt><dd className="font-medium">{formatCents(payment.sale?.sale_price_cents ?? payment.asking_price_cents)}</dd></div>
                  <div><dt className="text-xs text-coffee-500">For Locale %</dt><dd className="font-medium">{Number(payment.sale?.locale_percent ?? payment.locale_percent)}%</dd></div>
                  <div><dt className="text-xs text-coffee-500">For Locale</dt><dd className="font-medium">{formatCents(payment.sale?.locale_amount_cents ?? payment.locale_amount_cents)}</dd></div>
                  <div><dt className="text-xs text-coffee-500">Pay seller</dt><dd className="font-semibold">{formatCents(payment.sale?.seller_payout_cents ?? payment.seller_payout_cents)}</dd></div>
                </dl>
                {payment.buyer && <p className="text-xs text-coffee-500">Buyer: {payment.buyer.buyer_name} · {payment.buyer.buyer_phone}</p>}
                <PaymentCheckboxes row={payment} onChanged={(updated) => { setPayment(updated); onChanged(); if (id) load(id); }} />
                {payment.sale && <p className="text-xs text-coffee-400">Amounts are locked to what they were when the buyer paid.</p>}
              </section>
            )}

            <form id="listing-form" onSubmit={save} className="px-6 py-5 space-y-6">
              {/* Photos */}
              {id && (
                <section>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold text-gray-900">Photos</h3>
                    {!readOnly && (
                      <>
                        <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={(e) => upload(e.target.files)} />
                        <button type="button" disabled={uploading} onClick={() => fileInput.current?.click()} className="btn btn-secondary btn-sm gap-1.5">
                          {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                          Add photos
                        </button>
                      </>
                    )}
                  </div>
                  {listing?.images?.length ? (
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                      {listing.images.map((img, i) => (
                        <div key={img.id} className="group relative aspect-square rounded-lg overflow-hidden bg-coffee-100 border border-coffee-100">
                          <button
                            type="button"
                            onClick={() => setZoomIndex(i)}
                            className="block w-full h-full cursor-zoom-in focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-coffee-500"
                            aria-label={`Enlarge photo ${i + 1}`}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={img.url} alt="" className="w-full h-full object-cover" />
                          </button>
                          {i === 0 && <span className="absolute top-1 left-1 text-[10px] font-semibold bg-coffee-900 text-white rounded px-1.5 py-0.5">Cover</span>}
                          {!readOnly && (
                            <div className="absolute inset-x-0 bottom-0 flex justify-end gap-1 p-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                              {i !== 0 && (
                                <button type="button" onClick={() => makeCover(img.id)} className="p-1.5 rounded bg-white/90 text-coffee-700 hover:bg-white" title="Make cover photo">
                                  <Star className="w-3.5 h-3.5" />
                                </button>
                              )}
                              <button type="button" onClick={() => removeImage(img.id)} className="p-1.5 rounded bg-white/90 text-red-600 hover:bg-white" title="Remove photo">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-coffee-400 border border-dashed border-coffee-200 rounded-lg p-4 text-center">No photos yet. At least one is needed to publish.</p>
                  )}
                </section>
              )}

              {/* Seller */}
              <section className="space-y-3">
                <h3 className="text-sm font-semibold text-gray-900">Seller (private)</h3>
                <div className="grid sm:grid-cols-3 gap-3">
                  <div>
                    <label className="label">Name *</label>
                    <input className="input" value={form.seller.name} onChange={(e) => setSeller('name', e.target.value)} required disabled={readOnly} />
                  </div>
                  <div>
                    <label className="label">Email *</label>
                    <input type="email" className="input" value={form.seller.email} onChange={(e) => setSeller('email', e.target.value)} required disabled={readOnly} />
                  </div>
                  <div>
                    <label className="label">Phone *</label>
                    <input type="tel" className="input" value={form.seller.phone} onChange={(e) => setSeller('phone', e.target.value)} required disabled={readOnly} />
                  </div>
                </div>
                {listing?.seller && (
                  <div className="flex gap-4 text-xs">
                    <a href={`tel:${listing.seller.phone}`} className="inline-flex items-center gap-1 text-coffee-600 hover:text-coffee-900"><Phone className="w-3 h-3" /> Call</a>
                    <a href={`mailto:${listing.seller.email}`} className="inline-flex items-center gap-1 text-coffee-600 hover:text-coffee-900"><Mail className="w-3 h-3" /> Email</a>
                  </div>
                )}
              </section>

              {/* Item */}
              <section className="space-y-3">
                <h3 className="text-sm font-semibold text-gray-900">Item</h3>
                <div>
                  <label className="label">Title *</label>
                  <input className="input" value={form.title} onChange={(e) => setField('title', e.target.value)} required maxLength={120} disabled={readOnly} />
                </div>
                <div>
                  <label className="label">Description</label>
                  <textarea className="input min-h-[100px] resize-y" value={form.description} onChange={(e) => setField('description', e.target.value)} maxLength={5000} disabled={readOnly} />
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <label className="label">Condition *</label>
                    <select className="select" value={form.condition} onChange={(e) => setField('condition', e.target.value as ListingCondition)} disabled={readOnly}>
                      {Object.entries(CONDITION_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label">Category</label>
                    <select className="select" value={form.category_id} onChange={(e) => setField('category_id', e.target.value === '' ? '' : Number(e.target.value))} disabled={readOnly}>
                      <option value="">— None —</option>
                      {categories.filter((c) => c.is_active || c.id === form.category_id).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                </div>
              </section>

              {/* Price */}
              <section className="space-y-3">
                <h3 className="text-sm font-semibold text-gray-900">Price & For Locale</h3>
                <LocaleSplitCalculator
                  key={listing?.id ?? 'new'}
                  priceCents={form.asking_price_cents}
                  percent={form.locale_percent}
                  onChange={({ priceCents, percent }) => setForm((f) => ({ ...f, asking_price_cents: priceCents, locale_percent: percent }))}
                />
              </section>

              <section>
                <label className="label">Admin notes (private)</label>
                <textarea className="input min-h-[60px] resize-y" value={form.admin_notes} onChange={(e) => setField('admin_notes', e.target.value)} maxLength={2000} disabled={readOnly} />
              </section>

              {/* History */}
              {history.length > 0 && (
                <section>
                  <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5 mb-2"><History className="w-4 h-4" /> History</h3>
                  <ul className="space-y-1.5 text-xs text-coffee-600">
                    {history.map((h) => (
                      <li key={h.id} className="flex justify-between gap-3">
                        <span>
                          <span className="font-medium text-coffee-800">{h.action.replace(/_/g, ' ')}</span>
                          {h.action === 'update' && h.before_data && h.after_data && describeMoneyChange(h.before_data, h.after_data)}
                          {h.actor_name ? ` · ${h.actor_name}` : ''}
                        </span>
                        <span className="text-coffee-400 whitespace-nowrap">{new Date(h.created_at).toLocaleString()}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </form>
          </div>
        )}

        {!loading && !readOnly && (
          <div className="px-6 py-4 border-t border-coffee-100 flex gap-3">
            <button type="button" onClick={onClose} className="btn btn-secondary flex-1 justify-center">Close</button>
            <button type="submit" form="listing-form" disabled={saving} className="btn btn-primary flex-1 justify-center">
              {saving ? 'Saving…' : id ? 'Save changes' : 'Create listing'}
            </button>
          </div>
        )}
      </div>
      {zoomIndex != null && listing?.images?.length ? (
        <ImageLightbox
          images={listing.images.map((img) => img.url ?? '').filter(Boolean)}
          index={Math.min(zoomIndex, listing.images.length - 1)}
          title={listing.title}
          onIndexChange={setZoomIndex}
          onClose={() => setZoomIndex(null)}
        />
      ) : null}
    </div>
  );
}

// e.g. " · price $100.00 → $90.00, For Locale 15% → 20%"
function describeMoneyChange(before: Record<string, any>, after: Record<string, any>) {
  const parts: string[] = [];
  if (before.asking_price_cents !== after.asking_price_cents) {
    parts.push(`price ${formatCents(before.asking_price_cents)} → ${formatCents(after.asking_price_cents)}`);
  }
  if (Number(before.locale_percent) !== Number(after.locale_percent)) {
    parts.push(`For Locale ${Number(before.locale_percent)}% → ${Number(after.locale_percent)}%`);
  }
  return parts.length ? ` · ${parts.join(', ')}` : '';
}
