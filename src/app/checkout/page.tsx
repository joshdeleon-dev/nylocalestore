'use client';

import { useCartStore } from '@/hooks/useCart';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatCurrency, validatePhoneNumber } from '@/utils/helpers';
import Link from 'next/link';
import toast from 'react-hot-toast';
import CustomerNav from '@/components/CustomerNav';

export default function CheckoutPage() {
  const router = useRouter();
  const { items, subtotal, tax, total, clearCart } = useCartStore();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    customer_name: '',
    customer_phone: '',
    group_number: '',
    notes: '',
    payment_method: 'CASH' as const,
  });

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">No items in your cart</h1>
          <Link href="/" className="btn btn-primary mt-4">
            Back to Menu
          </Link>
        </div>
      </div>
    );
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // Validation
    if (!formData.customer_name.trim()) {
      toast.error('Please enter your name');
      return;
    }

    if (!formData.group_number) {
      toast.error('Please enter your group number');
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
          group_number: parseInt(formData.group_number),
          items: items.map(item => ({
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

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create order');
      }

      // Success
      toast.success('Order placed successfully!');
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
    <div className="min-h-screen bg-gray-50">
      <CustomerNav backHref="/cart" backLabel="Cart" />
      <div className="max-w-2xl mx-auto px-4 pt-6">
        <h1 className="text-2xl font-bold">Checkout</h1>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Order Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-xl font-bold mb-4">Customer Information</h2>

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
                  <label className="label">Group Number *</label>
                  <input
                    type="number"
                    name="group_number"
                    value={formData.group_number}
                    onChange={handleInputChange}
                    placeholder="e.g., 12"
                    min="1"
                    className="input"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    We'll call this number when your order is ready
                  </p>
                </div>

                <div>
                  <label className="label">Special Instructions</label>
                  <textarea
                    name="notes"
                    value={formData.notes}
                    onChange={handleInputChange}
                    placeholder="Any special requests..."
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
              className="btn btn-primary w-full justify-center"
            >
              {loading ? 'Placing Order...' : 'Place Order'}
            </button>
          </form>

          {/* Order Summary */}
          <div>
            <div className="bg-white rounded-lg shadow-sm p-6 sticky top-4">
              <h2 className="text-xl font-bold mb-4">Order Summary</h2>

              <div className="space-y-3 mb-4 pb-4 border-b border-gray-200">
                {items.map(item => (
                  <div key={item.id} className="flex justify-between text-sm">
                    <div>
                      <p className="font-medium">
                        {item.quantity}x {item.product_name}
                      </p>
                      {item.modifiers.length > 0 && (
                        <ul className="text-xs text-gray-600 mt-1 space-y-0.5">
                          {item.modifiers.map((mod, idx) => (
                            <li key={idx}>• {mod.name}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <span className="font-medium">
                      {formatCurrency(
                        (item.unit_price +
                          item.modifiers.reduce((sum, m) => sum + m.price_adjustment, 0)) *
                          item.quantity
                      )}
                    </span>
                  </div>
                ))}
              </div>

              <div className="space-y-2 mb-4">
                <div className="flex justify-between text-gray-700">
                  <span>Subtotal</span>
                  <span>{formatCurrency(subtotal)}</span>
                </div>
                <div className="flex justify-between text-gray-700">
                  <span>Tax</span>
                  <span>{formatCurrency(tax)}</span>
                </div>
                <div className="border-t border-gray-200 pt-2 flex justify-between text-lg font-bold">
                  <span>Total</span>
                  <span className="text-coffee-700">{formatCurrency(total)}</span>
                </div>
              </div>

              <p className="text-xs text-gray-500 text-center">
                You'll receive a confirmation with your order number
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
