'use client';

import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { formatCurrency, formatDate } from '@/utils/helpers';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';
import { TrendingUp, ShoppingBag, DollarSign, RefreshCw, X } from 'lucide-react';
import { useTableSort } from '@/hooks/useTableSort';
import { SortableHeader } from '@/components/SortableHeader';

interface DailyStat   { date: string; rawDate: string; revenue: number; orders: number }
interface ProductStat  { name: string; quantity: number }
interface HourStat    { hour: string; orders: number }
interface DrilldownState { title: string; orders: any[] }
interface LineItem {
  order_number: string;
  customer_name: string;
  sales_date: string;
  product: string;
  quantity: number;
  unit_price: number;
  line_total: number;
}

const COLORS = ['#4a3728', '#6f4e37', '#b39f92', '#d4c4ba', '#ede7e2'];
const etFmt = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(d);

const getWeekStart = () => {
  const today = new Date(etFmt(new Date()) + 'T12:00:00');
  const day = today.getDay(); // 0=Sun … 6=Sat
  today.setDate(today.getDate() - (day === 0 ? 6 : day - 1)); // back to Monday
  return etFmt(today);
};

function TopProductsTable({ products }: { products: ProductStat[] }) {
  const { sorted, sortKey, sortDir, requestSort } = useTableSort(products, {
    name:     (p) => p.name,
    quantity: (p) => p.quantity,
  });
  if (products.length === 0) return null;
  return (
    <div className="card">
      <div className="card-content border-b border-gray-100">
        <h2 className="font-semibold text-gray-900">Top Products — Detail</h2>
      </div>
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
                <td className="px-5 py-3 font-medium text-gray-900">{p.name}</td>
                <td className="px-5 py-3 text-right font-semibold text-coffee-700">{p.quantity}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function GroupLeaderReportsPage() {
  const { user } = useAuth();
  const groupNumber = user?.group_number;

  const [dateFrom, setDateFrom] = useState(getWeekStart);
  const [dateTo,   setDateTo]   = useState(() => etFmt(new Date()));
  const [loading, setLoading]   = useState(true);
  const [rawOrders, setRawOrders] = useState<any[]>([]);
  const [drilldown, setDrilldown] = useState<DrilldownState | null>(null);

  const [summary,      setSummary]      = useState({ revenue: 0, orders: 0, avg: 0, cancelled: 0 });
  const [dailyStats,   setDailyStats]   = useState<DailyStat[]>([]);
  const [topProducts,  setTopProducts]  = useState<ProductStat[]>([]);
  const [hourlyStats,  setHourlyStats]  = useState<HourStat[]>([]);

  const fetchOrders = async () => {
    if (groupNumber == null) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/orders?start_date=${dateFrom}&limit=2000&include_archived=true`);
      const json = await res.json();
      setRawOrders(json.data || []);
      setDrilldown(null);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchOrders(); }, [dateFrom, groupNumber]);

  // Only orders belonging to this group, within the date range
  const filteredOrders = useMemo(() => rawOrders.filter((o) => {
    if (o.sales_date > dateTo) return false;
    if (o.group_number !== groupNumber) return false;
    return true;
  }), [rawOrders, dateTo, groupNumber]);

  useEffect(() => {
    setDrilldown(null);

    const completed = filteredOrders.filter((o) => o.status === 'COMPLETED');
    const cancelled = filteredOrders.filter((o) => o.status === 'CANCELLED');
    const totalRev  = completed.reduce((s: number, o: any) => s + o.total, 0);
    setSummary({ revenue: totalRev, orders: filteredOrders.length, avg: completed.length ? totalRev / completed.length : 0, cancelled: cancelled.length });

    const byDate: Record<string, { revenue: number; orders: number }> = {};
    filteredOrders.forEach((o) => {
      if (!byDate[o.sales_date]) byDate[o.sales_date] = { revenue: 0, orders: 0 };
      byDate[o.sales_date].orders++;
      if (o.status === 'COMPLETED') byDate[o.sales_date].revenue += o.total;
    });
    setDailyStats(Object.entries(byDate).sort(([a], [b]) => a.localeCompare(b)).map(([date, s]) => ({ date: formatDate(date), rawDate: date, ...s })));

    const productCounts: Record<string, number> = {};
    filteredOrders.forEach((o) => {
      (o.items || []).forEach((item: any) => {
        const name = item.product?.name || 'Unknown';
        productCounts[name] = (productCounts[name] || 0) + item.quantity;
      });
    });
    setTopProducts(Object.entries(productCounts).sort(([, a], [, b]) => b - a).slice(0, 5).map(([name, quantity]) => ({ name, quantity })));

    const byHour: Record<number, number> = {};
    filteredOrders.forEach((o) => {
      const h = parseInt(new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone: 'America/New_York' }).format(new Date(o.order_date || o.created_at)), 10);
      byHour[h] = (byHour[h] || 0) + 1;
    });
    setHourlyStats(Array.from({ length: 24 }, (_, h) => ({ hour: `${h}:00`, orders: byHour[h] || 0 })).filter((h) => h.orders > 0));
  }, [filteredOrders]);

  const lineItems = useMemo<LineItem[]>(() => {
    const rows: LineItem[] = [];
    for (const order of filteredOrders) {
      for (const item of order.items || []) {
        rows.push({
          order_number: order.order_number,
          customer_name: order.customer_name,
          sales_date: order.sales_date,
          product: item.product?.name || '—',
          quantity: item.quantity,
          unit_price: item.unit_price,
          line_total: item.line_total,
        });
      }
    }
    return rows;
  }, [filteredOrders]);

  const { sorted: sortedLines, sortKey: lineKey, sortDir: lineDir, requestSort: lineSort } = useTableSort(lineItems, {
    date:       (r) => r.sales_date,
    customer:   (r) => r.customer_name,
    product:    (r) => r.product,
    quantity:   (r) => r.quantity,
    unit_price: (r) => r.unit_price,
    line_total: (r) => r.line_total,
  });

  const handleDayDrilldown = (data: any) =>
    setDrilldown({ title: `Orders on ${data.date}`, orders: filteredOrders.filter((o) => o.sales_date === data.rawDate) });

  const handleProductDrilldown = (data: any) =>
    setDrilldown({ title: `Orders containing "${data.name}"`, orders: filteredOrders.filter((o) => (o.items || []).some((i: any) => (i.product?.name || '') === data.name)) });

  const handleHourDrilldown = (data: any) => {
    const h = parseInt(data.hour, 10);
    setDrilldown({
      title: `Orders at ${data.hour} (Eastern)`,
      orders: filteredOrders.filter((o) => {
        const hour = parseInt(new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone: 'America/New_York' }).format(new Date(o.order_date || o.created_at)), 10);
        return hour === h;
      }),
    });
  };

  if (groupNumber == null) {
    return (
      <div className="p-6 text-center text-gray-400 text-sm mt-16">
        Your account has no group assigned. Contact an administrator.
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Group {groupNumber} — Reports</h1>
          <p className="text-sm text-gray-400 mt-0.5">Data filtered to your group only</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5">
            <label className="text-xs text-gray-500 font-medium">From</label>
            <input type="date" value={dateFrom} max={dateTo}
              onChange={(e) => setDateFrom(e.target.value)} className="input py-1.5 text-sm" />
          </div>
          <div className="flex items-center gap-1.5">
            <label className="text-xs text-gray-500 font-medium">To</label>
            <input type="date" value={dateTo} min={dateFrom} max={etFmt(new Date())}
              onChange={(e) => setDateTo(e.target.value)} className="input py-1.5 text-sm" />
          </div>
          <button onClick={fetchOrders} className="btn btn-secondary btn-sm gap-2" disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total Revenue',    value: formatCurrency(summary.revenue),    icon: DollarSign,  color: 'text-green-600',  bg: 'bg-green-50' },
          { label: 'Total Orders',     value: summary.orders,                      icon: ShoppingBag, color: 'text-blue-600',   bg: 'bg-blue-50' },
          { label: 'Avg Order Value',  value: formatCurrency(summary.avg),         icon: TrendingUp,  color: 'text-purple-600', bg: 'bg-purple-50' },
          { label: 'Cancelled Orders', value: summary.cancelled,                   icon: ShoppingBag, color: 'text-red-600',    bg: 'bg-red-50' },
        ].map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="card">
              <div className="card-content">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-gray-500 font-medium">{s.label}</p>
                  <div className={`${s.bg} ${s.color} p-2 rounded-lg`}><Icon className="w-4 h-4" /></div>
                </div>
                <p className="text-2xl font-bold text-gray-900">{s.value}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Order detail table */}
      <div className="card mb-8">
        <div className="card-content border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Order Details</h2>
          {lineItems.length > 0 && (
            <span className="text-xs text-gray-400">{lineItems.length} line item{lineItems.length !== 1 ? 's' : ''}</span>
          )}
        </div>
        {lineItems.length === 0 ? (
          <div className="text-center py-10 text-gray-400 text-sm">No orders in this date range.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <SortableHeader label="Date"       sortKey="date"       currentKey={lineKey} dir={lineDir} onSort={lineSort} />
                  <SortableHeader label="Customer"   sortKey="customer"   currentKey={lineKey} dir={lineDir} onSort={lineSort} />
                  <SortableHeader label="Product"    sortKey="product"    currentKey={lineKey} dir={lineDir} onSort={lineSort} />
                  <SortableHeader label="Qty"        sortKey="quantity"   currentKey={lineKey} dir={lineDir} onSort={lineSort} className="text-right" />
                  <SortableHeader label="Unit Price" sortKey="unit_price" currentKey={lineKey} dir={lineDir} onSort={lineSort} className="text-right" />
                  <SortableHeader label="Line Total" sortKey="line_total" currentKey={lineKey} dir={lineDir} onSort={lineSort} className="text-right" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {sortedLines.map((row, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-5 py-3 text-xs text-gray-500 whitespace-nowrap">{formatDate(row.sales_date)}</td>
                    <td className="px-5 py-3 font-medium text-gray-900">{row.customer_name}</td>
                    <td className="px-5 py-3 text-gray-700">{row.product}</td>
                    <td className="px-5 py-3 text-right text-gray-700 font-medium">{row.quantity}</td>
                    <td className="px-5 py-3 text-right text-gray-600">{formatCurrency(row.unit_price)}</td>
                    <td className="px-5 py-3 text-right font-semibold text-coffee-700">{formatCurrency(row.line_total)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-200 bg-gray-50">
                  <td colSpan={3} className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Total</td>
                  <td className="px-5 py-3 text-right font-bold text-gray-900">
                    {lineItems.reduce((s, r) => s + r.quantity, 0)}
                  </td>
                  <td className="px-5 py-3" />
                  <td className="px-5 py-3 text-right font-bold text-coffee-700">
                    {formatCurrency(lineItems.reduce((s, r) => s + r.line_total, 0))}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="card">
          <div className="card-content border-b border-gray-100"><h2 className="font-semibold text-gray-900">Orders by Day</h2></div>
          <div className="card-content">
            {dailyStats.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={dailyStats}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="orders" fill="#6f4e37" radius={[4, 4, 0, 0]} onClick={handleDayDrilldown} style={{ cursor: 'pointer' }} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-48 flex items-center justify-center text-gray-400 text-sm">No data for this period.</div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-content border-b border-gray-100"><h2 className="font-semibold text-gray-900">Top Products</h2></div>
          <div className="card-content">
            {topProducts.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={topProducts} dataKey="quantity" nameKey="name" cx="50%" cy="50%" outerRadius={80}
                    label={({ name, percent }) => `${name.slice(0, 12)} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false} onClick={handleProductDrilldown} style={{ cursor: 'pointer' }}>
                    {topProducts.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-48 flex items-center justify-center text-gray-400 text-sm">No product data.</div>
            )}
          </div>
        </div>

        <div className="card lg:col-span-2">
          <div className="card-content border-b border-gray-100"><h2 className="font-semibold text-gray-900">Orders by Hour</h2></div>
          <div className="card-content">
            {hourlyStats.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={hourlyStats}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="hour" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="orders" fill="#b39f92" radius={[4, 4, 0, 0]} onClick={handleHourDrilldown} style={{ cursor: 'pointer' }} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-48 flex items-center justify-center text-gray-400 text-sm">No hourly data.</div>
            )}
          </div>
        </div>
      </div>

      <TopProductsTable products={topProducts} />

      {/* Drilldown */}
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
                          o.status === 'COMPLETED'   ? 'bg-green-100 text-green-800' :
                          o.status === 'CANCELLED'   ? 'bg-red-100 text-red-800' :
                          o.status === 'IN_PROGRESS' ? 'bg-yellow-100 text-yellow-800' :
                          o.status === 'READY'       ? 'bg-indigo-100 text-indigo-800' :
                          o.status === 'ACCEPTED'    ? 'bg-purple-100 text-purple-800' :
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
    </div>
  );
}
