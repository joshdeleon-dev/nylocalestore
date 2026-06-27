'use client';

import { useEffect, useState } from 'react';
import { formatCurrency, formatDate } from '@/utils/helpers';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { DollarSign, ShoppingBag, TrendingUp, RefreshCw, TableProperties, X } from 'lucide-react';
import { useTableSort } from '@/hooks/useTableSort';
import { SortableHeader } from '@/components/SortableHeader';
import ReportBuilder from '@/components/ReportBuilder';

type Period = 'today' | 'week' | 'month';

function MgrTopProductsTable({ products }: { products: { name: string; quantity: number }[] }) {
  const { sorted, sortKey, sortDir, requestSort } = useTableSort(products, {
    name:     (p) => p.name,
    quantity: (p) => p.quantity,
  });
  if (products.length === 0) return null;
  return (
    <div className="card">
      <div className="card-content border-b border-gray-100"><h2 className="font-semibold">Top Products</h2></div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Rank</th>
              <SortableHeader label="Product"    sortKey="name"     currentKey={sortKey} dir={sortDir} onSort={requestSort} />
              <SortableHeader label="Units Sold" sortKey="quantity" currentKey={sortKey} dir={sortDir} onSort={requestSort} className="text-right" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {sorted.map((p, i) => (
              <tr key={p.name} className="hover:bg-gray-50">
                <td className="px-5 py-3 text-gray-500 font-bold">#{i + 1}</td>
                <td className="px-5 py-3 font-medium">{p.name}</td>
                <td className="px-5 py-3 text-right font-semibold text-coffee-700">{p.quantity}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function ManagerReportsPage() {
  const [tab, setTab] = useState<'analytics' | 'builder'>('analytics');
  const [period, setPeriod] = useState<Period>('week');
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState({ revenue: 0, orders: 0, avg: 0, cancelled: 0 });
  const [dailyStats, setDailyStats] = useState<{ date: string; rawDate: string; revenue: number; orders: number }[]>([]);
  const [topProducts, setTopProducts] = useState<{ name: string; quantity: number }[]>([]);
  const [groupStats, setGroupStats] = useState<{ group: string; revenue: number; orders: number }[]>([]);
  const [rawOrders, setRawOrders] = useState<any[]>([]);
  const [drilldown, setDrilldown] = useState<{ title: string; orders: any[] } | null>(null);

  const fetchReports = async () => {
    setLoading(true);
    const etFmt = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(d);
    let startDate: string;
    if (period === 'today') startDate = etFmt(new Date());
    else if (period === 'week') startDate = etFmt(new Date(Date.now() - 7 * 86400000));
    else startDate = etFmt(new Date(Date.now() - 30 * 86400000));

    const res = await fetch(`/api/orders?start_date=${startDate}&limit=1000`);
    const json = await res.json();
    const orders = json.data || [];
    setRawOrders(orders);
    setDrilldown(null);

    const completed = orders.filter((o: any) => o.status === 'COMPLETED');
    const cancelled = orders.filter((o: any) => o.status === 'CANCELLED');
    const revenue = completed.reduce((s: number, o: any) => s + o.total, 0);
    setSummary({ revenue, orders: orders.length, avg: completed.length ? revenue / completed.length : 0, cancelled: cancelled.length });

    const byDate: Record<string, { revenue: number; orders: number }> = {};
    orders.forEach((o: any) => {
      if (!byDate[o.sales_date]) byDate[o.sales_date] = { revenue: 0, orders: 0 };
      byDate[o.sales_date].orders++;
      if (o.status === 'COMPLETED') byDate[o.sales_date].revenue += o.total;
    });
    setDailyStats(Object.entries(byDate).sort(([a], [b]) => a.localeCompare(b)).map(([date, stats]) => ({ date: formatDate(date), rawDate: date, ...stats })));


    const pc: Record<string, number> = {};
    orders.forEach((o: any) => {
      (o.items || []).forEach((i: any) => {
        const n = i.product?.name || 'Unknown';
        pc[n] = (pc[n] || 0) + i.quantity;
      });
    });
    setTopProducts(Object.entries(pc).sort(([, a], [, b]) => b - a).slice(0, 5).map(([name, quantity]) => ({ name, quantity })));

    const byGroup: Record<number, { revenue: number; orders: number }> = {};
    orders.forEach((o: any) => {
      const g = o.group_number ?? 1;
      if (!byGroup[g]) byGroup[g] = { revenue: 0, orders: 0 };
      byGroup[g].orders++;
      if (o.status === 'COMPLETED') byGroup[g].revenue += o.total;
    });
    setGroupStats(
      Object.entries(byGroup)
        .sort(([a], [b]) => Number(a) - Number(b))
        .map(([g, stats]) => ({ group: `Group ${g}`, ...stats }))
    );
    setLoading(false);
  };

  const handleGroupDrilldown = (data: any) => {
    const groupNum = parseInt(data.group.replace('Group ', ''), 10);
    setDrilldown({ title: `Orders — ${data.group}`, orders: rawOrders.filter((o) => o.group_number === groupNum) });
  };

  const handleDayDrilldown = (data: any) => {
    setDrilldown({ title: `Orders on ${data.date}`, orders: rawOrders.filter((o) => o.sales_date === data.rawDate) });
  };

  useEffect(() => { fetchReports(); }, [period]);

  return (
    <div className="p-6 max-w-6xl mx-auto flex flex-col" style={{ minHeight: 'calc(100vh - 48px)' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
        {tab === 'analytics' && (
          <div className="flex gap-3">
            <select value={period} onChange={(e) => setPeriod(e.target.value as Period)} className="select">
              <option value="today">Today</option>
              <option value="week">Last 7 Days</option>
              <option value="month">Last 30 Days</option>
            </select>
            <button onClick={fetchReports} className="btn btn-secondary btn-sm" disabled={loading}>
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 mb-6">
        {[
          { key: 'analytics', label: 'Analytics', icon: TrendingUp },
          { key: 'builder', label: 'Report Builder', icon: TableProperties },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key as any)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-all ${
              tab === key
                ? 'border-coffee-700 text-coffee-800'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Builder Tab */}
      {tab === 'builder' && (
        <div className="flex-1 min-h-0">
          <ReportBuilder />
        </div>
      )}

      {/* Analytics Tab */}
      {tab === 'analytics' && <>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Revenue', value: formatCurrency(summary.revenue), icon: DollarSign, color: 'text-green-600', bg: 'bg-green-50' },
            { label: 'Orders', value: summary.orders, icon: ShoppingBag, color: 'text-blue-600', bg: 'bg-blue-50' },
            { label: 'Avg Value', value: formatCurrency(summary.avg), icon: TrendingUp, color: 'text-purple-600', bg: 'bg-purple-50' },
            { label: 'Cancelled', value: summary.cancelled, icon: ShoppingBag, color: 'text-red-600', bg: 'bg-red-50' },
          ].map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.label} className="card">
                <div className="card-content">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs text-gray-500">{s.label}</p>
                    <div className={`${s.bg} ${s.color} p-2 rounded-lg`}><Icon className="w-4 h-4" /></div>
                  </div>
                  <p className="text-2xl font-bold">{s.value}</p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <div className="card">
            <div className="card-content border-b border-gray-100"><h2 className="font-semibold">Revenue by Group Number</h2></div>
            <div className="card-content">
              {groupStats.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={groupStats}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="group" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${v}`} />
                    <Tooltip formatter={(v: number) => formatCurrency(v)} />
                    <Bar dataKey="revenue" fill="#4a3728" radius={[4, 4, 0, 0]} onClick={handleGroupDrilldown} style={{ cursor: 'pointer' }} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-48 flex items-center justify-center text-gray-400 text-sm">
                  No group data for this period.
                </div>
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-content border-b border-gray-100"><h2 className="font-semibold">Orders by Day</h2></div>
            <div className="card-content">
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={dailyStats}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="orders" fill="#6f4e37" radius={[4, 4, 0, 0]} onClick={handleDayDrilldown} style={{ cursor: 'pointer' }} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <MgrTopProductsTable products={topProducts} />

        {drilldown && (
          <div className="card mt-6">
            <div className="card-content border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">{drilldown.title}</h2>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-400">{drilldown.orders.length} order{drilldown.orders.length !== 1 ? 's' : ''}</span>
                <button onClick={() => setDrilldown(null)} className="text-gray-400 hover:text-gray-600 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              {drilldown.orders.length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-sm">No orders match this selection.</div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Order #</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Customer</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Date</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Items</th>
                      <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {drilldown.orders.map((o) => (
                      <tr key={o.id} className="hover:bg-gray-50">
                        <td className="px-5 py-3 font-mono text-xs font-semibold text-coffee-700">{o.order_number}</td>
                        <td className="px-5 py-3">
                          <p className="font-medium text-gray-900">{o.customer_name}</p>
                          <p className="text-xs text-gray-400">Group #{o.group_number}</p>
                        </td>
                        <td className="px-5 py-3 text-xs text-gray-500">{formatDate(o.sales_date)}</td>
                        <td className="px-5 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                            o.status === 'COMPLETED' ? 'bg-green-100 text-green-800' :
                            o.status === 'CANCELLED' ? 'bg-red-100 text-red-800' :
                            o.status === 'IN_PROGRESS' ? 'bg-yellow-100 text-yellow-800' :
                            o.status === 'READY' ? 'bg-indigo-100 text-indigo-800' :
                            o.status === 'ACCEPTED' ? 'bg-purple-100 text-purple-800' :
                            'bg-blue-100 text-blue-800'
                          }`}>{o.status}</span>
                        </td>
                        <td className="px-5 py-3 text-xs text-gray-600">
                          {(o.items || []).slice(0, 3).map((i: any) => `${i.quantity}× ${i.product?.name || '?'}`).join(', ')}
                          {(o.items || []).length > 3 ? ` +${(o.items || []).length - 3} more` : ''}
                        </td>
                        <td className="px-5 py-3 text-right font-semibold text-gray-900">{formatCurrency(o.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </>}
    </div>
  );
}
