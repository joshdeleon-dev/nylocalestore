'use client';

import { useCartStore } from '@/hooks/useCart';
import { formatCurrency } from '@/utils/helpers';
import Link from 'next/link';
import { Trash2, Plus, Minus, ShoppingCart } from 'lucide-react';
import CustomerNav from '@/components/CustomerNav';

export default function CartPage() {
  const { items, subtotal, tax, total, removeItem, updateQuantity } = useCartStore();

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <ShoppingCart className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <h1 className="text-2xl font-bold mb-2">Your cart is empty</h1>
          <p className="text-gray-600 mb-6">Start by adding items from our menu</p>
          <Link href="/" className="btn btn-primary">
            Browse Menu
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <CustomerNav backHref="/" backLabel="Menu" />
      <div className="max-w-2xl mx-auto px-4 pt-6">
        <h1 className="text-2xl font-bold">Your Order</h1>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Items */}
        <div className="bg-white rounded-lg shadow-sm mb-6">
          {items.map(item => (
            <div
              key={item.id}
              className="p-4 border-b border-gray-200 last:border-b-0 flex justify-between items-start"
            >
              <div className="flex-1">
                <h3 className="font-semibold text-lg">{item.product_name}</h3>
                {item.modifiers.length > 0 && (
                  <ul className="text-sm text-gray-600 mt-2 space-y-1">
                    {item.modifiers.map((mod, idx) => (
                      <li key={idx}>
                        • {mod.name}
                        {mod.price_adjustment > 0 && ` (+${formatCurrency(mod.price_adjustment)})`}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="flex items-center gap-4 ml-4">
                <div className="flex items-center gap-2 bg-gray-100 rounded-lg">
                  <button
                    onClick={() => updateQuantity(item.id, item.quantity - 1)}
                    className="p-2 hover:bg-gray-200"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="px-3 font-semibold">{item.quantity}</span>
                  <button
                    onClick={() => updateQuantity(item.id, item.quantity + 1)}
                    className="p-2 hover:bg-gray-200"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>

                <div className="text-right min-w-24">
                  <p className="font-semibold text-lg">
                    {formatCurrency(
                      (item.unit_price +
                        item.modifiers.reduce((sum, m) => sum + m.price_adjustment, 0)) *
                        item.quantity
                    )}
                  </p>
                </div>

                <button
                  onClick={() => removeItem(item.id)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Totals */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="space-y-3">
            <div className="flex justify-between text-gray-700">
              <span>Subtotal</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex justify-between text-gray-700">
              <span>Tax</span>
              <span>{formatCurrency(tax)}</span>
            </div>
            <div className="border-t border-gray-200 pt-3 flex justify-between text-lg font-bold">
              <span>Total</span>
              <span className="text-coffee-700">{formatCurrency(total)}</span>
            </div>
          </div>
        </div>

        {/* Checkout Button */}
        <Link href="/checkout" className="btn btn-primary w-full mb-4 justify-center">
          Proceed to Checkout
        </Link>

        <Link href="/" className="btn btn-secondary w-full justify-center">
          Continue Shopping
        </Link>
      </div>
    </div>
  );
}
