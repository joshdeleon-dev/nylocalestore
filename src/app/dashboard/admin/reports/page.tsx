'use client';

import { useEffect, useState, useMemo } from 'react';
import { formatCurrency, formatDate } from '@/utils/helpers';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { TrendingUp, ShoppingBag, DollarSign, RefreshCw, TableProperties, X, ChevronDown } from 'lucide-react';
import { useTableSort } from '@/hooks/useTableSort';
import { SortableHeader } from '@/components/SortableHeader';
import ReportBuilder from '@/components/ReportBuilder';

interface DailyStat {
  date: string;
  rawDate: string;
  revenue: number;
  orders: number;
}

interface DrilldownState {
  title: string;
  orders: any[];
}

interface ProductStat {
  name: string;
  quantity: number;
}

interface HourStat {
  hour: string;
  orders: number;
}

interface GroupStat {
  group: string;
  revenue: number;
  orders: number;
}

const COLORS = ['#4a3728', '#6f4e37', '#b39f92', '#d4c4ba', '#ede7e2'];

const etFmt = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(d);

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

export default function AdminReportsPage() {
  const [tab, setTab] = useState<'analytics' | 'builder'>('analytics');
  const [dateFrom, setDateFrom] = useState(() => etFmt(new Date(Date.now() - 7 * 86400000)));
  const [dateTo, setDateTo]     = useState(() => etFmt(new Date()));
  const [selectedGroups, setSelectedGroups] = useState<Set<number>>(new Set());
  const [groupDropdownOpen, setGroupDropdownOpen] = useState(false);

  const [loading, setLoading] = useState(true);
  const [rawOrders, setRawOrders] = useState<any[]>([]);
  const [drilldown, setDrilldown] = useState<DrilldownState | null>(null);

  // Stats state — computed from filteredOrders
  const [summary, setSummary]         = useState({ revenue: 0, orders: 0, avg: 0, cancelled: 0 });
  const [dailyStats, setDailyStats]   = useState<DailyStat[]>([]);
  const [topProducts, setTopProducts] = useState<ProductStat[]>([]);
  const [hourlyStats, setHourlyStats] = useState<HourStat[]>([]);
  const [groupStats, setGroupStats]   = useState<GroupStat[]>([]);

  const fetchOrders = async () => {
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

  useEffect(() => { fetchOrders(); }, [dateFrom]);

  // Unique group numbers available in the fetched data
  const availableGroups = useMemo(() => {
    const gs = new Set<number>();
    rawOrders.forEach((o) => gs.add(o.group_number ?? 1));
    return [...gs].sort((a, b) => a - b);
  }, [rawOrders]);

  // Orders filtered by dateTo + selected groups (client-side, no re-fetch)
  const filteredOrders = useMemo(() => rawOrders.filter((o) => {
    if (o.sales_date > dateTo) return false;
    if (selectedGroups.size > 0 && !selectedGroups.has(o.group_number ?? 1)) return false;
    return true;
  }), [rawOrders, dateTo, selectedGroups]);

  // Recompute all stats whenever filteredOrders changes
  useEffect(() => {
    setDrilldown(null);

    const completed  = filteredOrders.filter((o) => o.status === 'COMPLETED');
    const cancelled  = filteredOrders.filter((o) => o.status === 'CANCELLED');
    const totalRev   = completed.reduce((s: number, o: any) => s + o.total, 0);
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

    const byGroup: Record<number, { revenue: number; orders: number }> = {};
    filteredOrders.forEach((o) => {
      const g = o.group_number ?? 1;
      if (!byGroup[g]) byGroup[g] = { revenue: 0, orders: 0 };
      byGroup[g].orders++;
      if (o.status === 'COMPLETED') byGroup[g].revenue += o.total;
    });
    setGroupStats(Object.entries(byGroup).sort(([a], [b]) => Number(a) - Number(b)).map(([g, s]) => ({ group: `Group ${g}`, ...s })));
  }, [filteredOrders]);

  const toggleGroup = (g: number) => setSelectedGroups((prev) => {
    const next = new Set(prev);
    next.has(g) ? next.delete(g) : next.add(g);
    return next;
  });

  const handleGroupDrilldown = (data: any) => {
    const groupNum = parseInt(data.group.replace('Group ', ''), 10);
    setDrilldown({ title: `Orders — ${data.group}`, orders: filteredOrders.filter((o) => o.group_number === groupNum) });
  };

  const handleDayDrilldown = (data: any) => {
    setDrilldown({ title: `Orders on ${data.date}`, orders: filteredOrders.filter((o) => o.sales_date === data.rawDate) });
  };

  const handleProductDrilldown = (data: any) => {
    setDrilldown({ title: `Orders containing "${data.name}"`, orders: filteredOrders.filter((o) => (o.items || []).some((i: any) => (i.product?.name || '') === data.name)) });
  };

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

  return (
    <div className="p-6 max-w-7xl mx-auto flex flex-col" style={{ minHeight: 'calc(100vh - 48px)' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-gray-900">Reports & Analytics</h1>
        {tab === 'analytics' && (
          <div className="flex items-center gap-2 flex-wrap">
            {/* Date range */}
            <div className="flex items-center gap-1.5">
              <label className="text-xs text-gray-500 font-medium">From</label>
              <input
                type="date"
                value={dateFrom}
                max={dateTo}
                onChange={(e) => setDateFrom(e.target.value)}
                className="input py-1.5 text-sm"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <label className="text-xs text-gray-500 font-medium">To</label>
              <input
                type="date"
                value={dateTo}
                min={dateFrom}
                max={etFmt(new Date())}
                onChange={(e) => setDateTo(e.target.value)}
                className="input py-1.5 text-sm"
              />
            </div>

            {/* Group filter */}
            <div className="relative">
              <button
                onClick={() => setGroupDropdownOpen((v) => !v)}
                className="btn btn-secondary btn-sm gap-1.5 min-w-[120px] justify-between"
              >
                <span>
                  {selectedGroups.size === 0
                    ? 'All Groups'
                    : `${selectedGroups.size} Group${selectedGroups.size !== 1 ? 's' : ''}`}
                </span>
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
              {groupDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setGroupDropdownOpen(false)} />
                  <div className="absolute right-0 top-full mt-1 z-20 bg-white border border-gray-200 rounded-xl shadow-lg py-1 min-w-[160px]">
                    <button
                      onClick={() => { setSelectedGroups(new Set()); setGroupDropdownOpen(false); }}
                      className="w-full text-left px-3 py-1.5 text-sm hover:bg-gray-50 font-medium text-coffee-700"
                    >
                      All Groups
                    </button>
                    {availableGroups.map((g) => (
                      <label key={g} className="flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-gray-50 select-none">
                        <input
                          type="checkbox"
                          checked={selectedGroups.has(g)}
                          onChange={() => toggleGroup(g)}
                          className="rounded"
                        />
                        <span className="text-sm text-gray-700">Group {g}</span>
                      </label>
                    ))}
                  </div>
                </>
              )}
            </div>

            <button onClick={fetchOrders} className="btn btn-secondary btn-sm gap-2" disabled={loading}>
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

      {/* Active filter chips */}
      {(selectedGroups.size > 0) && (
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <span className="text-xs text-gray-500">Filtered by:</span>
          {[...selectedGroups].sort((a, b) => a - b).map((g) => (
            <span key={g} className="inline-flex items-center gap-1 bg-coffee-100 text-coffee-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
              Group {g}
              <button onClick={() => toggleGroup(g)} className="hover:text-coffee-900"><X className="w-3 h-3" /></button>
            </span>
          ))}
          <button onClick={() => setSelectedGroups(new Set())} className="text-xs text-gray-400 hover:text-gray-600 underline">Clear all</button>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total Revenue', value: formatCurrency(summary.revenue), icon: DollarSign, color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Total Orders', value: summary.orders, icon: ShoppingBag, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Avg Order Value', value: formatCurrency(summary.avg), icon: TrendingUp, color: 'text-purple-600', bg: 'bg-purple-50' },
          { label: 'Cancelled Orders', value: summary.cancelled, icon: ShoppingBag, color: 'text-red-600', bg: 'bg-red-50' },
        ].map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="card">
              <div className="card-content">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-gray-500 font-medium">{s.label}</p>
                  <div className={`${s.bg} ${s.color} p-2 rounded-lg`}>
                    <Icon className="w-4 h-4" />
                  </div>
                </div>
                <p className="text-2xl font-bold text-gray-900">{s.value}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Revenue by Group Number */}
        <div className="card">
          <div className="card-content border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Revenue by Group Number</h2>
          </div>
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

        {/* Orders per Day */}
        <div className="card">
          <div className="card-content border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Orders by Day</h2>
          </div>
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

        {/* Top Products Pie */}
        <div className="card">
          <div className="card-content border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Top Products</h2>
          </div>
          <div className="card-content">
            {topProducts.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={topProducts}
                    dataKey="quantity"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={({ name, percent }) => `${name.slice(0, 12)} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                    onClick={handleProductDrilldown}
                    style={{ cursor: 'pointer' }}
                  >
                    {topProducts.map((_, index) => (
                      <Cell key={index} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-48 flex items-center justify-center text-gray-400 text-sm">
                No product data for this period.
              </div>
            )}
          </div>
        </div>

        {/* Hourly Orders */}
        <div className="card">
          <div className="card-content border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Orders by Hour</h2>
          </div>
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
              <div className="h-48 flex items-center justify-center text-gray-400 text-sm">
                No hourly data for this period.
              </div>
            )}
          </div>
        </div>
      </div>

      <TopProductsTable products={topProducts} />

      {/* Drill-down Panel */}
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
                          o.status === 'COMPLETED'  ? 'bg-green-100 text-green-800' :
                          o.status === 'CANCELLED'  ? 'bg-red-100 text-red-800' :
                          o.status === 'IN_PROGRESS'? 'bg-yellow-100 text-yellow-800' :
                          o.status === 'READY'      ? 'bg-indigo-100 text-indigo-800' :
                          o.status === 'ACCEPTED'   ? 'bg-purple-100 text-purple-800' :
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
