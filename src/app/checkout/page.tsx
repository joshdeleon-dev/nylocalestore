'use client';

import { useCartStore } from '@/hooks/useCart';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatCurrency, validatePhoneNumber } from '@/utils/helpers';
import Link from 'next/link';
import toast from 'react-hot-toast';
import CustomerNav from '@/components/CustomerNav';
import { BackLink } from '@/components/food/BackLink';
import { CustomerFooter } from '@/components/food/CustomerFooter';

export default function CheckoutPage() {
  const router = useRouter();
  const { items, subtotal, tax, total, clearCart } = useCartStore();
  const [loading, setLoading] = useState(false);
  const [isOtherLocale, setIsOtherLocale] = useState(false);
  const [formData, setFormData] = useState({
    customer_name: '',
    customer_phone: '',
    group_number: '',
    customer_locale: '',
    notes: '',
    payment_method: 'CASH' as const,
  });

  if (items.length === 0) {
    return (
      <div className="min-h-screen flex flex-col">
        <CustomerNav />
        <main className="flex-1 flex items-center justify-center px-5 py-20">
          <div className="text-center">
            <h1 className="font-serif text-3xl text-coffee-900">No items in your cart</h1>
            <Link href="/#menu" className="btn btn-primary rounded-full px-6 mt-6">Back to the menu</Link>
          </div>
        </main>
        <CustomerFooter />
      </div>
    );
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!formData.customer_name.trim()) {
      toast.error('Please enter your name');
      return;
    }
    if (!isOtherLocale && !formData.group_number) {
      toast.error('Please enter your group number');
      return;
    }
    if (isOtherLocale && !formData.customer_locale.trim()) {
      toast.error('Please enter your locale');
      return;
    }
    if (formData.customer_phone && !validatePhoneNumber(formData.customer_phone)) {
      toast.error('Please enter a valid phone number');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_name: formData.customer_name.trim(),
          customer_phone: formData.customer_phone.trim(),
          group_number: isOtherLocale ? 0 : parseInt(formData.group_number),
          customer_locale: isOtherLocale ? formData.customer_locale.trim() : null,
          items: items.map((item) => ({
            product_id: item.product_id,
            quantity: item.quantity,
            modifiers: item.modifiers,
          })),
          notes: formData.notes.trim(),
          payment_method: formData.payment_method,
          tax_rate: 0,
          order_date: new Date().toISOString(),
          sales_date: new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date()),
        }),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to create order');

      toast.success('Order placed successfully!');
      try {
        // The public order lookup omits personal details; hand them to the confirmation page directly
        sessionStorage.setItem(`order-contact-${result.data.id}`, JSON.stringify({
          customer_name: result.data.customer_name,
          notes: result.data.notes,
        }));
      } catch {}
      clearCart();
      router.push(`/confirmation/${result.data.id}`);
    } catch (error) {
      console.error('Error placing order:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to place order');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <CustomerNav />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-5 py-6 sm:py-10">
        <div className="mb-5"><BackLink href="/cart" label="Cart" /></div>
        <h1 className="font-serif text-4xl font-medium text-coffee-900 mb-6">Checkout</h1>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6 items-start">

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="bg-white rounded-2xl border border-coffee-100 p-5 sm:p-6">
              <h2 className="font-serif text-xl text-coffee-900 mb-5">Your details</h2>

              <div className="space-y-4">
                <div>
                  <label className="label">Name *</label>
                  <input
                    type="text"
                    name="customer_name"
                    value={formData.customer_name}
                    onChange={handleInputChange}
                    placeholder="Your name"
                    className="input"
                    required
                  />
                </div>

                <div>
                  <label className="label">Phone Number</label>
                  <input
                    type="tel"
                    name="customer_phone"
                    value={formData.customer_phone}
                    onChange={handleInputChange}
                    placeholder="(555) 123-4567"
                    className="input"
                  />
                </div>

                <div>
                  <label className="label">Group / Locale *</label>
                  <div className="flex gap-1 rounded-full border border-coffee-200 p-1 mb-2">
                    <button
                      type="button"
                      onClick={() => setIsOtherLocale(false)}
                      aria-pressed={!isOtherLocale}
                      className={`flex-1 py-2 rounded-full text-sm font-medium transition-colors ${
                        !isOtherLocale
                          ? 'bg-coffee-900 text-white'
                          : 'text-coffee-600 hover:bg-coffee-50'
                      }`}
                    >
                      Group Number
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsOtherLocale(true)}
                      aria-pressed={isOtherLocale}
                      className={`flex-1 py-2 rounded-full text-sm font-medium transition-colors ${
                        isOtherLocale
                          ? 'bg-coffee-900 text-white'
                          : 'text-coffee-600 hover:bg-coffee-50'
                      }`}
                    >
                      Other Locale
                    </button>
                  </div>

                  {!isOtherLocale ? (
                    <>
                      <input
                        type="number"
                        name="group_number"
                        value={formData.group_number}
                        onChange={handleInputChange}
                        placeholder="e.g., 12"
                        min="1"
                        className="input"
                      />
                      <p className="text-xs text-coffee-400 mt-1.5">
                        We'll call this number when your order is ready
                      </p>
                    </>
                  ) : (
                    <>
                      <input
                        type="text"
                        name="customer_locale"
                        value={formData.customer_locale}
                        onChange={handleInputChange}
                        placeholder="e.g., Brooklyn, Queens…"
                        className="input"
                        required
                      />
                      <p className="text-xs text-coffee-400 mt-1.5">
                        Tell us where you're visiting from
                      </p>
                    </>
                  )}
                </div>

                <div>
                  <label className="label">Special Instructions</label>
                  <textarea
                    name="notes"
                    value={formData.notes}
                    onChange={handleInputChange}
                    placeholder="Any special requests…"
                    className="textarea"
                    rows={3}
                  />
                </div>

                <div>
                  <label className="label">Payment Method</label>
                  <select
                    name="payment_method"
                    value={formData.payment_method}
                    onChange={handleInputChange}
                    className="select"
                  >
                    <option value="CASH">Cash</option>
                    <option value="CARD">Card</option>
                    <option value="MOBILE">Mobile Payment</option>
                  </select>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center bg-coffee-900 hover:bg-coffee-700 disabled:opacity-50 text-white rounded-full px-5 py-3.5 font-medium transition-colors"
            >
              {loading ? 'Placing order…' : 'Place order'}
            </button>
          </form>

          {/* Order summary */}
          <div>
            <div className="bg-white rounded-2xl border border-coffee-100 p-5 lg:sticky lg:top-24">
              <h2 className="font-serif text-xl text-coffee-900 mb-4">Order summary</h2>

              <div className="space-y-3 mb-4 pb-4 border-b border-coffee-100">
                {items.map((item) => (
                  <div key={item.id} className="flex justify-between gap-3 text-sm">
                    <div className="flex-1 min-w-0">
                      <p className="text-coffee-900 font-medium leading-snug">
                        {item.quantity}× {item.product_name}
                      </p>
                      {item.modifiers.length > 0 && (
                        <ul className="text-xs text-coffee-400 mt-0.5 space-y-0.5">
                          {item.modifiers.map((mod, idx) => (
                            <li key={idx}>{mod.name}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <span className="text-coffee-900 font-medium flex-shrink-0">
                      {formatCurrency(
                        (item.unit_price + item.modifiers.reduce((sum, m) => sum + m.price_adjustment, 0)) *
                          item.quantity
                      )}
                    </span>
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm text-coffee-500">
                  <span>Subtotal</span>
                  <span>{formatCurrency(subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm text-coffee-500">
                  <span>Tax</span>
                  <span>{formatCurrency(tax)}</span>
                </div>
                <div className="border-t border-coffee-100 pt-2 flex justify-between font-semibold text-coffee-900">
                  <span>Total</span>
                  <span>{formatCurrency(total)}</span>
                </div>
              </div>

              <p className="text-xs text-coffee-400 text-center mt-4">
                You'll receive a confirmation with your order number
              </p>
            </div>
          </div>
        </div>
      </main>

      <CustomerFooter />
    </div>
  );
}
