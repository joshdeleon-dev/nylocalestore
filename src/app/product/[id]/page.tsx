'use client';

import { useEffect, useState } from 'react';
import { Product, ModifierGroup, Modifier } from '@/types';
import { useCartStore } from '@/hooks/useCart';
import { formatCurrency } from '@/utils/helpers';
import { Coffee, Plus, Minus, Check } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import CustomerNav from '@/components/CustomerNav';
import toast from 'react-hot-toast';

interface ProductWithModifiers extends Product {
  modifier_groups: ModifierGroup[];
}

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { addItem, items } = useCartStore();

  const [product, setProduct] = useState<ProductWithModifiers | null>(null);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [selectedModifiers, setSelectedModifiers] = useState<Record<number, number[]>>({});
  const [notes, setNotes] = useState('');
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const res = await fetch(`/api/products/${params.id}`);
        const json = await res.json();
        if (!res.ok || !json.data) throw new Error(json.error || 'Not found');

        const data = json.data;

        // Flatten nested modifier_groups
        const groups: ModifierGroup[] = (data.modifier_groups || [])
          .map((pmg: any) => pmg.modifier_group)
          .filter(Boolean)
          .sort((a: ModifierGroup, b: ModifierGroup) => a.display_order - b.display_order);

        setProduct({ ...data, modifier_groups: groups });

        // Pre-select first modifier in required groups
        const initial: Record<number, number[]> = {};
        groups.forEach((group) => {
          if (group.is_required && group.modifiers?.length) {
            initial[group.id] = [group.modifiers[0].id];
          }
        });
        setSelectedModifiers(initial);
      } catch (err) {
        console.error(err);
        toast.error('Product not found');
        router.push('/');
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
  }, [params.id, router]);

  const toggleModifier = (group: ModifierGroup, modifierId: number) => {
    setSelectedModifiers((prev) => {
      const current = prev[group.id] || [];
      const maxSel = group.max_selection ?? 1;

      if (current.includes(modifierId)) {
        if (group.is_required && current.length === 1) return prev; // keep at least one
        return { ...prev, [group.id]: current.filter((id) => id !== modifierId) };
      }

      if (current.length >= maxSel) {
        // Replace last selection for single-select groups
        if (maxSel === 1) return { ...prev, [group.id]: [modifierId] };
        return prev; // max reached
      }

      return { ...prev, [group.id]: [...current, modifierId] };
    });
  };

  const getSelectedModifierObjects = (): Modifier[] => {
    if (!product) return [];
    const result: Modifier[] = [];
    product.modifier_groups.forEach((group) => {
      const selected = selectedModifiers[group.id] || [];
      group.modifiers?.forEach((mod) => {
        if (selected.includes(mod.id)) result.push(mod);
      });
    });
    return result;
  };

  const calculatePrice = (): number => {
    if (!product) return 0;
    const mods = getSelectedModifierObjects();
    const modTotal = mods.reduce((sum, m) => sum + m.price_adjustment, 0);
    return (product.base_price + modTotal) * quantity;
  };

  const canAddToCart = (): boolean => {
    if (!product) return false;
    return product.modifier_groups.every((group) => {
      if (!group.is_required) return true;
      const selected = selectedModifiers[group.id] || [];
      return selected.length >= group.min_selection;
    });
  };

  const handleAddToCart = async () => {
    if (!product || !canAddToCart()) return;
    setAdding(true);

    const mods = getSelectedModifierObjects();
    for (let i = 0; i < quantity; i++) {
      addItem(product, mods);
    }

    toast.success(`${product.name} added to cart!`);
    setAdding(false);
    router.push('/');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Coffee className="w-12 h-12 animate-bounce text-coffee-700" />
      </div>
    );
  }

  if (!product) return null;

  const soldOut = (product as any).current_stock === 0;

  return (
    <div className="min-h-screen bg-white">
      <CustomerNav backHref="/" backLabel="Menu" />

      <div className="max-w-2xl mx-auto pb-32">
        {/* Product Image */}
        <div className="h-64 md:h-80 bg-gradient-to-br from-coffee-100 to-coffee-200 flex items-center justify-center relative">
          {product.image_url ? (
            <img
              src={product.image_url}
              alt={product.name}
              className={`h-full w-full object-contain ${soldOut ? 'opacity-50' : ''}`}
            />
          ) : (
            <Coffee className={`w-24 h-24 text-coffee-300 ${soldOut ? 'opacity-50' : ''}`} />
          )}
          {soldOut && (
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
              <span className="bg-white text-gray-900 text-sm font-bold px-5 py-2 rounded-full uppercase tracking-widest">Sold Out</span>
            </div>
          )}
        </div>

        <div className="px-4 pt-6 space-y-6">
          {/* Product Info */}
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{product.name}</h1>
            {product.description && (
              <p className="text-gray-600 mt-1">{product.description}</p>
            )}
            <p className="text-xl font-bold text-coffee-700 mt-2">
              {formatCurrency(product.base_price)}
            </p>
          </div>

          {/* Modifier Groups */}
          {product.modifier_groups.map((group) => {
            const selected = selectedModifiers[group.id] || [];
            const maxSel = group.max_selection ?? 1;
            return (
              <div key={group.id} className="border-t border-gray-100 pt-5">
                <div className="flex items-baseline justify-between mb-3">
                  <h3 className="font-semibold text-gray-900">
                    {group.name}
                    {group.is_required && (
                      <span className="ml-2 text-xs bg-coffee-700 text-white px-2 py-0.5 rounded-full">
                        Required
                      </span>
                    )}
                  </h3>
                  {maxSel > 1 && (
                    <span className="text-xs text-gray-500">Pick up to {maxSel}</span>
                  )}
                </div>
                <div className="space-y-2">
                  {group.modifiers?.sort((a, b) => a.display_order - b.display_order).map((mod) => {
                    const isSelected = selected.includes(mod.id);
                    return (
                      <button
                        key={mod.id}
                        onClick={() => toggleModifier(group, mod.id)}
                        className={`w-full flex items-center justify-between px-4 py-3 rounded-lg border-2 transition-all text-left ${
                          isSelected
                            ? 'border-coffee-700 bg-coffee-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                              isSelected
                                ? 'border-coffee-700 bg-coffee-700'
                                : 'border-gray-400'
                            }`}
                          >
                            {isSelected && <Check className="w-3 h-3 text-white" />}
                          </div>
                          <span className={`font-medium ${isSelected ? 'text-coffee-800' : 'text-gray-800'}`}>
                            {mod.name}
                          </span>
                        </div>
                        {mod.price_adjustment !== 0 && (
                          <span className="text-sm text-gray-600 font-medium">
                            {mod.price_adjustment > 0 ? '+' : ''}
                            {formatCurrency(mod.price_adjustment)}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Notes */}
          <div className="border-t border-gray-100 pt-5">
            <label className="label">Special Instructions (optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any special requests or modifications…"
              className="textarea"
              rows={2}
            />
          </div>
        </div>
      </div>

      {/* Sticky Bottom Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg px-4 py-4 z-50">
        <div className="max-w-2xl mx-auto flex items-center gap-4">
          {soldOut ? (
            <div className="flex-1 bg-gray-100 rounded-xl px-5 py-3 text-center">
              <p className="text-sm font-semibold text-gray-500">This item is currently sold out</p>
            </div>
          ) : (
            <>
              {/* Quantity */}
              <div className="flex items-center gap-3 bg-gray-100 rounded-xl px-3 py-2">
                <button
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-200"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span className="font-bold text-lg w-5 text-center">{quantity}</span>
                <button
                  onClick={() => setQuantity((q) => q + 1)}
                  className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-200"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              {/* Add to Cart */}
              <button
                onClick={handleAddToCart}
                disabled={!canAddToCart() || adding}
                className="flex-1 btn btn-primary justify-between"
              >
                <span>{adding ? 'Adding…' : 'Add to Order'}</span>
                <span className="font-bold">{formatCurrency(calculatePrice())}</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
