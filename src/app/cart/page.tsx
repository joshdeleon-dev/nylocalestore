'use client';

import { useCartStore } from '@/hooks/useCart';
import { formatCurrency } from '@/utils/helpers';
import Link from 'next/link';
import { Trash2, Plus, Minus, ShoppingBag } from 'lucide-react';
import CustomerNav from '@/components/CustomerNav';
import { BackLink } from '@/components/food/BackLink';
import { CustomerFooter } from '@/components/food/CustomerFooter';

export default function CartPage() {
  const { items, subtotal, tax, total, removeItem, updateQuantity } = useCartStore();

  if (items.length === 0) {
    return (
      <div className="min-h-screen flex flex-col">
        <CustomerNav />
        <main className="flex-1 flex items-center justify-center px-5 py-20">
          <div className="text-center">
            <ShoppingBag className="w-10 h-10 mx-auto mb-4 text-coffee-300" />
            <h1 className="font-serif text-3xl text-coffee-900">Your cart is empty</h1>
            <p className="text-coffee-500 mt-2 mb-6">Add something from the menu to get started.</p>
            <Link href="/#menu" className="btn btn-primary rounded-full px-6">Browse the menu</Link>
          </div>
        </main>
        <CustomerFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <CustomerNav />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-5 py-6 sm:py-10">
        <div className="mb-5"><BackLink href="/#menu" label="Menu" /></div>
        <h1 className="font-serif text-4xl font-medium text-coffee-900 mb-6">Your order</h1>

        <div className="grid lg:grid-cols-[1fr_340px] gap-6 items-start">
          {/* Items */}
          <div className="rounded-2xl bg-white border border-coffee-100 divide-y divide-coffee-100">
            {items.map((item) => (
              <div key={item.id} className="p-4 sm:p-5 flex flex-wrap sm:flex-nowrap items-start gap-4">
                <div className="flex-1 min-w-[160px]">
                  <h3 className="font-medium text-coffee-900 leading-snug">{item.product_name}</h3>
                  {item.modifiers.length > 0 && (
                    <ul className="text-sm text-coffee-500 mt-1 space-y-0.5">
                      {item.modifiers.map((mod, idx) => (
                        <li key={idx}>
                          {mod.name}
                          {mod.price_adjustment > 0 && ` (+${formatCurrency(mod.price_adjustment)})`}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="flex items-center gap-3 flex-shrink-0 ml-auto">
                  <div className="flex items-center gap-2 rounded-full border border-coffee-200 px-2 py-1">
                    <button
                      onClick={() => updateQuantity(item.id, item.quantity - 1)}
                      className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-coffee-100 transition-colors"
                      aria-label={`Decrease ${item.product_name}`}
                    >
                      <Minus className="w-3.5 h-3.5 text-coffee-700" />
                    </button>
                    <span className="text-coffee-900 font-medium text-sm w-4 text-center">{item.quantity}</span>
                    <button
                      onClick={() => updateQuantity(item.id, item.quantity + 1)}
                      disabled={item.max_stock != null && item.quantity >= item.max_stock}
                      className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-coffee-100 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      aria-label={`Increase ${item.product_name}`}
                    >
                      <Plus className="w-3.5 h-3.5 text-coffee-700" />
                    </button>
                  </div>

                  <span className="text-coffee-900 font-semibold min-w-[60px] text-right">
                    {formatCurrency(
                      (item.unit_price + item.modifiers.reduce((sum, m) => sum + m.price_adjustment, 0)) * item.quantity
                    )}
                  </span>

                  <button
                    onClick={() => removeItem(item.id)}
                    className="p-2 text-coffee-300 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
                    aria-label={`Remove ${item.product_name}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Summary */}
          <div className="rounded-2xl bg-white border border-coffee-100 p-5 lg:sticky lg:top-24">
            <h2 className="font-serif text-xl text-coffee-900 mb-4">Summary</h2>
            <div className="space-y-2.5 text-sm">
              <div className="flex justify-between text-coffee-600"><span>Subtotal</span><span>{formatCurrency(subtotal)}</span></div>
              <div className="flex justify-between text-coffee-600"><span>Tax</span><span>{formatCurrency(tax)}</span></div>
              <div className="border-t border-coffee-200 pt-2.5 flex justify-between text-coffee-900 font-semibold text-base">
                <span>Total</span><span>{formatCurrency(total)}</span>
              </div>
            </div>
            <Link
              href="/checkout"
              className="mt-5 flex items-center justify-center w-full rounded-full bg-coffee-900 hover:bg-coffee-700 text-white px-5 py-3.5 font-medium transition-colors"
            >
              Proceed to checkout
            </Link>
            <Link
              href="/#menu"
              className="mt-2 flex items-center justify-center w-full rounded-full border border-coffee-200 text-coffee-700 hover:bg-coffee-50 px-5 py-3 text-sm font-medium transition-colors"
            >
              Continue shopping
            </Link>
          </div>
        </div>
      </main>

      <CustomerFooter />
    </div>
  );
}
