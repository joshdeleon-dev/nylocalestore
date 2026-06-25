'use client';

import { useEffect, useState } from 'react';
import { formatDate } from '@/utils/helpers';
import { Tag, Search, Printer, Download, Plus, X, CheckSquare, Square, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';

interface OrderItem {
  id: number;
  product_id: number;
  quantity: number;
  unit_price: number;
  line_total: number;
  product?: { name: string };
  modifiers?: { name: string }[];
}

interface Order {
  id: number;
  order_number: string;
  customer_name: string;
  group_number: number;
  sales_date: string;
  order_date: string;
  notes?: string;
  total: number;
  status: string;
  items?: OrderItem[];
}

interface TicketData {
  order_number: string;
  customer_name: string;
  group_number: number;
  sales_date: string;
  item_name: string;
  modifiers: string[];
  notes: string;
  ticket_index: number;
  ticket_total: number;
  is_custom?: boolean;
}

interface CustomTicketEntry {
  id: string;
  customer_name: string;
  item_name: string;
  notes: string;
  quantity: number;
}

function esc(str: string) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function TicketPreview({ t }: { t: TicketData }) {
  return (
    <div
      className="border border-gray-300 rounded bg-white p-2 font-mono leading-tight flex flex-col justify-between"
      style={{ minHeight: '80px' }}
    >
      <div className="flex items-baseline justify-between gap-1">
        <span className="font-bold text-[11px] uppercase truncate">{t.customer_name}</span>
        {t.group_number > 0 && <span className="font-bold text-[10px] flex-shrink-0">#{t.group_number}</span>}
      </div>
      <div className="font-semibold text-[10px] truncate mt-0.5">{t.item_name}</div>
      {t.modifiers.length > 0 && (
        <div className="text-[8px] text-gray-500 truncate">{t.modifiers.map((m) => `• ${m}`).join('  ')}</div>
      )}
      <div className="flex items-end justify-between border-t border-gray-200 pt-1 mt-auto">
        <span className="text-[8px] text-gray-400 truncate flex-1">{t.notes || ''}</span>
        {t.ticket_total > 1 && (
          <span className="text-[9px] font-bold ml-2 flex-shrink-0">{t.ticket_index} of {t.ticket_total}</span>
        )}
      </div>
      <div className="text-[7px] text-gray-400 mt-0.5">
        {t.is_custom ? 'CUSTOM' : t.order_number}{t.sales_date ? ` · ${t.sales_date}` : ''}
      </div>
    </div>
  );
}

export default function OrderTicketsModule() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [customTickets, setCustomTickets] = useState<CustomTicketEntry[]>([]);
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customForm, setCustomForm] = useState({ customer_name: '', item_name: '', notes: '', quantity: 1 });

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '200' });
      if (dateFilter) params.set('start_date', dateFilter);
      const res = await fetch(`/api/orders?${params}`);
      const json = await res.json();
      setOrders(json.data || []);
    } catch {
      toast.error('Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchOrders(); }, [dateFilter]);

  const filtered = orders.filter(
    (o) =>
      !search ||
      o.customer_name.toLowerCase().includes(search.toLowerCase()) ||
      o.order_number.toLowerCase().includes(search.toLowerCase())
  );

  const toggleOrder = (id: number) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const buildTickets = (): TicketData[] => {
    const result: TicketData[] = [];

    for (const order of orders.filter((o) => selectedIds.has(o.id))) {
      // Expand each item by its quantity → one ticket per drink
      const expanded: { name: string; modifiers: string[] }[] = [];
      for (const item of order.items || []) {
        for (let q = 0; q < item.quantity; q++) {
          expanded.push({
            name: item.product?.name || 'Unknown Item',
            modifiers: (item.modifiers || []).map((m) => m.name),
          });
        }
      }
      const total = expanded.length;
      expanded.forEach((item, idx) => {
        result.push({
          order_number: order.order_number,
          customer_name: order.customer_name,
          group_number: order.group_number,
          sales_date: order.sales_date,
          item_name: item.name,
          modifiers: item.modifiers,
          notes: order.notes || '',
          ticket_index: idx + 1,
          ticket_total: total,
        });
      });
    }

    // Custom tickets
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date());
    for (const ct of customTickets) {
      for (let i = 0; i < ct.quantity; i++) {
        result.push({
          order_number: 'CUSTOM',
          customer_name: ct.customer_name,
          group_number: 0,
          sales_date: today,
          item_name: ct.item_name,
          modifiers: [],
          notes: ct.notes,
          ticket_index: i + 1,
          ticket_total: ct.quantity,
          is_custom: true,
        });
      }
    }

    return result;
  };

  const tickets = buildTickets();

  const printTickets = () => {
    if (!tickets.length) { toast.error('No tickets selected'); return; }

    const stickers = tickets
      .map(
        (t) => `
      <div class="ticket">
        <div class="top">
          <span class="name">${esc(t.customer_name)}</span>
          ${t.group_number > 0 ? `<span class="grp">#${t.group_number}</span>` : ''}
        </div>
        <div class="item">${esc(t.item_name)}</div>
        ${t.modifiers.length ? `<div class="mods">${t.modifiers.map((m) => `• ${esc(m)}`).join('  ')}</div>` : ''}
        <div class="bot">
          <span class="notes">${t.notes ? esc(t.notes.slice(0, 55)) : ''}</span>
          ${t.ticket_total > 1 ? `<span class="cnt">${t.ticket_index} of ${t.ticket_total}</span>` : ''}
        </div>
        <div class="meta">${t.is_custom ? 'CUSTOM' : esc(t.order_number)}${t.sales_date ? ' · ' + t.sales_date : ''}</div>
      </div>`
      )
      .join('');

    const win = window.open('', '_blank', 'width=650,height=850');
    if (!win) { toast.error('Popup blocked — please allow popups to print'); return; }

    win.document.write(`<!DOCTYPE html>
<html><head><title>Order Tickets</title><style>
@page { size: 3in 1in; margin: 0; }
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: 'Courier New', monospace; background: white; color: black; }
.ticket {
  width: 3in; height: 1in;
  padding: 5px 7px 4px;
  page-break-after: always;
  display: flex; flex-direction: column; justify-content: space-between;
  overflow: hidden;
  border: 1px solid #000;
}
.ticket:last-child { page-break-after: avoid; }
.top { display: flex; justify-content: space-between; align-items: baseline; }
.name { font-size: 12.5pt; font-weight: bold; text-transform: uppercase; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 78%; }
.grp  { font-size: 10.5pt; font-weight: bold; flex-shrink: 0; }
.item { font-size: 9pt; font-weight: bold; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-top: 1px; }
.mods { font-size: 7pt; color: #444; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-top: 1px; }
.bot  { display: flex; justify-content: space-between; align-items: flex-end; border-top: 0.5px solid #bbb; padding-top: 2px; margin-top: auto; }
.notes { font-size: 6.5pt; color: #555; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cnt  { font-size: 8.5pt; font-weight: bold; margin-left: 6px; flex-shrink: 0; }
.meta { font-size: 5.5pt; color: #999; margin-top: 1px; }
@media screen { body { background: #e8e8e8; padding: 20px; } .ticket { margin: 10px auto; box-shadow: 0 1px 4px rgba(0,0,0,.2); } }
</style></head>
<body>${stickers}
<script>window.onload=function(){window.print();window.onafterprint=function(){window.close();};};<\/script>
</body></html>`);
    win.document.close();
  };

  const exportCSV = () => {
    if (!tickets.length) { toast.error('No tickets to export'); return; }
    const header = ['Order Number', 'Customer Name', 'Group #', 'Sales Date', 'Item', 'Modifiers', 'Notes', 'Ticket #', 'Total Tickets'];
    const rows = tickets.map((t) => [
      t.order_number,
      t.customer_name,
      t.group_number || '',
      t.sales_date,
      t.item_name,
      t.modifiers.join('; '),
      t.notes,
      t.ticket_index,
      t.ticket_total,
    ]);
    const csv = [header, ...rows]
      .map((row) => row.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `order-tickets-${new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date())}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('CSV downloaded');
  };

  const addCustomTicket = () => {
    if (!customForm.customer_name.trim() || !customForm.item_name.trim()) {
      toast.error('Customer name and item are required');
      return;
    }
    setCustomTickets((prev) => [...prev, { id: Date.now().toString(), ...customForm }]);
    setCustomForm({ customer_name: '', item_name: '', notes: '', quantity: 1 });
    setShowCustomForm(false);
    toast.success('Custom ticket added to print job');
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Tag className="w-6 h-6 text-coffee-700" />
          <h1 className="text-2xl font-bold text-gray-900">Order Tickets</h1>
          {tickets.length > 0 && (
            <span className="bg-coffee-100 text-coffee-700 text-xs font-bold px-2.5 py-0.5 rounded-full">
              {tickets.length} ticket{tickets.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowCustomForm(true)} className="btn btn-secondary gap-2">
            <Plus className="w-4 h-4" /> Custom Ticket
          </button>
          <button onClick={exportCSV} disabled={tickets.length === 0} className="btn btn-secondary gap-2">
            <Download className="w-4 h-4" /> Export CSV
          </button>
          <button onClick={printTickets} disabled={tickets.length === 0} className="btn btn-primary gap-2">
            <Printer className="w-4 h-4" />
            Print / PDF{tickets.length > 0 ? ` (${tickets.length})` : ''}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Left: Order list + custom tickets */}
        <div className="lg:col-span-2 space-y-4">
          {/* Filters */}
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or order #…"
                className="input pl-9"
              />
            </div>
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="input"
              title="Show orders from this sales date onward"
            />
            <button onClick={fetchOrders} disabled={loading} className="btn btn-secondary btn-sm">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Select controls */}
          <div className="flex items-center gap-3 text-sm">
            <button
              onClick={() => setSelectedIds(new Set(filtered.map((o) => o.id)))}
              className="text-coffee-700 hover:underline font-medium"
            >
              Select All
            </button>
            <span className="text-gray-300">|</span>
            <button onClick={() => setSelectedIds(new Set())} className="text-gray-500 hover:underline">
              Deselect All
            </button>
            {selectedIds.size > 0 && (
              <span className="text-gray-400">
                {selectedIds.size} order{selectedIds.size !== 1 ? 's' : ''} selected
              </span>
            )}
          </div>

          {/* Orders table */}
          <div className="card">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="w-10 px-4 py-3" />
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Order</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Customer</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Date</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Items & Modifiers</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {loading ? (
                    Array.from({ length: 6 }).map((_, i) => (
                      <tr key={i}>
                        <td colSpan={6} className="px-4 py-3">
                          <div className="skeleton h-4 rounded" />
                        </td>
                      </tr>
                    ))
                  ) : filtered.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-12 text-gray-400">
                        No orders found.
                      </td>
                    </tr>
                  ) : (
                    filtered.map((order) => {
                      const checked = selectedIds.has(order.id);
                      const totalQty = (order.items || []).reduce((s, i) => s + i.quantity, 0);
                      return (
                        <tr
                          key={order.id}
                          onClick={() => toggleOrder(order.id)}
                          className={`cursor-pointer transition-colors ${
                            checked ? 'bg-coffee-50 hover:bg-coffee-100' : 'hover:bg-gray-50'
                          }`}
                        >
                          <td className="px-4 py-3">
                            {checked ? (
                              <CheckSquare className="w-4 h-4 text-coffee-700" />
                            ) : (
                              <Square className="w-4 h-4 text-gray-300" />
                            )}
                          </td>
                          <td className="px-4 py-3 font-mono text-xs font-semibold text-coffee-700">
                            {order.order_number}
                          </td>
                          <td className="px-4 py-3">
                            <p className="font-medium">{order.customer_name}</p>
                            <p className="text-xs text-gray-400">Group #{order.group_number}</p>
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                            {formatDate(order.sales_date)}
                          </td>
                          <td className="px-4 py-3">
                            {(order.items || []).map((item) => (
                              <div key={item.id} className="text-xs leading-snug mb-0.5">
                                <span className="font-medium">
                                  {item.quantity}× {item.product?.name}
                                </span>
                                {(item.modifiers || []).length > 0 && (
                                  <span className="text-gray-400 ml-1">
                                    ({item.modifiers!.map((m) => m.name).join(', ')})
                                  </span>
                                )}
                              </div>
                            ))}
                            <p className="text-[10px] text-gray-400 mt-0.5">
                              → {totalQty} ticket{totalQty !== 1 ? 's' : ''}
                            </p>
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-500 max-w-[110px] truncate">
                            {order.notes || '—'}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Custom tickets list */}
          {customTickets.length > 0 && (
            <div className="card">
              <div className="card-content border-b border-gray-100 flex items-center justify-between">
                <h2 className="font-semibold text-sm text-gray-700">Custom Tickets</h2>
                <span className="text-xs text-gray-400">
                  {customTickets.reduce((s, t) => s + t.quantity, 0)} ticket{customTickets.reduce((s, t) => s + t.quantity, 0) !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="divide-y divide-gray-50">
                {customTickets.map((ct) => (
                  <div key={ct.id} className="flex items-center gap-3 px-5 py-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {ct.customer_name} — {ct.item_name}
                      </p>
                      {ct.notes && <p className="text-xs text-gray-400">{ct.notes}</p>}
                    </div>
                    <span className="text-xs text-gray-400 flex-shrink-0">×{ct.quantity}</span>
                    <button
                      onClick={() => setCustomTickets((prev) => prev.filter((t) => t.id !== ct.id))}
                      className="text-gray-300 hover:text-red-500 flex-shrink-0"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: Ticket preview */}
        <div>
          <div className="sticky top-6">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">
              Ticket Preview
            </p>
            {tickets.length === 0 ? (
              <div className="card p-10 text-center">
                <Tag className="w-10 h-10 mx-auto mb-2 text-gray-200" />
                <p className="text-sm text-gray-400">Select orders to preview tickets</p>
                <p className="text-xs text-gray-300 mt-1">3" × 1" per ticket</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[calc(100vh-220px)] overflow-y-auto pr-1">
                {tickets.map((t, i) => (
                  <TicketPreview key={i} t={t} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Custom Ticket Modal */}
      {showCustomForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50" onClick={() => setShowCustomForm(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-bold text-lg">Custom Ticket</h2>
              <button onClick={() => setShowCustomForm(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="label">Customer Name *</label>
                <input
                  className="input"
                  value={customForm.customer_name}
                  onChange={(e) => setCustomForm({ ...customForm, customer_name: e.target.value })}
                  placeholder="John Smith"
                  autoFocus
                />
              </div>
              <div>
                <label className="label">Item Description *</label>
                <input
                  className="input"
                  value={customForm.item_name}
                  onChange={(e) => setCustomForm({ ...customForm, item_name: e.target.value })}
                  placeholder="Oat Latte — extra shot, no sugar"
                />
              </div>
              <div>
                <label className="label">Notes (optional)</label>
                <input
                  className="input"
                  value={customForm.notes}
                  onChange={(e) => setCustomForm({ ...customForm, notes: e.target.value })}
                  placeholder="Any special instructions…"
                />
              </div>
              <div>
                <label className="label">Quantity</label>
                <input
                  className="input"
                  type="number"
                  min="1"
                  max="20"
                  value={customForm.quantity}
                  onChange={(e) =>
                    setCustomForm({ ...customForm, quantity: Math.max(1, parseInt(e.target.value) || 1) })
                  }
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCustomForm(false)}
                  className="btn btn-secondary flex-1 justify-center"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={addCustomTicket}
                  className="btn btn-primary flex-1 justify-center"
                >
                  Add to Print Job
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
