'use client';

import { useEffect, useRef, useState } from 'react';
import { Order, OrderStatus } from '@/types';
import { getOrderStatusColor, getOrderStatusLabel } from '@/utils/helpers';
import { useAuth } from '@/hooks/useAuth';
import { StickerPrint } from '@/components/StickerPrint';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Search,
  Volume2,
  VolumeX,
} from 'lucide-react';
import toast from 'react-hot-toast';

const STATUS_TABS: OrderStatus[] = ['NEW', 'ACCEPTED', 'IN_PROGRESS', 'READY'];

const NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  NEW: 'ACCEPTED',
  ACCEPTED: 'IN_PROGRESS',
  IN_PROGRESS: 'READY',
  READY: 'COMPLETED',
};

const NEXT_LABEL: Partial<Record<OrderStatus, string>> = {
  NEW: 'Accept Order',
  ACCEPTED: 'Start Making',
  IN_PROGRESS: 'Mark Ready',
  READY: 'Complete',
};

export default function BaristaPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<OrderStatus>('NEW');
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [search, setSearch] = useState('');
  const prevOrderIds = useRef<Set<number>>(new Set());
  const audioCtx = useRef<AudioContext | null>(null);

  const playNewOrderSound = () => {
    if (!soundEnabled) return;
    try {
      if (!audioCtx.current) {
        audioCtx.current = new AudioContext();
      }
      const ctx = audioCtx.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.setValueAtTime(1100, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.4);
    } catch {}
  };

  const fetchOrders = async () => {
    try {
      const res = await fetch('/api/orders?statuses=NEW,ACCEPTED,IN_PROGRESS,READY&limit=200');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);

      const newOrders: Order[] = (json.data || []).sort((a: Order, b: Order) =>
        new Date(a.order_date).getTime() - new Date(b.order_date).getTime()
      );

      // Detect new orders
      const newIds = new Set<number>(newOrders.map((o) => o.id));
      const isFirst = prevOrderIds.current.size === 0 && newOrders.length > 0;
      if (!isFirst) {
        newOrders.forEach((o) => {
          if (!prevOrderIds.current.has(o.id) && o.status === 'NEW') {
            playNewOrderSound();
            toast('🔔 New order received!', { duration: 3000 });
          }
        });
      }
      prevOrderIds.current = newIds;

      setOrders(newOrders);
    } catch {
      toast.error('Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
    if (autoRefresh) {
      const interval = setInterval(fetchOrders, 15000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  const updateStatus = async (orderId: number, newStatus: OrderStatus) => {
    try {
      const res = await fetch('/api/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: orderId, status: newStatus }),
      });
      if (!res.ok) throw new Error();
      toast.success(`Order ${getOrderStatusLabel(newStatus).toLowerCase()}`);
      fetchOrders();
    } catch {
      toast.error('Failed to update order');
    }
  };

  const cancelOrder = async (orderId: number) => {
    if (!confirm('Cancel this order?')) return;
    await updateStatus(orderId, 'CANCELLED');
  };

  const filtered = orders.filter((o) => {
    if (o.status !== selectedStatus) return false;
    if (!search) return true;
    return (
      o.order_number.toLowerCase().includes(search.toLowerCase()) ||
      o.customer_name.toLowerCase().includes(search.toLowerCase())
    );
  });

  const countByStatus = (status: OrderStatus) => orders.filter((o) => o.status === status).length;

  const cardBg: Record<OrderStatus, string> = {
    NEW: 'border-red-300 bg-red-50',
    ACCEPTED: 'border-yellow-300 bg-yellow-50',
    IN_PROGRESS: 'border-blue-300 bg-blue-50',
    READY: 'border-green-300 bg-green-50',
    COMPLETED: 'border-gray-200 bg-gray-50',
    CANCELLED: 'border-gray-200 bg-gray-50',
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-40">
        <div className="px-4 sm:px-6 py-3 flex items-center gap-4">
          <h1 className="font-bold text-gray-900 text-sm hidden sm:block flex-shrink-0">Order Queue</h1>

          <div className="flex-1 max-w-xs">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search…"
                className="input pl-9 py-2 text-sm"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 ml-auto flex-shrink-0">
            <button
              onClick={() => setSoundEnabled((v) => !v)}
              className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"
              title={soundEnabled ? 'Mute sounds' : 'Enable sounds'}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>
            <label className="flex items-center gap-1.5 text-xs font-medium text-gray-600 cursor-pointer whitespace-nowrap">
              <input
                type="checkbox"
                className="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
              />
              Auto
            </label>
            <button
              onClick={fetchOrders}
              className="btn btn-secondary btn-sm whitespace-nowrap"
              disabled={loading}
            >
              {loading ? <Clock className="w-4 h-4 animate-spin" /> : 'Refresh'}
            </button>
          </div>
        </div>

        {/* Status Tabs */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex gap-1 pb-0 overflow-x-auto">
            {STATUS_TABS.map((status) => {
              const count = countByStatus(status);
              return (
                <button
                  key={status}
                  onClick={() => setSelectedStatus(status)}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 whitespace-nowrap transition-all ${
                    selectedStatus === status
                      ? 'border-coffee-700 text-coffee-800'
                      : 'border-transparent text-gray-500 hover:text-gray-800'
                  }`}
                >
                  {getOrderStatusLabel(status)}
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                      count > 0 && status === 'NEW'
                        ? 'bg-red-500 text-white'
                        : count > 0
                        ? 'bg-coffee-100 text-coffee-800'
                        : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* Orders Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3 text-gray-400">
            <Clock className="w-10 h-10 animate-spin" />
            <p>Loading orders…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3 text-gray-400">
            <CheckCircle2 className="w-12 h-12 text-green-400" />
            <p className="font-medium">No {getOrderStatusLabel(selectedStatus).toLowerCase()} orders</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map((order) => (
              <div
                key={order.id}
                className={`card border-2 flex flex-col ${cardBg[order.status as OrderStatus] || 'border-gray-200'}`}
              >
                {/* Order Header */}
                <div className="card-content border-b border-current border-opacity-20">
                  <div className="flex items-start justify-between mb-1">
                    <p className="text-xs font-mono font-semibold text-gray-500">
                      {order.order_number}
                    </p>
                    <span
                      className={`badge text-xs ${getOrderStatusColor(order.status as OrderStatus)}`}
                    >
                      {getOrderStatusLabel(order.status as OrderStatus)}
                    </span>
                  </div>
                  <p className="text-2xl font-bold text-gray-900">#{order.group_number}</p>
                  <p className="text-sm text-gray-600 font-medium">{order.customer_name}</p>
                </div>

                {/* Items */}
                <div className="card-content border-b border-current border-opacity-20 flex-1">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    Items
                  </p>
                  <div className="space-y-2">
                    {order.items?.map((item) => (
                      <div key={item.id} className="text-sm">
                        <p className="font-bold">
                          {item.quantity}× {(item as any).product?.name}
                        </p>
                        {item.modifiers && item.modifiers.length > 0 && (
                          <ul className="text-xs text-gray-600 mt-1 ml-2 space-y-0.5">
                            {item.modifiers.map((mod, idx) => (
                              <li key={idx}>• {mod.name}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Notes */}
                {order.notes && (
                  <div className="px-4 py-3 border-b border-current border-opacity-20">
                    <div className="flex gap-2 items-start">
                      <AlertCircle className="w-4 h-4 text-yellow-600 flex-shrink-0 mt-0.5" />
                      <p className="text-xs font-medium text-yellow-900">{order.notes}</p>
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="card-content space-y-2">
                  {NEXT_STATUS[order.status as OrderStatus] && (
                    <button
                      onClick={() =>
                        updateStatus(order.id, NEXT_STATUS[order.status as OrderStatus]!)
                      }
                      className="btn btn-primary btn-sm w-full justify-center"
                    >
                      {NEXT_LABEL[order.status as OrderStatus]}
                    </button>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    <StickerPrint
                      order={order}
                      buttonClassName="btn btn-secondary btn-sm justify-center w-full gap-1.5"
                    />
                    <button
                      onClick={() => cancelOrder(order.id)}
                      className="btn btn-sm justify-center w-full text-red-600 hover:bg-red-50 border border-red-200 rounded-lg"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
