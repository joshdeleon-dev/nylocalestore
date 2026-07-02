'use client';

import { useEffect, useState } from 'react';
import { Order } from '@/types';
import { formatCurrency, formatDate, getOrderStatusColor, getOrderStatusLabel } from '@/utils/helpers';
import Link from 'next/link';
import { CheckCircle2, Copy } from 'lucide-react';
import toast from 'react-hot-toast';
import CustomerNav from '@/components/CustomerNav';

export default function ConfirmationClient({ id }: { id: string }) {
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOrder = async () => {
      try {
        const res = await fetch(`/api/orders/${id}`);
        const json = await res.json();
        if (!res.ok || !json.success) throw new Error(json.error || 'Not found');
        setOrder(json.data);
      } catch (error) {
        console.error('Error fetching order:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchOrder();
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-coffee-50">
        <p className="text-coffee-400 text-sm">Loading order details…</p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-coffee-50 flex flex-col">
        <CustomerNav />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-coffee-500 text-sm mb-4">Order not found</p>
            <Link href="/" className="btn btn-primary">Back to Menu</Link>
          </div>
        </div>
      </div>
    );
  }

  const copyOrderNumber = () => {
    navigator.clipboard.writeText(order.order_number);
    toast.success('Order number copied!');
  };

  const isOtherLocale = order.group_number === 0;
  const localeName = (order as any).customer_locale || 'Other Locale';

  return (
    <div className="min-h-screen bg-coffee-50">
      <CustomerNav />

      <div className="max-w-xl mx-auto px-4 py-10">

        {/* Success header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-coffee-900 mb-4">
            <CheckCircle2 className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-semibold text-coffee-900 mb-1">Order Confirmed</h1>
          <p className="text-coffee-500 text-sm">Your order has been placed successfully</p>
        </div>

        {/* Order card */}
        <div className="bg-white rounded-xl border border-coffee-100 overflow-hidden mb-4">

          {/* Order number */}
          <div className="px-6 py-5 border-b border-coffee-100 flex items-center justify-between">
            <div>
              <p className="text-xs text-coffee-400 uppercase tracking-wider font-medium mb-1">Order Number</p>
              <p className="text-3xl font-bold text-coffee-900 font-serif">{order.order_number}</p>
            </div>
            <button
              onClick={copyOrderNumber}
              className="p-2.5 hover:bg-coffee-50 rounded-lg transition-colors text-coffee-400 hover:text-coffee-700"
            >
              <Copy className="w-4 h-4" />
            </button>
          </div>

          {/* Key info */}
          <div className="grid grid-cols-2 gap-4 px-6 py-5 border-b border-coffee-100">
            <div>
              <p className="text-xs text-coffee-400 uppercase tracking-wider font-medium mb-1">Name</p>
              <p className="text-coffee-900 font-medium text-sm">{order.customer_name}</p>
            </div>
            <div>
              <p className="text-xs text-coffee-400 uppercase tracking-wider font-medium mb-1">
                {isOtherLocale ? 'Locale' : 'Group Number'}
              </p>
              <p className="text-coffee-900 font-semibold text-sm">
                {isOtherLocale ? localeName : `#${order.group_number}`}
              </p>
            </div>
            <div>
              <p className="text-xs text-coffee-400 uppercase tracking-wider font-medium mb-1">Status</p>
              <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${getOrderStatusColor(order.status)}`}>
                {getOrderStatusLabel(order.status)}
              </span>
            </div>
            <div>
              <p className="text-xs text-coffee-400 uppercase tracking-wider font-medium mb-1">Date</p>
              <p className="text-coffee-900 font-medium text-sm">{formatDate((order as any).sales_date)}</p>
            </div>
          </div>

          {/* Items */}
          <div className="px-6 py-5 border-b border-coffee-100">
            <p className="text-xs text-coffee-400 uppercase tracking-wider font-medium mb-3">Items</p>
            <div className="space-y-3">
              {order.items?.map((item) => (
                <div key={item.id} className="flex justify-between items-start gap-4">
                  <div className="flex-1">
                    <p className="text-coffee-900 font-medium text-sm">
                      {item.quantity}× {item.product?.name}
                    </p>
                    {item.modifiers && item.modifiers.length > 0 && (
                      <ul className="text-xs text-coffee-400 mt-1 space-y-0.5">
                        {item.modifiers.map((mod, idx) => (
                          <li key={idx}>
                            {mod.name}
                            {mod.price_adjustment > 0 && ` (+${formatCurrency(mod.price_adjustment)})`}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <span className="text-coffee-900 font-semibold text-sm flex-shrink-0">
                    {formatCurrency(item.line_total)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Totals */}
          <div className="px-6 py-5 space-y-2">
            <div className="flex justify-between text-sm text-coffee-500">
              <span>Subtotal</span>
              <span>{formatCurrency(order.subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm text-coffee-500">
              <span>Tax</span>
              <span>{formatCurrency(order.tax)}</span>
            </div>
            <div className="border-t border-coffee-100 pt-2 flex justify-between font-semibold text-coffee-900">
              <span>Total</span>
              <span>{formatCurrency(order.total)}</span>
            </div>

            {order.notes && (
              <div className="border-t border-coffee-100 pt-3 mt-2">
                <p className="text-xs text-coffee-400 uppercase tracking-wider font-medium mb-1">Special Instructions</p>
                <p className="text-coffee-600 text-sm italic">{order.notes}</p>
              </div>
            )}
          </div>
        </div>

        {/* What's next */}
        <div className="bg-coffee-900 rounded-xl p-5 mb-6 text-white">
          <p className="text-xs font-semibold uppercase tracking-wider text-coffee-400 mb-3">What's Next</p>
          <ul className="space-y-2 text-sm text-coffee-200">
            <li className="flex items-start gap-2">
              <span className="text-coffee-400 mt-0.5">✓</span>
              Your order has been sent to our team
            </li>
            <li className="flex items-start gap-2">
              <span className="text-coffee-400 mt-0.5">✓</span>
              We'll start preparing your order right away
            </li>
            <li className="flex items-start gap-2">
              <span className="text-coffee-400 mt-0.5">✓</span>
              {isOtherLocale
                ? `We'll call out "${localeName}" when it's ready`
                : `We'll call out group ${order.group_number} when it's ready`}
            </li>
            <li className="flex items-start gap-2">
              <span className="text-coffee-400 mt-0.5">✓</span>
              Keep your order number handy: <strong className="text-white ml-1">{order.order_number}</strong>
            </li>
          </ul>
        </div>

        {/* Actions */}
        <div className="grid grid-cols-2 gap-3">
          <Link
            href="/"
            className="flex items-center justify-center border border-coffee-200 text-coffee-700 hover:bg-coffee-50 rounded-xl px-5 py-3 text-sm font-medium transition-colors"
          >
            Browse Menu
          </Link>
          <Link
            href="/"
            className="flex items-center justify-center bg-coffee-900 hover:bg-coffee-800 text-white rounded-xl px-5 py-3 text-sm font-medium transition-colors"
          >
            Order Again
          </Link>
        </div>
      </div>
    </div>
  );
}
