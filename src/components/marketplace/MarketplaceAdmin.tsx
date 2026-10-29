'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, Search, Store, ImageOff, Pencil, Trash2, Check, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { ListingEditor } from './ListingEditor';
import { ReservationsTab } from './ReservationsTab';
import { STATUS_BADGE, STATUS_LABELS, formatCents } from '@/lib/marketplace';
import { ListingStatus, MarketplaceCategory, MarketplaceListing } from '@/types/marketplace';

type Tab = 'submissions' | 'reservations' | 'listings' | 'categories';

const TAB_STATUSES: Record<Exclude<Tab, 'categories' | 'reservations'>, ListingStatus[]> = {
  submissions: ['submitted'],
  listings: ['published', 'unpublished', 'reserved', 'sold', 'rejected', 'withdrawn'],
};

type ListingRow = MarketplaceListing & { image_count: number };

// Shared by /dashboard/admin/marketplace and /dashboard/manager/marketplace
export function MarketplaceAdmin() {
  const [tab, setTab] = useState<Tab>('submissions');
  const [listings, setListings] = useState<ListingRow[]>([]);
  const [categories, setCategories] = useState<MarketplaceCategory[]>([]);
  const [statusFilter, setStatusFilter] = useState<ListingStatus | ''>('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<number | 'new' | null>(null);
  const [submissionCount, setSubmissionCount] = useState(0);
  const [openReservationCount, setOpenReservationCount] = useState(0);

  const loadCategories = useCallback(async () => {
    const res = await fetch('/api/admin/marketplace/categories');
    const json = await res.json();
    if (res.ok) setCategories(json.data);
  }, []);

  const loadListings = useCallback(async () => {
    if (tab === 'categories' || tab === 'reservations') return;
    setLoading(true);
    const statuses = statusFilter ? [statusFilter] : TAB_STATUSES[tab];
    const params = new URLSearchParams({ status: statuses.join(',') });
    if (search.trim()) params.set('q', search.trim());
    const res = await fetch(`/api/admin/marketplace/listings?${params}`);
    const json = await res.json();
    if (res.ok) setListings(json.data);
    else toast.error(json.error || 'Failed to load listings');
    setLoading(false);
  }, [tab, statusFilter, search]);

  const loadSubmissionCount = useCallback(async () => {
    const res = await fetch('/api/admin/marketplace/listings?status=submitted');
    const json = await res.json();
    if (res.ok) setSubmissionCount(json.data.length);
  }, []);

  const loadReservationCount = useCallback(async () => {
    const res = await fetch('/api/admin/marketplace/reservations?view=open');
    const json = await res.json();
    if (res.ok) setOpenReservationCount(json.data.length);
  }, []);

  useEffect(() => { loadCategories(); loadSubmissionCount(); loadReservationCount(); }, [loadCategories, loadSubmissionCount, loadReservationCount]);
  useEffect(() => {
    const t = setTimeout(loadListings, search ? 250 : 0);
    return () => clearTimeout(t);
  }, [loadListings, search]);

  const refreshAll = () => { loadListings(); loadSubmissionCount(); loadCategories(); loadReservationCount(); };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><Store className="w-6 h-6" /> Marketplace</h1>
          <p className="text-sm text-coffee-500 mt-1">Review submissions, manage listings and reservations for shop.nylocalestore.com</p>
        </div>
        {(tab === 'submissions' || tab === 'listings') && (
          <button onClick={() => setEditing('new')} className="btn btn-primary gap-2">
            <Plus className="w-4 h-4" /> New listing
          </button>
        )}
      </div>

      <div className="flex gap-1 border-b border-coffee-200">
        {(['submissions', 'reservations', 'listings', 'categories'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => { setTab(t); setStatusFilter(''); }}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors capitalize ${
              tab === t ? 'border-coffee-900 text-coffee-900' : 'border-transparent text-coffee-500 hover:text-coffee-800'
            }`}
          >
            {t}
            {t === 'submissions' && submissionCount > 0 && (
              <span className="ml-2 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-amber-100 text-amber-800 text-xs font-semibold">{submissionCount}</span>
            )}
            {t === 'reservations' && openReservationCount > 0 && (
              <span className="ml-2 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-blue-100 text-blue-800 text-xs font-semibold">{openReservationCount}</span>
            )}
          </button>
        ))}
      </div>

      {tab === 'categories' ? (
        <CategoryManager categories={categories} onChanged={loadCategories} />
      ) : tab === 'reservations' ? (
        <ReservationsTab onOpenListing={(id) => setEditing(id)} onChanged={refreshAll} />
      ) : (
        <>
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-coffee-400" />
              <input className="input pl-9" placeholder="Search by title…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            {tab === 'listings' && (
              <select className="select w-auto" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as ListingStatus | '')}>
                <option value="">All statuses</option>
                {TAB_STATUSES.listings.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
              </select>
            )}
          </div>

          <div className="card overflow-hidden">
            {loading ? (
              <div className="p-10 text-center text-sm text-coffee-400">Loading…</div>
            ) : listings.length === 0 ? (
              <div className="p-10 text-center text-sm text-coffee-400">
                {tab === 'submissions' ? 'No submissions waiting for review.' : 'No listings match.'}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-coffee-50 text-left text-xs uppercase tracking-wider text-coffee-500">
                    <tr>
                      <th className="px-4 py-3">Item</th>
                      <th className="px-4 py-3">Seller</th>
                      <th className="px-4 py-3 text-right">Asking price</th>
                      <th className="px-4 py-3 text-right">For Locale</th>
                      <th className="px-4 py-3 text-right">Pay seller</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Submitted</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-coffee-100">
                    {listings.map((l) => (
                      <tr key={l.id} onClick={() => setEditing(l.id)} className="cursor-pointer hover:bg-coffee-50/60">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-lg bg-coffee-100 overflow-hidden flex-shrink-0 flex items-center justify-center">
                              {l.images?.[0]?.url
                                // eslint-disable-next-line @next/next/no-img-element
                                ? <img src={l.images[0].url} alt="" className="w-full h-full object-cover" />
                                : <ImageOff className="w-4 h-4 text-coffee-300" />}
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium text-gray-900 truncate max-w-[220px]">{l.title}</p>
                              <p className="text-xs text-coffee-400">{l.category?.name ?? 'Uncategorized'} · {l.image_count} photo{l.image_count === 1 ? '' : 's'}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-gray-900">{l.seller?.name}</p>
                          <p className="text-xs text-coffee-400">{l.seller?.phone}</p>
                        </td>
                        <td className="px-4 py-3 text-right font-medium">{formatCents(l.asking_price_cents)}</td>
                        <td className="px-4 py-3 text-right text-coffee-600">
                          {formatCents(l.locale_amount_cents)}
                          <span className="block text-xs text-coffee-400">{Number(l.locale_percent)}%</span>
                        </td>
                        <td className="px-4 py-3 text-right font-medium">{formatCents(l.seller_payout_cents)}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[l.status]}`}>{STATUS_LABELS[l.status]}</span>
                        </td>
                        <td className="px-4 py-3 text-xs text-coffee-500 whitespace-nowrap">{new Date(l.created_at).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {editing != null && (
        <ListingEditor
          listingId={editing === 'new' ? null : editing}
          categories={categories}
          onClose={() => setEditing(null)}
          onChanged={refreshAll}
        />
      )}
    </div>
  );
}

function CategoryManager({ categories, onChanged }: { categories: MarketplaceCategory[]; onChanged: () => void }) {
  const [newName, setNewName] = useState('');
  const [editId, setEditId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');

  const send = async (method: string, body?: object, query = '') => {
    const res = await fetch(`/api/admin/marketplace/categories${query}`, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = await res.json();
    if (!res.ok) { toast.error(json.error || 'Failed'); return null; }
    onChanged();
    return json;
  };

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    const maxOrder = Math.max(0, ...categories.filter((c) => c.sort_order < 99).map((c) => c.sort_order));
    if (await send('POST', { name: newName, sort_order: maxOrder + 1 })) { setNewName(''); toast.success('Category added'); }
  };

  const rename = async (id: number) => {
    if (await send('PATCH', { id, name: editName })) setEditId(null);
  };

  const remove = async (c: MarketplaceCategory) => {
    const json = await send('DELETE', undefined, `?id=${c.id}`);
    if (json?.deactivated) toast.success(`“${c.name}” is in use, so it was hidden instead of deleted`);
    else if (json) toast.success('Category deleted');
  };

  return (
    <div className="card max-w-2xl">
      <form onSubmit={add} className="flex gap-2 p-4 border-b border-coffee-100">
        <input className="input" placeholder="New category name" value={newName} onChange={(e) => setNewName(e.target.value)} required maxLength={80} />
        <button type="submit" className="btn btn-primary gap-1.5 whitespace-nowrap"><Plus className="w-4 h-4" /> Add</button>
      </form>
      <ul className="divide-y divide-coffee-100">
        {categories.map((c) => (
          <li key={c.id} className="flex items-center gap-3 px-4 py-3">
            {editId === c.id ? (
              <>
                <input className="input py-1.5" value={editName} onChange={(e) => setEditName(e.target.value)} autoFocus />
                <button onClick={() => rename(c.id)} className="p-2 text-green-700 hover:bg-green-50 rounded" aria-label="Save"><Check className="w-4 h-4" /></button>
                <button onClick={() => setEditId(null)} className="p-2 text-coffee-400 hover:bg-coffee-50 rounded" aria-label="Cancel"><X className="w-4 h-4" /></button>
              </>
            ) : (
              <>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${c.is_active ? 'text-gray-900' : 'text-coffee-400 line-through'}`}>{c.name}</p>
                  <p className="text-xs text-coffee-400">{c.listing_count ?? 0} listing{c.listing_count === 1 ? '' : 's'}{!c.is_active && ' · hidden'}</p>
                </div>
                {!c.is_active && (
                  <button onClick={() => send('PATCH', { id: c.id, is_active: true })} className="btn btn-secondary btn-sm">Show</button>
                )}
                <button onClick={() => { setEditId(c.id); setEditName(c.name); }} className="p-2 text-coffee-500 hover:bg-coffee-50 rounded" aria-label="Rename"><Pencil className="w-4 h-4" /></button>
                {c.is_active && (
                  <button onClick={() => remove(c)} className="p-2 text-red-500 hover:bg-red-50 rounded" aria-label="Delete"><Trash2 className="w-4 h-4" /></button>
                )}
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
