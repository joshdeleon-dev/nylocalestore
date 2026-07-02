'use client';

import { useCartStore } from '@/hooks/useCart';
import { formatCurrency } from '@/utils/helpers';
import Link from 'next/link';
import { Trash2, Plus, Minus, ShoppingBag } from 'lucide-react';
import CustomerNav from '@/components/CustomerNav';

export default function CartPage() {
  const { items, subtotal, tax, total, removeItem, updateQuantity } = useCartStore();

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-coffee-50 flex flex-col">
        <CustomerNav backHref="/" backLabel="Menu" />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <ShoppingBag className="w-10 h-10 mx-auto mb-4 text-coffee-200" />
            <h1 className="text-lg font-semibold text-coffee-900 mb-1">Your cart is empty</h1>
            <p className="text-coffee-500 text-sm mb-6">Add items from the menu to get started</p>
            <Link href="/" className="btn btn-primary">Browse Menu</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-coffee-50">
      <CustomerNav backHref="/" backLabel="Menu" />

      <div className="max-w-2xl mx-auto px-4 py-8">

        <h1 className="text-xl font-semibold text-coffee-900 mb-5">Your Order</h1>

        {/* Items */}
        <div className="bg-white rounded-xl border border-coffee-100 overflow-hidden mb-4">
          {items.map((item, i) => (
            <div
              key={item.id}
              className={`p-5 flex items-start gap-4 ${i < items.length - 1 ? 'border-b border-coffee-50' : ''}`}
            >
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-coffee-900 text-sm leading-snug">{item.product_name}</h3>
                {item.modifiers.length > 0 && (
                  <ul className="text-xs text-coffee-400 mt-1.5 space-y-0.5">
                    {item.modifiers.map((mod, idx) => (
                      <li key={idx}>
                        {mod.name}
                        {mod.price_adjustment > 0 && ` (+${formatCurrency(mod.price_adjustment)})`}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="flex items-center gap-3 flex-shrink-0">
                <div className="flex items-center gap-2 bg-coffee-50 border border-coffee-100 rounded-lg px-2 py-1">
                  <button
                    onClick={() => updateQuantity(item.id, item.quantity - 1)}
                    className="w-5 h-5 flex items-center justify-center rounded hover:bg-coffee-100 transition-colors"
                  >
                    <Minus className="w-3 h-3 text-coffee-700" />
                  </button>
                  <span className="text-coffee-900 font-medium text-sm w-4 text-center">{item.quantity}</span>
                  <button
                    onClick={() => updateQuantity(item.id, item.quantity + 1)}
                    className="w-5 h-5 flex items-center justify-center rounded hover:bg-coffee-100 transition-colors"
                  >
                    <Plus className="w-3 h-3 text-coffee-700" />
                  </button>
                </div>

                <span className="text-coffee-900 font-semibold text-sm min-w-[52px] text-right">
                  {formatCurrency(
                    (item.unit_price + item.modifiers.reduce((sum, m) => sum + m.price_adjustment, 0)) * item.quantity
                  )}
                </span>

                <button
                  onClick={() => removeItem(item.id)}
                  className="p-1.5 text-coffee-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Totals */}
        <div className="bg-white rounded-xl border border-coffee-100 p-5 mb-5">
          <div className="space-y-2.5">
            <div className="flex justify-between text-sm text-coffee-600">
              <span>Subtotal</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm text-coffee-600">
              <span>Tax</span>
              <span>{formatCurrency(tax)}</span>
            </div>
            <div className="border-t border-coffee-100 pt-2.5 flex justify-between text-coffee-900 font-semibold">
              <span>Total</span>
              <span>{formatCurrency(total)}</span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <Link
          href="/checkout"
          className="flex items-center justify-center w-full bg-coffee-900 hover:bg-coffee-800 text-white rounded-xl px-5 py-3.5 font-medium text-sm transition-colors mb-3"
        >
          Proceed to Checkout
        </Link>
        <Link
          href="/"
          className="flex items-center justify-center w-full border border-coffee-200 text-coffee-700 hover:bg-coffee-50 rounded-xl px-5 py-3 text-sm font-medium transition-colors"
        >
          Continue Shopping
        </Link>
      </div>
    </div>
  );
}
