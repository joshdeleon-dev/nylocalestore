'use client';

import { useEffect, useState } from 'react';
import { formatCurrency, formatDateTime } from '@/utils/helpers';
import { getOrderStatusColor, getOrderStatusLabel } from '@/utils/helpers';
import { Order, OrderStatus } from '@/types';
import {
  DollarSign,
  ShoppingBag,
  TrendingUp,
  Users,
  RefreshCw,
  Clock,
  AlertCircle,
} from 'lucide-react';
import Link from 'next/link';

interface Stats {
  revenue_today: number;
  orders_today: number;
  avg_order_value: number;
  active_orders: number;
  low_stock_count: number;
}

export default function AdminOverviewPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [statsJson, recentJson] = await Promise.all([
        fetch('/api/orders/stats').then((r) => r.json()),
        fetch('/api/orders?limit=8').then((r) => r.json()),
      ]);
      setStats(statsJson);
      setRecentOrders(recentJson.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const statCards = stats
    ? [
        {
          label: "Today's Revenue",
          value: formatCurrency(stats.revenue_today),
          icon: DollarSign,
          color: 'text-green-600',
          bg: 'bg-green-50',
        },
        {
          label: "Today's Orders",
          value: stats.orders_today,
          icon: ShoppingBag,
          color: 'text-blue-600',
          bg: 'bg-blue-50',
        },
        {
          label: 'Avg Order Value',
          value: formatCurrency(stats.avg_order_value),
          icon: TrendingUp,
          color: 'text-purple-600',
          bg: 'bg-purple-50',
        },
        {
          label: 'Active Orders',
          value: stats.active_orders,
          icon: Clock,
          color: 'text-orange-600',
          bg: 'bg-orange-50',
        },
      ]
    : [];

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Admin Overview</h1>
          <p className="text-sm text-gray-500 mt-1">
            {new Intl.DateTimeFormat('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              timeZone: 'America/New_York',
            }).format(new Date())}
          </p>
        </div>
        <button
          onClick={fetchData}
          className="btn btn-secondary btn-sm gap-2"
          disabled={loading}
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Low Stock Alert */}
      {stats && stats.low_stock_count > 0 && (
        <div className="mb-6 flex items-center gap-3 bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-xl">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm font-medium">
            {stats.low_stock_count} product{stats.low_stock_count > 1 ? 's are' : ' is'} low on
            stock.{' '}
            <Link href="/dashboard/admin/inventory" className="underline font-semibold">
              View Inventory
            </Link>
          </p>
        </div>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="card skeleton h-28" />
            ))
          : statCards.map((s) => {
              const Icon = s.icon;
              return (
                <div key={s.label} className="card">
                  <div className="card-content">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm text-gray-500 font-medium">{s.label}</span>
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

      {/* Quick Links */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        {[
          { label: 'Manage Orders', href: '/dashboard/admin/orders', color: 'bg-blue-600' },
          { label: 'Manage Products', href: '/dashboard/admin/products', color: 'bg-coffee-700' },
          { label: 'Manage Users', href: '/dashboard/admin/users', color: 'bg-purple-600' },
          { label: 'View Reports', href: '/dashboard/admin/reports', color: 'bg-green-600' },
        ].map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={`${link.color} text-white rounded-xl px-4 py-3 text-sm font-semibold text-center hover:opacity-90 transition-opacity`}
          >
            {link.label}
          </Link>
        ))}
      </div>

      {/* Recent Orders */}
      <div className="card">
        <div className="card-content border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Recent Orders</h2>
          <Link
            href="/dashboard/admin/orders"
            className="text-sm text-coffee-700 hover:text-coffee-800 font-medium"
          >
            View all →
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Order
                </th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Customer
                </th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">
                  Date
                </th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Status
                </th>
                <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Total
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading
                ? Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>
                      <td colSpan={5} className="px-6 py-3">
                        <div className="skeleton h-4 rounded" />
                      </td>
                    </tr>
                  ))
                : recentOrders.map((order) => (
                    <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-3 font-mono font-medium text-coffee-700">
                        {order.order_number}
                      </td>
                      <td className="px-6 py-3 font-medium text-gray-900">
                        {order.customer_name}
                        <span className="ml-2 text-xs text-gray-400">#{order.group_number}</span>
                      </td>
                      <td className="px-6 py-3 text-gray-500 hidden md:table-cell">
                        {formatDateTime(order.created_at)}
                      </td>
                      <td className="px-6 py-3">
                        <span
                          className={`badge ${getOrderStatusColor(order.status as OrderStatus)}`}
                        >
                          {getOrderStatusLabel(order.status as OrderStatus)}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-right font-semibold text-gray-900">
                        {formatCurrency(order.total)}
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
          {!loading && recentOrders.length === 0 && (
            <div className="text-center py-8 text-gray-400">No orders yet today.</div>
          )}
        </div>
      </div>
    </div>
  );
}
