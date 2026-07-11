'use client';

import { useEffect, useState, useMemo } from 'react';
import { AlertCircle, RefreshCw, TrendingDown, Package, X } from 'lucide-react';
import { useTableSort } from '@/hooks/useTableSort';
import { SortableHeader } from '@/components/SortableHeader';
import { formatDate } from '@/utils/helpers';
import toast from 'react-hot-toast';

interface InventoryRow {
  id: number;
  product_id: number;
  location_id: number;
  current_stock: number;
  low_stock_threshold: number;
  unit_of_measure: string;
  created_at: string;
  product: { name: string; is_available: boolean; is_archived: boolean };
  location: { name: string };
}

interface LogRow {
  product_id: number;
  quantity_change: number;
  previous_stock: number;
  created_at: string;
}

export default function AdminInventoryPage() {
  const [inventory, setInventory] = useState<InventoryRow[]>([]);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showLowOnly, setShowLowOnly] = useState(false);
  const [adjustItem, setAdjustItem] = useState<InventoryRow | null>(null);
  const [adjustment, setAdjustment] = useState({ quantity: '', reason: 'manual_adjustment' });
  const [saving, setSaving] = useState(false);

  const fetchInventory = async () => {
    setLoading(true);
    try {
      const [invRes, logsRes] = await Promise.all([
        fetch('/api/inventory?limit=500').then((r) => r.json()),
        fetch('/api/inventory/logs?limit=5000').then((r) => r.json()),
      ]);
      if (!invRes.success) throw new Error();
      setInventory(invRes.data || []);
      setLogs(logsRes.data || []);
    } catch {
      toast.error('Failed to load inventory');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchInventory(); }, []);

  // Compute per-product: net adjustment (sum) and original stock (earliest log's previous_stock)
  const { netAdjByProduct, originalStockByProduct } = useMemo(() => {
    const netAdj: Record<number, number> = {};
    const earliestLog: Record<number, LogRow> = {};
    for (const log of logs) {
      netAdj[log.product_id] = (netAdj[log.product_id] ?? 0) + log.quantity_change;
      if (!earliestLog[log.product_id] || log.created_at < earliestLog[log.product_id].created_at) {
        earliestLog[log.product_id] = log;
      }
    }
    const origStock: Record<number, number> = {};
    for (const [pid, log] of Object.entries(earliestLog)) {
      origStock[Number(pid)] = log.previous_stock;
    }
    return { netAdjByProduct: netAdj, originalStockByProduct: origStock };
  }, [logs]);

  const handleAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustItem || !adjustment.quantity) return;
    setSaving(true);
    try {
      const qty = parseInt(adjustment.quantity);
      const res = await fetch('/api/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_id: adjustItem.product_id,
          location_id: adjustItem.location_id,
          quantity_change: qty,
          adjustment_reason: adjustment.reason,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      toast.success('Stock adjusted');
      setAdjustItem(null);
      setAdjustment({ quantity: '', reason: 'manual_adjustment' });
      fetchInventory();
    } catch {
      toast.error('Failed to adjust stock');
    } finally {
      setSaving(false);
    }
  };

  // Hide unavailable and archived products; optionally filter to low stock only
  const filtered = useMemo(() => {
    return inventory
      .filter((i) => i.product?.is_available !== false && i.product?.is_archived !== true)
      .filter((i) => !showLowOnly || i.current_stock <= i.low_stock_threshold);
  }, [inventory, showLowOnly]);

  const { sorted: displayed, sortKey, sortDir, requestSort } = useTableSort(filtered, {
    product:      (i) => i.product?.name,
    orig:         (i) => (originalStockByProduct[i.product_id] ?? i.current_stock),
    net_adj:      (i) => (netAdjByProduct[i.product_id] ?? 0),
    stock:        (i) => i.current_stock,
    threshold:    (i) => i.low_stock_threshold,
    unit:         (i) => i.unit_of_measure,
    status:       (i) => i.current_stock === 0 ? 0 : i.current_stock <= i.low_stock_threshold ? 1 : 2,
    created:      (i) => i.created_at,
  });

  const uniqueProductCount = new Set(filtered.map((i) => i.product_id)).size;
  const lowCount  = filtered.filter((i) => i.current_stock <= i.low_stock_threshold).length;
  const outCount  = filtered.filter((i) => i.current_stock === 0).length;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Inventory</h1>
        <button onClick={fetchInventory} className="btn btn-secondary btn-sm gap-2" disabled={loading}>
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="card">
          <div className="card-content">
            <p className="text-xs text-gray-500 font-medium">Total Products</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{uniqueProductCount}</p>
          </div>
        </div>
        <div className="card border-amber-200">
          <div className="card-content">
            <p className="text-xs text-amber-600 font-medium flex items-center gap-1">
              <AlertCircle className="w-3 h-3" /> Low Stock
            </p>
            <p className="text-2xl font-bold text-amber-700 mt-1">{lowCount}</p>
          </div>
        </div>
        <div className="card border-red-200">
          <div className="card-content">
            <p className="text-xs text-red-600 font-medium flex items-center gap-1">
              <TrendingDown className="w-3 h-3" /> Out of Stock
            </p>
            <p className="text-2xl font-bold text-red-700 mt-1">{outCount}</p>
          </div>
        </div>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-3 mb-4">
        <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-gray-700">
          <input
            type="checkbox"
            className="checkbox"
            checked={showLowOnly}
            onChange={(e) => setShowLowOnly(e.target.checked)}
          />
          Show low stock only
        </label>
      </div>

      {/* Table */}
      <div className="card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <SortableHeader label="Product"        sortKey="product"   currentKey={sortKey} dir={sortDir} onSort={requestSort} />
                <SortableHeader label="Original Stock" sortKey="orig"      currentKey={sortKey} dir={sortDir} onSort={requestSort} />
                <SortableHeader label="Net Adjustment" sortKey="net_adj"   currentKey={sortKey} dir={sortDir} onSort={requestSort} />
                <SortableHeader label="Current Stock"  sortKey="stock"     currentKey={sortKey} dir={sortDir} onSort={requestSort} />
                <SortableHeader label="Threshold"      sortKey="threshold" currentKey={sortKey} dir={sortDir} onSort={requestSort} />
                <SortableHeader label="Unit"           sortKey="unit"      currentKey={sortKey} dir={sortDir} onSort={requestSort} />
                <SortableHeader label="Status"         sortKey="status"    currentKey={sortKey} dir={sortDir} onSort={requestSort} />
                <SortableHeader label="Created"        sortKey="created"   currentKey={sortKey} dir={sortDir} onSort={requestSort} />
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading
                ? Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i}>
                      <td colSpan={9} className="px-5 py-3">
                        <div className="skeleton h-4 rounded" />
                      </td>
                    </tr>
                  ))
                : displayed.map((item) => {
                    const netAdj = netAdjByProduct[item.product_id] ?? 0;
                    const originalStock = originalStockByProduct[item.product_id] ?? item.current_stock;
                    const isLow = item.current_stock <= item.low_stock_threshold;
                    const isOut = item.current_stock === 0;
                    return (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="px-5 py-3 font-medium text-gray-900">{item.product?.name}</td>
                        <td className="px-5 py-3 text-gray-700 font-medium">{originalStock}</td>
                        <td className="px-5 py-3">
                          {netAdj === 0 ? (
                            <span className="text-gray-400">—</span>
                          ) : (
                            <span className={netAdj > 0 ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                              {netAdj > 0 ? '+' : ''}{netAdj}
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3">
                          <span className={`font-bold ${isOut ? 'text-red-600' : isLow ? 'text-amber-600' : 'text-gray-900'}`}>
                            {item.current_stock}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-gray-500">{item.low_stock_threshold}</td>
                        <td className="px-5 py-3 text-gray-500 text-xs">{item.unit_of_measure}</td>
                        <td className="px-5 py-3">
                          {isOut ? (
                            <span className="badge badge-danger">Out of Stock</span>
                          ) : isLow ? (
                            <span className="badge badge-warning">Low Stock</span>
                          ) : (
                            <span className="badge badge-success">In Stock</span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-gray-500 text-xs">
                          {item.created_at ? formatDate(item.created_at.slice(0, 10)) : '—'}
                        </td>
                        <td className="px-5 py-3">
                          <button
                            onClick={() => {
                              setAdjustItem(item);
                              setAdjustment({ quantity: '', reason: 'manual_adjustment' });
                            }}
                            className="btn btn-secondary btn-sm"
                          >
                            Adjust
                          </button>
                        </td>
                      </tr>
                    );
                  })}
            </tbody>
          </table>
          {!loading && displayed.length === 0 && (
            <div className="text-center py-10">
              <Package className="w-10 h-10 mx-auto mb-2 text-gray-300" />
              <p className="text-gray-400">No inventory items found.</p>
            </div>
          )}
        </div>
      </div>

      {/* Adjust Modal */}
      {adjustItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50" onClick={() => setAdjustItem(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-lg">Adjust Stock</h2>
              <button onClick={() => setAdjustItem(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              <strong>{adjustItem.product?.name}</strong> — Current:{' '}
              <strong>{adjustItem.current_stock}</strong> {adjustItem.unit_of_measure}
            </p>
            <form onSubmit={handleAdjust} className="space-y-4">
              <div>
                <label className="label">Quantity Change *</label>
                <input
                  type="number"
                  className="input"
                  value={adjustment.quantity}
                  onChange={(e) => setAdjustment({ ...adjustment, quantity: e.target.value })}
                  placeholder="+10 or -5"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">Use positive to add stock, negative to remove</p>
              </div>
              <div>
                <label className="label">Reason</label>
                <select
                  className="select"
                  value={adjustment.reason}
                  onChange={(e) => setAdjustment({ ...adjustment, reason: e.target.value })}
                >
                  <option value="manual_adjustment">Manual Adjustment</option>
                  <option value="restock">Restock</option>
                  <option value="waste">Waste / Spoilage</option>
                  <option value="correction">Inventory Correction</option>
                </select>
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setAdjustItem(null)} className="btn btn-secondary flex-1 justify-center">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="btn btn-primary flex-1 justify-center">
                  {saving ? 'Saving…' : 'Apply'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
