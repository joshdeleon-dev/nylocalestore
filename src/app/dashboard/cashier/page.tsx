'use client';

import { useEffect, useState } from 'react';
import { Order, OrderStatus } from '@/types';
import { formatCurrency, formatDateTime, getOrderStatusColor, getOrderStatusLabel } from '@/utils/helpers';
import { useAuth } from '@/hooks/useAuth';
import { CheckCircle, RefreshCw, Search } from 'lucide-react';
import toast from 'react-hot-toast';

export default function CashierPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchOrders = async () => {
    try {
      const json = await fetch('/api/orders?statuses=READY,COMPLETED&limit=50').then((r) => r.json());
      setOrders(json.data || []);
    } catch { toast.error('Failed to load orders'); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    fetchOrders();
    if (autoRefresh) {
      const interval = setInterval(fetchOrders, 15000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  const markPaid = async (orderId: number) => {
    try {
      const res = await fetch('/api/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: orderId, payment_status: 'PAID', status: 'COMPLETED' }),
      });
      if (!res.ok) throw new Error();
      toast.success('Order marked as paid and completed');
      fetchOrders();
    } catch { toast.error('Failed to update order'); }
  };

  const filtered = orders.filter(
    (o) =>
      o.order_number.toLowerCase().includes(search.toLowerCase()) ||
      o.customer_name.toLowerCase().includes(search.toLowerCase()) ||
      String(o.group_number).includes(search)
  );

  const readyOrders = filtered.filter((o) => o.status === 'READY');
  const completedOrders = filtered.filter((o) => o.status === 'COMPLETED');

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Cashier Dashboard</h1>
            {user && <p className="text-xs text-gray-500">{user.full_name}</p>}
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-600 cursor-pointer">
              <input type="checkbox" className="checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} />
              Auto-refresh
            </label>
            <button onClick={fetchOrders} className="btn btn-secondary btn-sm gap-2" disabled={loading}>
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by order #, name, or group #…"
            className="input pl-9"
          />
        </div>

        {/* Ready for Pickup */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <h2 className="text-lg font-bold text-gray-900">Ready for Pickup</h2>
            <span className="bg-green-100 text-green-800 text-xs font-bold px-2.5 py-0.5 rounded-full">
              {readyOrders.length}
            </span>
          </div>

          {readyOrders.length === 0 ? (
            <div className="card text-center py-10">
              <CheckCircle className="w-12 h-12 mx-auto mb-3 text-gray-200" />
              <p className="text-gray-400">No orders ready for pickup.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {readyOrders.map((order) => (
                <div key={order.id} className="card border-2 border-green-300 bg-green-50">
                  <div className="card-content border-b border-green-200">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-mono text-green-700 font-semibold">{order.order_number}</span>
                      <span className="badge badge-success">Ready</span>
                    </div>
                    <p className="text-xl font-bold text-gray-900">Group #{order.group_number}</p>
                    <p className="text-sm text-gray-600">{order.customer_name}</p>
                  </div>

                  <div className="card-content border-b border-green-200 text-sm space-y-1">
                    {order.items?.map((item) => (
                      <p key={item.id} className="font-medium">
                        {item.quantity}× {(item as any).product?.name}
                      </p>
                    ))}
                  </div>

                  <div className="card-content">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm text-gray-600">Total</span>
                      <span className="text-lg font-bold text-gray-900">{formatCurrency(order.total)}</span>
                    </div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs text-gray-500">Payment</span>
                      <span className="text-xs font-semibold text-gray-700">{order.payment_method}</span>
                    </div>
                    <button
                      onClick={() => markPaid(order.id)}
                      className="btn btn-primary w-full justify-center gap-2"
                    >
                      <CheckCircle className="w-4 h-4" />
                      Mark Paid & Complete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recently Completed */}
        <div>
          <h2 className="text-lg font-bold text-gray-900 mb-4">Recently Completed</h2>
          <div className="card">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    {['Order #', 'Customer', 'Group', 'Total', 'Payment', 'Time'].map((h) => (
                      <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {completedOrders.slice(0, 20).map((order) => (
                    <tr key={order.id} className="hover:bg-gray-50">
                      <td className="px-5 py-3 font-mono text-xs text-coffee-700 font-semibold">{order.order_number}</td>
                      <td className="px-5 py-3 font-medium">{order.customer_name}</td>
                      <td className="px-5 py-3 text-gray-600">#{order.group_number}</td>
                      <td className="px-5 py-3 font-semibold">{formatCurrency(order.total)}</td>
                      <td className="px-5 py-3 text-gray-600 text-xs">{order.payment_method}</td>
                      <td className="px-5 py-3 text-gray-500 text-xs">{formatDateTime(order.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {completedOrders.length === 0 && (
                <div className="text-center py-8 text-gray-400">No completed orders yet.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
