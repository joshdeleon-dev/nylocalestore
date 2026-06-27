'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Order, OrderStatus, Product, Category, PaymentMethod } from '@/types';
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  getOrderStatusColor,
  getOrderStatusLabel,
} from '@/utils/helpers';
import { Search, RefreshCw, Filter, X, Plus, Trash2, AlertTriangle, Pencil, Archive, ArchiveRestore } from 'lucide-react';
import { useTableSort } from '@/hooks/useTableSort';
import { SortableHeader } from '@/components/SortableHeader';
import { StickerPrint } from '@/components/StickerPrint';
import toast from 'react-hot-toast';

const STATUSES: OrderStatus[] = ['NEW', 'ACCEPTED', 'IN_PROGRESS', 'READY', 'COMPLETED', 'CANCELLED'];

interface NewOrderItem {
  product_id: number;
  product_name: string;
  quantity: number;
  unit_price: number;
}

interface NewOrderForm {
  customer_name: string;
  customer_phone: string;
  group_number: string;
  payment_method: PaymentMethod;
  notes: string;
  items: NewOrderItem[];
}

const EMPTY_ORDER: NewOrderForm = {
  customer_name: '',
  customer_phone: '',
  group_number: '',
  payment_method: 'CASH',
  notes: '',
  items: [],
};

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'ALL'>('ALL');
  const [selected, setSelected] = useState<Order | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [showArchiveDateModal, setShowArchiveDateModal] = useState(false);
  const [archiveBeforeDate, setArchiveBeforeDate] = useState('');

  // Create order state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newOrder, setNewOrder] = useState<NewOrderForm>(EMPTY_ORDER);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Edit order state
  const [editOrder, setEditOrder] = useState<Order | null>(null);
  const [editForm, setEditForm] = useState({ customer_name: '', customer_phone: '', group_number: '', payment_method: 'CASH' as PaymentMethod, notes: '', order_date: '', sales_date: '' });
  const [editItems, setEditItems] = useState<NewOrderItem[]>([]);
  const [editProductSearch, setEditProductSearch] = useState('');
  const [editSubmitting, setEditSubmitting] = useState(false);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '200' });
      if (statusFilter !== 'ALL') params.set('status', statusFilter);
      if (showArchived) params.set('archived_only', 'true');
      const res = await fetch(`/api/orders?${params}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setOrders(json.data || []);
    } catch {
      toast.error('Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  const fetchProducts = async () => {
    const [prodsRes, { data: cats }] = await Promise.all([
      fetch('/api/products?all=true').then((r) => r.json()),
      supabase.from('categories').select('*').eq('is_active', true).order('display_order'),
    ]);
    setProducts(prodsRes.data || []);
    setCategories(cats || []);
  };

  useEffect(() => {
    fetchOrders();
    fetchProducts();
  }, [statusFilter, showArchived]);

  // Convert a UTC ISO timestamp to a datetime-local string in Eastern time
  const toEasternDatetimeLocal = (utcStr: string): string => {
    if (!utcStr) return '';
    return new Intl.DateTimeFormat('sv-SE', {
      timeZone: 'America/New_York',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit',
    }).format(new Date(utcStr)).replace(' ', 'T');
  };

  const openEdit = (order: Order) => {
    setEditOrder(order);
    setEditForm({
      customer_name: order.customer_name,
      customer_phone: (order as any).customer_phone || '',
      group_number: String(order.group_number),
      payment_method: order.payment_method as PaymentMethod,
      notes: (order as any).notes || '',
      order_date: toEasternDatetimeLocal(order.order_date || (order as any).created_at),
      sales_date: (order as any).sales_date || '',
    });
    setEditItems((order.items || []).map((item: any) => ({
      product_id: item.product_id,
      product_name: item.product?.name || '',
      quantity: item.quantity,
      unit_price: item.unit_price,
    })));
    setEditProductSearch('');
  };

  const addEditItem = (product: Product) => {
    setEditItems((prev) => {
      const exists = prev.find((i) => i.product_id === product.id);
      if (exists) return prev.map((i) => i.product_id === product.id ? { ...i, quantity: i.quantity + 1 } : i);
      return [...prev, { product_id: product.id, product_name: product.name, quantity: 1, unit_price: product.base_price }];
    });
  };

  const removeEditItem = (productId: number) => setEditItems((prev) => prev.filter((i) => i.product_id !== productId));

  const updateEditQty = (productId: number, qty: number) => {
    if (qty <= 0) { removeEditItem(productId); return; }
    setEditItems((prev) => prev.map((i) => i.product_id === productId ? { ...i, quantity: qty } : i));
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editOrder) return;
    if (!editForm.customer_name.trim()) { toast.error('Customer name is required'); return; }
    if (editItems.length === 0) { toast.error('Add at least one item'); return; }
    setEditSubmitting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const res = await fetch(`/api/orders/${editOrder.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({
          customer_name: editForm.customer_name.trim(),
          customer_phone: editForm.customer_phone.trim() || null,
          group_number: parseInt(editForm.group_number) || 1,
          payment_method: editForm.payment_method,
          notes: editForm.notes.trim() || null,
          order_date: editForm.order_date ? new Date(editForm.order_date).toISOString() : new Date().toISOString(),
          sales_date: editForm.sales_date,
          items: editItems.map((i) => ({ product_id: i.product_id, quantity: i.quantity, unit_price: i.unit_price, modifiers: [] })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update order');
      toast.success('Order updated');
      setEditOrder(null);
      setSelected(null);
      fetchOrders();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update order');
    } finally {
      setEditSubmitting(false);
    }
  };

  const deleteOrder = async (order: Order) => {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    setDeletingId(order.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const res = await fetch(`/api/orders/${order.id}`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      toast.success(`Order ${order.order_number} deleted — inventory restored`);
      setSelected(null);
      setConfirmDelete(false);
      fetchOrders();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete order');
    } finally {
      setDeletingId(null);
    }
  };

  const handleBulkDelete = async () => {
    setBulkDeleting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const res = await fetch('/api/orders', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      toast.success(`${json.deleted} order${json.deleted !== 1 ? 's' : ''} deleted — inventory restored`);
      setSelectedIds(new Set());
      setConfirmBulkDelete(false);
      fetchOrders();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete orders');
    } finally {
      setBulkDeleting(false);
    }
  };

  const archiveOrders = async (ids: number[], archive: boolean) => {
    setArchiving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const res = await fetch('/api/orders', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ ids, archive }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      toast.success(archive ? `${ids.length} order${ids.length !== 1 ? 's' : ''} archived` : `${ids.length} order${ids.length !== 1 ? 's' : ''} unarchived`);
      setSelectedIds(new Set());
      setSelected(null);
      fetchOrders();
    } catch (err: any) {
      toast.error(err.message || 'Failed to archive orders');
    } finally {
      setArchiving(false);
    }
  };

  const archiveBeforeDate_ = async () => {
    if (!archiveBeforeDate) return;
    setArchiving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const res = await fetch('/api/orders', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ before_date: archiveBeforeDate, archive: true }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      toast.success(`${json.count} order${json.count !== 1 ? 's' : ''} archived`);
      setShowArchiveDateModal(false);
      setArchiveBeforeDate('');
      fetchOrders();
    } catch (err: any) {
      toast.error(err.message || 'Failed to archive orders');
    } finally {
      setArchiving(false);
    }
  };

  const updateStatus = async (orderId: number, status: OrderStatus) => {
    try {
      const res = await fetch('/api/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: orderId, status }),
      });
      if (!res.ok) throw new Error();
      toast.success('Order status updated');
      fetchOrders();
      setSelected(null);
    } catch {
      toast.error('Failed to update status');
    }
  };

  const openCreateModal = () => {
    setNewOrder(EMPTY_ORDER);
    setProductSearch('');
    setShowCreateModal(true);
  };

  const addItem = (product: Product) => {
    setNewOrder((o) => {
      const exists = o.items.find((i) => i.product_id === product.id);
      if (exists) {
        return {
          ...o,
          items: o.items.map((i) =>
            i.product_id === product.id ? { ...i, quantity: i.quantity + 1 } : i
          ),
        };
      }
      return {
        ...o,
        items: [
          ...o.items,
          {
            product_id: product.id,
            product_name: product.name,
            quantity: 1,
            unit_price: product.base_price,
          },
        ],
      };
    });
  };

  const removeItem = (productId: number) => {
    setNewOrder((o) => ({ ...o, items: o.items.filter((i) => i.product_id !== productId) }));
  };

  const updateQty = (productId: number, qty: number) => {
    if (qty <= 0) { removeItem(productId); return; }
    setNewOrder((o) => ({
      ...o,
      items: o.items.map((i) => i.product_id === productId ? { ...i, quantity: qty } : i),
    }));
  };

  const subtotal = newOrder.items.reduce((s, i) => s + i.unit_price * i.quantity, 0);
  const total = subtotal; // tax = 0

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrder.customer_name.trim()) { toast.error('Customer name is required'); return; }
    if (newOrder.items.length === 0) { toast.error('Add at least one item'); return; }
    setSubmitting(true);
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_name: newOrder.customer_name.trim(),
          customer_phone: newOrder.customer_phone.trim() || null,
          group_number: newOrder.group_number ? parseInt(newOrder.group_number) : 1,
          payment_method: newOrder.payment_method,
          notes: newOrder.notes.trim() || null,
          items: newOrder.items.map((i) => ({
            product_id: i.product_id,
            quantity: i.quantity,
            unit_price: i.unit_price,
            modifiers: [],
          })),
          order_date: new Date().toISOString(),
          sales_date: new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date()),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create order');
      toast.success(`Order ${data.data?.order_number || ''} created`);
      setShowCreateModal(false);
      fetchOrders();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create order');
    } finally {
      setSubmitting(false);
    }
  };

  const preFiltered = orders.filter(
    (o) =>
      o.order_number.toLowerCase().includes(search.toLowerCase()) ||
      o.customer_name.toLowerCase().includes(search.toLowerCase())
  );

  const { sorted: filtered, sortKey, sortDir, requestSort } = useTableSort(preFiltered, {
    order_number:  (o) => o.order_number,
    customer_name: (o) => o.customer_name,
    items:         (o) => o.items?.length ?? 0,
    date:          (o) => (o as any).sales_date ?? '',
    status:        (o) => o.status,
    payment:       (o) => o.payment_method,
    total:         (o) => o.total,
  });

  const filteredProducts = products.filter(
    (p) =>
      !productSearch ||
      p.name.toLowerCase().includes(productSearch.toLowerCase())
  );

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Orders</h1>
          {showArchived && <p className="text-xs text-amber-600 font-medium mt-0.5">Viewing archived orders</p>}
        </div>
        <div className="flex gap-2 flex-wrap justify-end">
          <button
            onClick={() => { setShowArchived((v) => !v); setSelectedIds(new Set()); setSelected(null); }}
            className={`btn btn-sm gap-1.5 ${showArchived ? 'bg-amber-100 text-amber-800 border-amber-300 hover:bg-amber-200' : 'btn-secondary'}`}
          >
            <Archive className="w-4 h-4" />
            {showArchived ? 'Exit Archive' : 'View Archive'}
          </button>
          {!showArchived && (
            <button onClick={() => setShowArchiveDateModal(true)} className="btn btn-secondary btn-sm gap-1.5">
              <Archive className="w-4 h-4" />
              Archive Before…
            </button>
          )}
          {!showArchived && (
            <button onClick={openCreateModal} className="btn btn-primary gap-2">
              <Plus className="w-4 h-4" />
              New Order
            </button>
          )}
          <button onClick={fetchOrders} className="btn btn-secondary btn-sm gap-2" disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by order # or customer name…"
            className="input pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as OrderStatus | 'ALL')}
            className="select"
          >
            <option value="ALL">All Statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>{getOrderStatusLabel(s)}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 mb-3 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl">
          <span className="text-sm font-medium text-gray-800">
            {selectedIds.size} order{selectedIds.size !== 1 ? 's' : ''} selected
          </span>
          <button onClick={() => setSelectedIds(new Set())} className="text-xs text-gray-500 hover:underline">
            Clear
          </button>
          <div className="ml-auto flex gap-2">
            {showArchived ? (
              <button
                onClick={() => archiveOrders(Array.from(selectedIds), false)}
                disabled={archiving}
                className="btn btn-sm bg-amber-500 text-white hover:bg-amber-600 border-0 gap-1.5"
              >
                <ArchiveRestore className="w-3.5 h-3.5" />
                {archiving ? 'Unarchiving…' : `Unarchive ${selectedIds.size}`}
              </button>
            ) : (
              <button
                onClick={() => archiveOrders(Array.from(selectedIds), true)}
                disabled={archiving}
                className="btn btn-sm bg-amber-600 text-white hover:bg-amber-700 border-0 gap-1.5"
              >
                <Archive className="w-3.5 h-3.5" />
                {archiving ? 'Archiving…' : `Archive ${selectedIds.size}`}
              </button>
            )}
            <button
              onClick={() => setConfirmBulkDelete(true)}
              className="btn btn-sm bg-red-600 text-white hover:bg-red-700 border-0 gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete {selectedIds.size}
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    className="checkbox"
                    checked={filtered.length > 0 && filtered.every((o) => selectedIds.has(o.id))}
                    ref={(el) => { if (el) el.indeterminate = selectedIds.size > 0 && !filtered.every((o) => selectedIds.has(o.id)); }}
                    onChange={(e) => setSelectedIds(e.target.checked ? new Set(filtered.map((o) => o.id)) : new Set())}
                  />
                </th>
                <SortableHeader label="Order #"  sortKey="order_number"  currentKey={sortKey} dir={sortDir} onSort={requestSort} />
                <SortableHeader label="Customer" sortKey="customer_name" currentKey={sortKey} dir={sortDir} onSort={requestSort} />
                <SortableHeader label="Items"    sortKey="items"         currentKey={sortKey} dir={sortDir} onSort={requestSort} />
                <SortableHeader label="Date"     sortKey="date"          currentKey={sortKey} dir={sortDir} onSort={requestSort} />
                <SortableHeader label="Status"   sortKey="status"        currentKey={sortKey} dir={sortDir} onSort={requestSort} />
                <SortableHeader label="Payment"  sortKey="payment"       currentKey={sortKey} dir={sortDir} onSort={requestSort} />
                <SortableHeader label="Total"    sortKey="total"         currentKey={sortKey} dir={sortDir} onSort={requestSort} />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading
                ? Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i}>
                      <td colSpan={8} className="px-5 py-3"><div className="skeleton h-4 rounded" /></td>
                    </tr>
                  ))
                : filtered.map((order) => (
                    <tr
                      key={order.id}
                      onClick={() => setSelected(order)}
                      className={`cursor-pointer transition-colors ${selectedIds.has(order.id) ? 'bg-red-50 hover:bg-red-100' : 'hover:bg-gray-50'}`}
                    >
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          className="checkbox"
                          checked={selectedIds.has(order.id)}
                          onChange={() => setSelectedIds((prev) => {
                            const next = new Set(prev);
                            next.has(order.id) ? next.delete(order.id) : next.add(order.id);
                            return next;
                          })}
                        />
                      </td>
                      <td className="px-5 py-3 font-mono text-coffee-700 font-semibold text-xs">{order.order_number}</td>
                      <td className="px-5 py-3">
                        <p className="font-medium text-gray-900">{order.customer_name}</p>
                        <p className="text-xs text-gray-400">#{order.group_number}</p>
                      </td>
                      <td className="px-5 py-3 text-gray-600">{order.items?.length ?? 0} item{order.items?.length !== 1 ? 's' : ''}</td>
                      <td className="px-5 py-3 text-gray-500 text-xs">{formatDate((order as any).sales_date)}</td>
                      <td className="px-5 py-3">
                        <span className={`badge ${getOrderStatusColor(order.status as OrderStatus)}`}>{getOrderStatusLabel(order.status as OrderStatus)}</span>
                      </td>
                      <td className="px-5 py-3 text-xs text-gray-500">{order.payment_method}</td>
                      <td className="px-5 py-3 font-semibold text-gray-900">{formatCurrency(order.total)}</td>
                    </tr>
                  ))}
            </tbody>
          </table>
          {!loading && filtered.length === 0 && (
            <div className="text-center py-10 text-gray-400">No orders found.</div>
          )}
        </div>
      </div>

      {/* Order Detail Drawer */}
      {selected && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="fixed inset-0 bg-black/40" onClick={() => { setSelected(null); setConfirmDelete(false); }} />
          <div className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <p className="text-xs text-gray-500 font-mono">{selected.order_number}</p>
                <h2 className="text-lg font-bold text-gray-900">{selected.customer_name}</h2>
              </div>
              <button onClick={() => { setSelected(null); setConfirmDelete(false); }} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex-1 p-6 space-y-5">
              <div className="flex items-center justify-between">
                <span className={`badge ${getOrderStatusColor(selected.status as OrderStatus)}`}>{getOrderStatusLabel(selected.status as OrderStatus)}</span>
                <div className="flex items-center gap-2">
                  <StickerPrint order={selected} />
                  <button onClick={() => openEdit(selected)} className="btn btn-secondary btn-sm gap-1.5">
                    <Pencil className="w-3.5 h-3.5" /> Edit Order
                  </button>
                </div>
              </div>
              <div>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Items</h3>
                <div className="space-y-3">
                  {selected.items?.map((item) => (
                    <div key={item.id} className="text-sm">
                      <p className="font-semibold">{item.quantity}× {(item as any).product?.name}</p>
                      {item.modifiers && item.modifiers.length > 0 && (
                        <ul className="text-xs text-gray-500 mt-1 ml-3 space-y-0.5">
                          {item.modifiers.map((m, i) => <li key={i}>• {m.name}</li>)}
                        </ul>
                      )}
                      <p className="text-xs text-gray-500 mt-0.5">{formatCurrency(item.line_total)}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="border-t border-gray-100 pt-4 space-y-1 text-sm">
                <div className="flex justify-between text-gray-600"><span>Subtotal</span><span>{formatCurrency(selected.subtotal)}</span></div>
                <div className="flex justify-between text-gray-600"><span>Tax</span><span>{formatCurrency(selected.tax)}</span></div>
                <div className="flex justify-between font-bold text-gray-900 text-base pt-1 border-t border-gray-100"><span>Total</span><span>{formatCurrency(selected.total)}</span></div>
              </div>
              {selected.notes && (
                <div className="bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 text-sm text-amber-900">
                  <p className="font-semibold text-xs mb-1">Note</p>
                  {selected.notes}
                </div>
              )}
              <div>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Update Status</h3>
                <div className="grid grid-cols-2 gap-2">
                  {STATUSES.filter((s) => s !== selected.status).map((s) => (
                    <button key={s} onClick={() => updateStatus(selected.id, s)} className="btn btn-outline btn-sm justify-center">
                      {getOrderStatusLabel(s)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="border-t border-gray-100 pt-4 space-y-2">
                {/* Archive / Unarchive */}
                <button
                  onClick={() => archiveOrders([selected.id], !(selected as any).is_archived)}
                  disabled={archiving}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-amber-700 hover:bg-amber-50 border border-amber-200 rounded-xl transition-colors"
                >
                  {(selected as any).is_archived ? <ArchiveRestore className="w-4 h-4" /> : <Archive className="w-4 h-4" />}
                  {(selected as any).is_archived ? 'Unarchive Order' : 'Archive Order'}
                </button>

                {/* Delete */}
                {confirmDelete ? (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                    <div className="flex items-start gap-2 mb-3">
                      <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-red-800">
                        This will permanently delete <strong>{selected.order_number}</strong> and restore inventory quantities. This cannot be undone.
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setConfirmDelete(false)}
                        className="btn btn-secondary btn-sm flex-1 justify-center"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => deleteOrder(selected)}
                        disabled={deletingId === selected.id}
                        className="btn btn-sm flex-1 justify-center bg-red-600 text-white hover:bg-red-700 border-0"
                      >
                        {deletingId === selected.id ? 'Deleting…' : 'Yes, Delete'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => deleteOrder(selected)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 border border-red-200 rounded-xl transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete Order
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Delete Confirmation Modal */}
      {confirmBulkDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50" onClick={() => setConfirmBulkDelete(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-start gap-3 mb-4">
              <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <h2 className="font-bold text-gray-900">Delete {selectedIds.size} order{selectedIds.size !== 1 ? 's' : ''}?</h2>
                <p className="text-sm text-gray-500 mt-1">
                  This will permanently delete the selected orders and restore their inventory quantities. This cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setConfirmBulkDelete(false)} className="btn btn-secondary flex-1 justify-center">Cancel</button>
              <button
                onClick={handleBulkDelete}
                disabled={bulkDeleting}
                className="btn flex-1 justify-center bg-red-600 text-white hover:bg-red-700 border-0"
              >
                {bulkDeleting ? 'Deleting…' : 'Yes, Delete All'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Order Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50" onClick={() => setShowCreateModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-y-auto max-h-[92vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-bold">Create New Order</h2>
              <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleCreateOrder} className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Left: Customer Info */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-gray-700 text-sm">Customer Info</h3>
                  <div>
                    <label className="label">Customer Name *</label>
                    <input className="input" value={newOrder.customer_name} onChange={(e) => setNewOrder({ ...newOrder, customer_name: e.target.value })} placeholder="Jane Smith" required />
                  </div>
                  <div>
                    <label className="label">Phone (optional)</label>
                    <input className="input" type="tel" value={newOrder.customer_phone} onChange={(e) => setNewOrder({ ...newOrder, customer_phone: e.target.value })} placeholder="(212) 555-0000" />
                  </div>
                  <div>
                    <label className="label">Group #</label>
                    <input className="input" type="number" min="1" value={newOrder.group_number} onChange={(e) => setNewOrder({ ...newOrder, group_number: e.target.value })} placeholder="1" />
                  </div>
                  <div>
                    <label className="label">Payment Method</label>
                    <select className="select" value={newOrder.payment_method} onChange={(e) => setNewOrder({ ...newOrder, payment_method: e.target.value as PaymentMethod })}>
                      <option value="CASH">Cash</option>
                      <option value="CARD">Card</option>
                      <option value="MOBILE">Mobile</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">Notes</label>
                    <textarea className="textarea" rows={2} value={newOrder.notes} onChange={(e) => setNewOrder({ ...newOrder, notes: e.target.value })} placeholder="Any special requests…" />
                  </div>

                  {/* Order Summary */}
                  {newOrder.items.length > 0 && (
                    <div className="border-t border-gray-100 pt-4">
                      <h3 className="font-semibold text-gray-700 text-sm mb-3">Order Items</h3>
                      <div className="space-y-2">
                        {newOrder.items.map((item) => (
                          <div key={item.product_id} className="flex items-center gap-2 text-sm">
                            <input
                              type="number"
                              min="1"
                              className="w-14 input text-center py-1 text-sm"
                              value={item.quantity}
                              onChange={(e) => updateQty(item.product_id, parseInt(e.target.value) || 0)}
                            />
                            <span className="flex-1 font-medium">{item.product_name}</span>
                            <span className="text-gray-500">{formatCurrency(item.unit_price * item.quantity)}</span>
                            <button type="button" onClick={() => removeItem(item.product_id)} className="text-red-400 hover:text-red-600">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                      <div className="border-t border-gray-100 mt-3 pt-2 flex justify-between font-bold text-gray-900">
                        <span>Total</span>
                        <span>{formatCurrency(total)}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Right: Product Picker */}
                <div>
                  <h3 className="font-semibold text-gray-700 text-sm mb-3">Add Products</h3>
                  <div className="relative mb-3">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      className="input pl-9 text-sm"
                      value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                      placeholder="Search products…"
                    />
                  </div>
                  <div className="space-y-1.5 max-h-80 overflow-y-auto">
                    {filteredProducts.map((p) => {
                      const catName = categories.find((c) => c.id === p.category_id)?.name;
                      const inOrder = newOrder.items.find((i) => i.product_id === p.id);
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => addItem(p)}
                          className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-coffee-50 transition-colors text-left border border-transparent hover:border-coffee-200"
                        >
                          <div className="w-10 h-10 rounded-lg bg-coffee-100 flex-shrink-0 overflow-hidden">
                            {p.image_url ? (
                              <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-coffee-300 text-xs font-bold">☕</div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{p.name}</p>
                            {catName && <p className="text-xs text-gray-400">{catName}</p>}
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="font-bold text-coffee-700 text-sm">{formatCurrency(p.base_price)}</p>
                            {inOrder && <p className="text-xs text-green-600 font-medium">×{inOrder.quantity}</p>}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="flex gap-3 mt-6 pt-4 border-t border-gray-100">
                <button type="button" onClick={() => setShowCreateModal(false)} className="btn btn-secondary flex-1 justify-center">Cancel</button>
                <button type="submit" disabled={submitting || newOrder.items.length === 0} className="btn btn-primary flex-1 justify-center">
                  {submitting ? 'Creating…' : `Create Order — ${formatCurrency(total)}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Archive Before Date Modal */}
      {showArchiveDateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50" onClick={() => setShowArchiveDateModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h2 className="font-bold text-gray-900 mb-1">Archive Completed Orders</h2>
            <p className="text-sm text-gray-500 mb-5">
              All <strong>Completed</strong> and <strong>Cancelled</strong> orders with a sales date before the selected date will be archived and hidden from the Orders list. They will still appear in reports.
            </p>
            <div className="mb-5">
              <label className="label">Archive orders before</label>
              <input
                type="date"
                className="input"
                value={archiveBeforeDate}
                onChange={(e) => setArchiveBeforeDate(e.target.value)}
              />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowArchiveDateModal(false)} className="btn btn-secondary flex-1 justify-center">Cancel</button>
              <button
                onClick={archiveBeforeDate_}
                disabled={!archiveBeforeDate || archiving}
                className="btn flex-1 justify-center bg-amber-600 text-white hover:bg-amber-700 border-0 gap-1.5"
              >
                <Archive className="w-4 h-4" />
                {archiving ? 'Archiving…' : 'Archive'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Order Modal */}
      {editOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50" onClick={() => setEditOrder(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-y-auto max-h-[92vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <p className="text-xs text-gray-500 font-mono">{editOrder.order_number}</p>
                <h2 className="text-lg font-bold">Edit Order</h2>
              </div>
              <button onClick={() => setEditOrder(null)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSaveEdit} className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                {/* Left: Customer Info + Dates */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-gray-700 text-sm">Customer Info</h3>
                  <div>
                    <label className="label">Customer Name *</label>
                    <input className="input" value={editForm.customer_name} onChange={(e) => setEditForm({ ...editForm, customer_name: e.target.value })} required />
                  </div>
                  <div>
                    <label className="label">Phone</label>
                    <input className="input" type="tel" value={editForm.customer_phone} onChange={(e) => setEditForm({ ...editForm, customer_phone: e.target.value })} placeholder="(212) 555-0000" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label">Group #</label>
                      <input className="input" type="number" min="1" value={editForm.group_number} onChange={(e) => setEditForm({ ...editForm, group_number: e.target.value })} />
                    </div>
                    <div>
                      <label className="label">Payment</label>
                      <select className="select" value={editForm.payment_method} onChange={(e) => setEditForm({ ...editForm, payment_method: e.target.value as PaymentMethod })}>
                        <option value="CASH">Cash</option>
                        <option value="CARD">Card</option>
                        <option value="MOBILE">Mobile</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="label">Notes</label>
                    <textarea className="textarea" rows={2} value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} />
                  </div>

                  <h3 className="font-semibold text-gray-700 text-sm pt-2">Dates</h3>
                  <div>
                    <label className="label">Order Date & Time (Eastern)</label>
                    <input className="input" type="datetime-local" value={editForm.order_date} onChange={(e) => setEditForm({ ...editForm, order_date: e.target.value })} />
                  </div>
                  <div>
                    <label className="label">Sales Date</label>
                    <input className="input" type="date" value={editForm.sales_date} onChange={(e) => setEditForm({ ...editForm, sales_date: e.target.value })} />
                  </div>

                  {/* Current Items Summary */}
                  {editItems.length > 0 && (
                    <div className="border-t border-gray-100 pt-4">
                      <h3 className="font-semibold text-gray-700 text-sm mb-3">Items in Order</h3>
                      <div className="space-y-2">
                        {editItems.map((item) => (
                          <div key={item.product_id} className="flex items-center gap-2 text-sm">
                            <input
                              type="number"
                              min="1"
                              className="w-14 input text-center py-1 text-sm"
                              value={item.quantity}
                              onChange={(e) => updateEditQty(item.product_id, parseInt(e.target.value) || 0)}
                            />
                            <span className="flex-1 font-medium">{item.product_name}</span>
                            <span className="text-gray-500">{formatCurrency(item.unit_price * item.quantity)}</span>
                            <button type="button" onClick={() => removeEditItem(item.product_id)} className="text-red-400 hover:text-red-600">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                      <div className="border-t border-gray-100 mt-3 pt-2 flex justify-between font-bold text-gray-900">
                        <span>Total</span>
                        <span>{formatCurrency(editItems.reduce((s, i) => s + i.unit_price * i.quantity, 0))}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Right: Product Picker */}
                <div>
                  <h3 className="font-semibold text-gray-700 text-sm mb-3">Add / Replace Products</h3>
                  <div className="relative mb-3">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      className="input pl-9 text-sm"
                      value={editProductSearch}
                      onChange={(e) => setEditProductSearch(e.target.value)}
                      placeholder="Search products…"
                    />
                  </div>
                  <div className="space-y-1.5 max-h-96 overflow-y-auto">
                    {products
                      .filter((p) => !editProductSearch || p.name.toLowerCase().includes(editProductSearch.toLowerCase()))
                      .map((p) => {
                        const inEdit = editItems.find((i) => i.product_id === p.id);
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => addEditItem(p)}
                            className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-coffee-50 transition-colors text-left border border-transparent hover:border-coffee-200"
                          >
                            <div className="w-10 h-10 rounded-lg bg-coffee-100 flex-shrink-0 overflow-hidden">
                              {p.image_url ? (
                                <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-coffee-300 text-xs font-bold">☕</div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{p.name}</p>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <p className="font-bold text-coffee-700 text-sm">{formatCurrency(p.base_price)}</p>
                              {inEdit && <p className="text-xs text-green-600 font-medium">×{inEdit.quantity} in order</p>}
                            </div>
                          </button>
                        );
                      })}
                  </div>
                </div>
              </div>

              <div className="flex gap-3 mt-6 pt-4 border-t border-gray-100">
                <button type="button" onClick={() => setEditOrder(null)} className="btn btn-secondary flex-1 justify-center">Cancel</button>
                <button type="submit" disabled={editSubmitting || editItems.length === 0} className="btn btn-primary flex-1 justify-center">
                  {editSubmitting ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
