'use client';

import { useEffect, useState } from 'react';
import { formatCurrency, formatDateTime, getOrderStatusColor, getOrderStatusLabel } from '@/utils/helpers';
import { Order, OrderStatus } from '@/types';
import { ShoppingBag, DollarSign, TrendingUp, AlertCircle, RefreshCw } from 'lucide-react';
import Link from 'next/link';

export default function ManagerOverviewPage() {
  const [stats, setStats] = useState({ revenue: 0, orders: 0, avg: 0, active: 0, lowStock: 0 });
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date());
    const [statsJson, recentJson] = await Promise.all([
      fetch('/api/orders/stats').then((r) => r.json()),
      fetch(`/api/orders?limit=6&start_date=${today}`).then((r) => r.json()),
    ]);
    setStats({
      revenue: statsJson.revenue_today ?? 0,
      orders: statsJson.orders_today ?? 0,
      avg: statsJson.avg_order_value ?? 0,
      active: statsJson.active_orders ?? 0,
      lowStock: statsJson.low_stock_count ?? 0,
    });
    setRecentOrders(recentJson.data || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Manager Overview</h1>
          <p className="text-sm text-gray-500">{new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'America/New_York' }).format(new Date())}</p>
        </div>
        <button onClick={fetchData} className="btn btn-secondary btn-sm gap-2" disabled={loading}>
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {stats.lowStock > 0 && (
        <div className="mb-6 flex items-center gap-3 bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-xl">
          <AlertCircle className="w-5 h-5" />
          <p className="text-sm font-medium">
            {stats.lowStock} item{stats.lowStock > 1 ? 's' : ''} low on stock.{' '}
            <Link href="/dashboard/manager/inventory" className="underline font-semibold">Check Inventory</Link>
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Today's Revenue", value: formatCurrency(stats.revenue), icon: DollarSign, color: 'text-green-600', bg: 'bg-green-50' },
          { label: "Today's Orders", value: stats.orders, icon: ShoppingBag, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Avg Order Value', value: formatCurrency(stats.avg), icon: TrendingUp, color: 'text-purple-600', bg: 'bg-purple-50' },
          { label: 'Active Orders', value: stats.active, icon: ShoppingBag, color: 'text-orange-600', bg: 'bg-orange-50' },
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

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        {[
          { label: 'View Orders', href: '/dashboard/manager/orders', color: 'bg-blue-600' },
          { label: 'Products', href: '/dashboard/manager/products', color: 'bg-coffee-700' },
          { label: 'Inventory', href: '/dashboard/manager/inventory', color: 'bg-amber-600' },
          { label: 'Reports', href: '/dashboard/manager/reports', color: 'bg-green-600' },
        ].map((link) => (
          <Link key={link.href} href={link.href} className={`${link.color} text-white rounded-xl px-4 py-3 text-sm font-semibold text-center hover:opacity-90 transition-opacity`}>
            {link.label}
          </Link>
        ))}
      </div>

      <div className="card">
        <div className="card-content border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold">Today's Orders</h2>
          <Link href="/dashboard/manager/orders" className="text-sm text-coffee-700 font-medium">View all →</Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                {['Order #', 'Customer', 'Date', 'Status', 'Total'].map((h) => (
                  <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {recentOrders.map((o) => (
                <tr key={o.id} className="hover:bg-gray-50">
                  <td className="px-5 py-3 font-mono text-coffee-700 text-xs font-semibold">{o.order_number}</td>
                  <td className="px-5 py-3 font-medium">{o.customer_name}</td>
                  <td className="px-5 py-3 text-gray-500 text-xs">{formatDateTime(o.created_at)}</td>
                  <td className="px-5 py-3"><span className={`badge ${getOrderStatusColor(o.status as OrderStatus)}`}>{getOrderStatusLabel(o.status as OrderStatus)}</span></td>
                  <td className="px-5 py-3 font-semibold">{formatCurrency(o.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
