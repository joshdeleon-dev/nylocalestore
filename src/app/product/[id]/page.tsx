'use client';

import { useEffect, useState } from 'react';
import { Product, ModifierGroup, Modifier } from '@/types';
import { useCartStore } from '@/hooks/useCart';
import { formatCurrency } from '@/utils/helpers';
import { Coffee, Plus, Minus, Check } from 'lucide-react';
import { useRouter, useParams } from 'next/navigation';
import CustomerNav from '@/components/CustomerNav';
import toast from 'react-hot-toast';

interface ProductWithModifiers extends Product {
  modifier_groups: ModifierGroup[];
}

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { addItem } = useCartStore();

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
        const groups: ModifierGroup[] = (data.modifier_groups || [])
          .map((pmg: any) => pmg.modifier_group)
          .filter(Boolean)
          .sort((a: ModifierGroup, b: ModifierGroup) => a.display_order - b.display_order);

        setProduct({ ...data, modifier_groups: groups });

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
        if (group.is_required && current.length === 1) return prev;
        return { ...prev, [group.id]: current.filter((id) => id !== modifierId) };
      }
      if (current.length >= maxSel) {
        if (maxSel === 1) return { ...prev, [group.id]: [modifierId] };
        return prev;
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
    for (let i = 0; i < quantity; i++) addItem(product, mods);
    toast.success(`${product.name} added to cart!`);
    setAdding(false);
    router.push('/');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-coffee-900">
        <Coffee className="w-8 h-8 text-coffee-400 animate-pulse" />
      </div>
    );
  }

  if (!product) return null;

  const soldOut = (product as any).current_stock === 0;

  return (
    <div className="min-h-screen bg-coffee-50">
      <CustomerNav backHref="/" backLabel="Menu" />

      <div className="max-w-2xl mx-auto pb-32">

        {/* Product image */}
        <div className="relative bg-coffee-100 overflow-hidden" style={{ height: '300px' }}>
          {product.image_url ? (
            <img
              src={product.image_url}
              alt={product.name}
              className={`w-full h-full object-cover ${soldOut ? 'opacity-50' : ''}`}
            />
          ) : (
            <div className="h-full flex items-center justify-center">
              <Coffee className={`w-16 h-16 text-coffee-300 ${soldOut ? 'opacity-50' : ''}`} />
            </div>
          )}
          {soldOut && (
            <div className="absolute inset-0 bg-coffee-900/60 flex items-center justify-center">
              <span className="bg-white text-coffee-900 text-xs font-semibold px-4 py-1.5 rounded-full uppercase tracking-widest">
                Sold Out
              </span>
            </div>
          )}
        </div>

        <div className="bg-white px-6 pt-6 pb-6 border-b border-coffee-100">
          <h1 className="text-2xl font-semibold text-coffee-900 leading-tight">{product.name}</h1>
          {product.description && (
            <p className="text-coffee-500 mt-1.5 text-sm leading-relaxed">{product.description}</p>
          )}
          <p className="text-xl font-semibold text-coffee-900 mt-3">
            {formatCurrency(product.base_price)}
          </p>
        </div>

        {/* Modifier groups */}
        {product.modifier_groups.map((group) => {
          const selected = selectedModifiers[group.id] || [];
          const maxSel = group.max_selection ?? 1;
          return (
            <div key={group.id} className="bg-white mt-2 px-6 py-5 border-b border-coffee-100">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <h3 className="font-medium text-coffee-900 text-sm">{group.name}</h3>
                  {group.is_required && (
                    <span className="text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full bg-coffee-900 text-white">
                      Required
                    </span>
                  )}
                </div>
                {maxSel > 1 && (
                  <span className="text-xs text-coffee-400">Pick up to {maxSel}</span>
                )}
              </div>
              <div className="space-y-2">
                {group.modifiers?.sort((a, b) => a.display_order - b.display_order).map((mod) => {
                  const isSelected = selected.includes(mod.id);
                  return (
                    <button
                      key={mod.id}
                      onClick={() => toggleModifier(group, mod.id)}
                      className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all text-left ${
                        isSelected
                          ? 'border-coffee-900 bg-coffee-50'
                          : 'border-coffee-100 hover:border-coffee-200 bg-white'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-4.5 h-4.5 w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                            isSelected ? 'border-coffee-900 bg-coffee-900' : 'border-coffee-300'
                          }`}
                        >
                          {isSelected && <Check className="w-2.5 h-2.5 text-white" />}
                        </div>
                        <span className={`text-sm font-medium ${isSelected ? 'text-coffee-900' : 'text-coffee-700'}`}>
                          {mod.name}
                        </span>
                      </div>
                      {mod.price_adjustment !== 0 && (
                        <span className="text-xs text-coffee-500">
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

        {/* Special instructions */}
        <div className="bg-white mt-2 px-6 py-5">
          <label className="label">Special Instructions</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Any special requests or modifications…"
            className="textarea"
            rows={2}
          />
        </div>
      </div>

      {/* Sticky add-to-cart bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-coffee-100 px-4 py-4 z-50">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          {soldOut ? (
            <div className="flex-1 bg-coffee-100 rounded-xl px-5 py-3 text-center">
              <p className="text-sm font-medium text-coffee-500">Currently sold out</p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 bg-coffee-50 border border-coffee-100 rounded-xl px-3 py-2.5">
                <button
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-coffee-100 transition-colors"
                >
                  <Minus className="w-3.5 h-3.5 text-coffee-700" />
                </button>
                <span className="font-semibold text-coffee-900 w-5 text-center text-sm">{quantity}</span>
                <button
                  onClick={() => setQuantity((q) => q + 1)}
                  className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-coffee-100 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5 text-coffee-700" />
                </button>
              </div>

              <button
                onClick={handleAddToCart}
                disabled={!canAddToCart() || adding}
                className="flex-1 flex items-center justify-between bg-coffee-900 hover:bg-coffee-800 disabled:opacity-50 text-white rounded-xl px-5 py-3 transition-colors"
              >
                <span className="text-sm font-medium">{adding ? 'Adding…' : 'Add to Order'}</span>
                <span className="text-sm font-semibold">{formatCurrency(calculatePrice())}</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
