'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, RefreshCw, X } from 'lucide-react';
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
  product: { name: string };
  location: { name: string };
}

export default function ManagerInventoryPage() {
  const [inventory, setInventory] = useState<InventoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showLowOnly, setShowLowOnly] = useState(false);
  const [adjustItem, setAdjustItem] = useState<InventoryRow | null>(null);
  const [qty, setQty] = useState('');
  const [reason, setReason] = useState('manual_adjustment');
  const [saving, setSaving] = useState(false);

  const fetchInventory = async () => {
    setLoading(true);
    const res = await fetch('/api/inventory?limit=500');
    const json = await res.json();
    setInventory(json.data || []);
    setLoading(false);
  };

  useEffect(() => { fetchInventory(); }, []);

  const handleAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustItem) return;
    setSaving(true);
    try {
      const q = parseInt(qty);
      const res = await fetch('/api/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_id: adjustItem.product_id,
          location_id: adjustItem.location_id,
          quantity_change: q,
          adjustment_reason: reason,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      toast.success('Stock adjusted');
      setAdjustItem(null);
      setQty('');
      fetchInventory();
    } catch { toast.error('Failed to adjust'); }
    finally { setSaving(false); }
  };

  const filtered = showLowOnly ? inventory.filter((i) => i.current_stock <= i.low_stock_threshold) : inventory;
  const lowCount = inventory.filter((i) => i.current_stock <= i.low_stock_threshold).length;

  const { sorted: displayed, sortKey, sortDir, requestSort } = useTableSort(filtered, {
    product:   (i) => i.product?.name,
    stock:     (i) => i.current_stock,
    threshold: (i) => i.low_stock_threshold,
    status:    (i) => i.current_stock === 0 ? 0 : i.current_stock <= i.low_stock_threshold ? 1 : 2,
    created:   (i) => i.created_at,
  });

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Inventory</h1>
        <button onClick={fetchInventory} className="btn btn-secondary btn-sm gap-2" disabled={loading}>
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {lowCount > 0 && (
        <div className="mb-5 flex items-center gap-3 bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-xl">
          <AlertCircle className="w-5 h-5" />
          <p className="text-sm font-medium">{lowCount} item{lowCount > 1 ? 's' : ''} at or below low stock threshold.</p>
        </div>
      )}

      <div className="flex items-center gap-3 mb-4">
        <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-gray-700">
          <input type="checkbox" className="checkbox" checked={showLowOnly} onChange={(e) => setShowLowOnly(e.target.checked)} />
          Show low stock only
        </label>
      </div>

      <div className="card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <SortableHeader label="Product"   sortKey="product"   currentKey={sortKey} dir={sortDir} onSort={requestSort} />
                <SortableHeader label="Stock"     sortKey="stock"     currentKey={sortKey} dir={sortDir} onSort={requestSort} />
                <SortableHeader label="Threshold" sortKey="threshold" currentKey={sortKey} dir={sortDir} onSort={requestSort} />
                <SortableHeader label="Status"    sortKey="status"    currentKey={sortKey} dir={sortDir} onSort={requestSort} />
                <SortableHeader label="Created"   sortKey="created"   currentKey={sortKey} dir={sortDir} onSort={requestSort} />
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {displayed.map((item) => {
                const isLow = item.current_stock <= item.low_stock_threshold;
                const isOut = item.current_stock === 0;
                return (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3 font-medium">{item.product?.name}</td>
                    <td className="px-5 py-3 font-bold">{item.current_stock}</td>
                    <td className="px-5 py-3 text-gray-500">{item.low_stock_threshold}</td>
                    <td className="px-5 py-3">
                      {isOut ? <span className="badge badge-danger">Out of Stock</span>
                        : isLow ? <span className="badge badge-warning">Low Stock</span>
                        : <span className="badge badge-success">In Stock</span>}
                    </td>
                    <td className="px-5 py-3 text-gray-500 text-xs">
                      {item.created_at ? formatDate(item.created_at.slice(0, 10)) : '—'}
                    </td>
                    <td className="px-5 py-3">
                      <button onClick={() => { setAdjustItem(item); setQty(''); setReason('manual_adjustment'); }} className="btn btn-secondary btn-sm">Adjust</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {adjustItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50" onClick={() => setAdjustItem(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-lg">Adjust Stock</h2>
              <button onClick={() => setAdjustItem(null)} className="text-gray-400"><X className="w-5 h-5" /></button>
            </div>
            <p className="text-sm text-gray-600 mb-4"><strong>{adjustItem.product?.name}</strong> — Current: <strong>{adjustItem.current_stock}</strong></p>
            <form onSubmit={handleAdjust} className="space-y-4">
              <div>
                <label className="label">Quantity Change</label>
                <input type="number" className="input" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="+10 or -5" required />
              </div>
              <div>
                <label className="label">Reason</label>
                <select className="select" value={reason} onChange={(e) => setReason(e.target.value)}>
                  <option value="manual_adjustment">Manual Adjustment</option>
                  <option value="restock">Restock</option>
                  <option value="waste">Waste</option>
                  <option value="correction">Correction</option>
                </select>
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setAdjustItem(null)} className="btn btn-secondary flex-1 justify-center">Cancel</button>
                <button type="submit" disabled={saving} className="btn btn-primary flex-1 justify-center">{saving ? 'Saving…' : 'Apply'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
