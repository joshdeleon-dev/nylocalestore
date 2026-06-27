'use client';

import { useEffect, useState } from 'react';
import { Order } from '@/types';
import { formatCurrency, formatDate, getOrderStatusColor, getOrderStatusLabel } from '@/utils/helpers';
import Link from 'next/link';
import { CheckCircle, Copy } from 'lucide-react';
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
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-600">Loading order details...</p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Order not found</p>
          <Link href="/" className="btn btn-primary">
            Back to Menu
          </Link>
        </div>
      </div>
    );
  }

  const copyOrderNumber = () => {
    navigator.clipboard.writeText(order.order_number);
    toast.success('Order number copied!');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50">
      <CustomerNav />
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Success Message */}
        <div className="text-center mb-8">
          <div className="inline-block mb-4">
            <CheckCircle className="w-16 h-16 text-green-600" />
          </div>
          <h1 className="text-3xl font-bold mb-2">Order Confirmed!</h1>
          <p className="text-gray-600">Your order has been placed successfully</p>
        </div>

        {/* Order Details */}
        <div className="bg-white rounded-lg shadow-lg p-8 mb-6">
          {/* Order Number */}
          <div className="mb-6 pb-6 border-b border-gray-200">
            <p className="text-sm text-gray-500 mb-2">Order Number</p>
            <div className="flex items-center justify-between">
              <p className="text-3xl font-bold text-coffee-700">{order.order_number}</p>
              <button
                onClick={copyOrderNumber}
                className="p-2 hover:bg-gray-100 rounded transition-colors"
              >
                <Copy className="w-5 h-5 text-gray-600" />
              </button>
            </div>
          </div>

          {/* Key Info */}
          <div className="grid grid-cols-2 gap-4 mb-6 pb-6 border-b border-gray-200">
            <div>
              <p className="text-sm text-gray-500">Name</p>
              <p className="font-semibold">{order.customer_name}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">{order.group_number === 0 ? 'Locale' : 'Group Number'}</p>
              <p className="font-semibold text-lg text-coffee-700">
                {order.group_number === 0
                  ? ((order as any).customer_locale || 'Other Locale')
                  : `#${order.group_number}`}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Status</p>
              <p className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${getOrderStatusColor(order.status)}`}>
                {getOrderStatusLabel(order.status)}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Date</p>
              <p className="font-semibold">{formatDate((order as any).sales_date)}</p>
            </div>
          </div>

          {/* Order Items */}
          <div className="mb-6 pb-6 border-b border-gray-200">
            <h3 className="font-bold text-lg mb-4">Items</h3>
            <div className="space-y-3">
              {order.items?.map(item => (
                <div key={item.id} className="flex justify-between items-start">
                  <div className="flex-1">
                    <p className="font-medium">
                      {item.quantity}x {item.product?.name}
                    </p>
                    {item.modifiers && item.modifiers.length > 0 && (
                      <ul className="text-sm text-gray-600 mt-1 space-y-0.5">
                        {item.modifiers.map((mod, idx) => (
                          <li key={idx}>
                            • {mod.name}
                            {mod.price_adjustment > 0 && ` (+${formatCurrency(mod.price_adjustment)})`}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <span className="font-semibold">{formatCurrency(item.line_total)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Totals */}
          <div className="space-y-2">
            <div className="flex justify-between text-gray-700">
              <span>Subtotal</span>
              <span>{formatCurrency(order.subtotal)}</span>
            </div>
            <div className="flex justify-between text-gray-700">
              <span>Tax</span>
              <span>{formatCurrency(order.tax)}</span>
            </div>
            <div className="border-t border-gray-200 pt-2 flex justify-between text-lg font-bold">
              <span>Total</span>
              <span className="text-coffee-700">{formatCurrency(order.total)}</span>
            </div>
          </div>

          {order.notes && (
            <div className="mt-6 pt-6 border-t border-gray-200">
              <p className="text-sm text-gray-500">Special Instructions</p>
              <p className="text-gray-700 italic">{order.notes}</p>
            </div>
          )}
        </div>

        {/* Next Steps */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
          <h3 className="font-bold mb-2">What's Next?</h3>
          <ul className="space-y-2 text-sm text-gray-700">
            <li>✓ Your order has been sent to our team</li>
            <li>✓ We'll start preparing your order right away</li>
            <li>✓ {order.group_number === 0
              ? `We'll call out "${(order as any).customer_locale || 'Other Locale'}" when it's ready`
              : `We'll call out group ${order.group_number} when it's ready`}</li>
            <li>✓ Keep your order number handy: <strong>{order.order_number}</strong></li>
          </ul>
        </div>

        {/* Actions */}
        <div className="grid grid-cols-2 gap-4">
          <Link href="/" className="btn btn-secondary justify-center">
            Browse Menu
          </Link>
          <Link href="/" className="btn btn-primary justify-center">
            Order Again
          </Link>
        </div>
      </div>
    </div>
  );
}
