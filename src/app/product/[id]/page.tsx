'use client';

import { useEffect, useState } from 'react';
import { Product, ModifierGroup, Modifier } from '@/types';
import { useCartStore } from '@/hooks/useCart';
import { formatCurrency } from '@/utils/helpers';
import { Coffee, Plus, Minus, Check, Expand } from 'lucide-react';
import { useRouter, useParams } from 'next/navigation';
import CustomerNav from '@/components/CustomerNav';
import { BackLink } from '@/components/food/BackLink';
import { CustomerFooter } from '@/components/food/CustomerFooter';
import { ImageLightbox } from '@/components/marketplace/ImageLightbox';
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
  const [orderingActive, setOrderingActive] = useState(true);
  const [zoomed, setZoomed] = useState(false);

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const [res, settingsRes] = await Promise.all([
          fetch(`/api/products/${params.id}`),
          fetch('/api/settings'),
        ]);
        const json = await res.json();
        const settingsJson = await settingsRes.json();
        if (settingsJson.data) setOrderingActive(settingsJson.data.ordering_status ?? true);
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
    try {
      // Re-fetch stock to catch changes since page load
      const freshRes = await fetch(`/api/products/${params.id}`);
      const freshJson = await freshRes.json();
      const freshStock: number | null = freshJson.data?.current_stock ?? null;
      if (freshStock === null || freshStock < quantity) {
        setProduct((p) => p ? { ...p, current_stock: freshStock } as any : p);
        toast.error(freshStock === 0 || freshStock === null
          ? 'Sorry, this item just sold out.'
          : `Only ${freshStock} available — please reduce your quantity.`);
        return;
      }
      const mods = getSelectedModifierObjects();
      for (let i = 0; i < quantity; i++) addItem(product, mods, freshStock);
      toast.success(`${product.name} added to cart!`);
      router.push('/');
    } finally {
      setAdding(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <CustomerNav />
        <div className="flex-1 flex items-center justify-center" aria-busy="true">
          <Coffee className="w-8 h-8 text-coffee-300 animate-pulse" />
        </div>
      </div>
    );
  }

  if (!product) return null;

  const soldOut = (product as any).current_stock === null || (product as any).current_stock === 0;
  const unavailable = soldOut || !orderingActive;

  return (
    <div className="min-h-screen flex flex-col">
      <CustomerNav paused={!orderingActive} />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-5 py-6 sm:py-10 pb-32 lg:pb-10">
        <div className="mb-5"><BackLink href="/#menu" label="Menu" /></div>

        <div className="grid lg:grid-cols-2 gap-8 lg:gap-12">
          {/* Photo */}
          <div className="relative aspect-square rounded-2xl overflow-hidden bg-coffee-100 lg:sticky lg:top-24 self-start w-full">
            {product.image_url ? (
              <button type="button" onClick={() => setZoomed(true)} className="group absolute inset-0 cursor-zoom-in focus:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-coffee-300" aria-label="Enlarge photo">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={product.image_url} alt={product.name} className={`w-full h-full object-cover ${soldOut ? 'grayscale opacity-60' : ''}`} />
                <span className="absolute top-3 right-3 w-9 h-9 rounded-full bg-white/90 text-coffee-900 flex items-center justify-center shadow opacity-80 group-hover:opacity-100 transition-opacity">
                  <Expand className="w-4 h-4" />
                </span>
              </button>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <Coffee className="w-16 h-16 text-coffee-300" />
              </div>
            )}
            {soldOut && (
              <span className="absolute top-4 left-4 rounded-full bg-coffee-900 text-white text-xs font-semibold uppercase tracking-wider px-3.5 py-1.5">
                Sold out
              </span>
            )}
          </div>
          {zoomed && product.image_url && (
            <ImageLightbox images={[product.image_url]} index={0} title={product.name} onIndexChange={() => {}} onClose={() => setZoomed(false)} />
          )}

          {/* Details */}
          <div>
            <h1 className="font-serif text-3xl sm:text-4xl font-medium text-coffee-900 leading-tight">{product.name}</h1>
            <p className="text-2xl font-semibold text-coffee-900 mt-3">{formatCurrency(product.base_price)}</p>
            {product.description && <p className="text-coffee-700 mt-4 leading-relaxed">{product.description}</p>}

            {/* Modifier groups */}
            <div className="mt-8 space-y-6">
              {product.modifier_groups.map((group) => {
                const selected = selectedModifiers[group.id] || [];
                const maxSel = group.max_selection ?? 1;
                return (
                  <fieldset key={group.id}>
                    <div className="flex items-center justify-between mb-3">
                      <legend className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-coffee-900">{group.name}</span>
                        {group.is_required && (
                          <span className="text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full bg-coffee-900 text-white">Required</span>
                        )}
                      </legend>
                      {maxSel > 1 && <span className="text-xs text-coffee-500">Pick up to {maxSel}</span>}
                    </div>
                    <div className="grid sm:grid-cols-2 gap-2">
                      {group.modifiers?.sort((a, b) => a.display_order - b.display_order).map((mod) => {
                        const isSelected = selected.includes(mod.id);
                        return (
                          <button
                            key={mod.id}
                            type="button"
                            onClick={() => toggleModifier(group, mod.id)}
                            aria-pressed={isSelected}
                            className={`flex items-center justify-between gap-3 px-4 py-3 rounded-xl border text-left transition-colors ${
                              isSelected ? 'border-coffee-900 bg-coffee-50' : 'border-coffee-200 bg-white hover:bg-coffee-50/60'
                            }`}
                          >
                            <span className="flex items-center gap-3 min-w-0">
                              <span className={`w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center flex-shrink-0 ${isSelected ? 'border-coffee-900 bg-coffee-900' : 'border-coffee-300'}`}>
                                {isSelected && <Check className="w-2.5 h-2.5 text-white" />}
                              </span>
                              <span className={`text-sm font-medium ${isSelected ? 'text-coffee-900' : 'text-coffee-700'}`}>{mod.name}</span>
                            </span>
                            {mod.price_adjustment !== 0 && (
                              <span className="text-xs text-coffee-500 flex-shrink-0">
                                {mod.price_adjustment > 0 ? '+' : ''}
                                {formatCurrency(mod.price_adjustment)}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </fieldset>
                );
              })}

              <div>
                <label className="label" htmlFor="special-instructions">Special instructions</label>
                <textarea
                  id="special-instructions"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any special requests or modifications…"
                  className="textarea rounded-xl"
                  rows={2}
                />
              </div>
            </div>

            {/* Add to order: pinned to the bottom on phones, inline on desktop */}
            <div className="fixed bottom-0 inset-x-0 z-30 bg-white/95 backdrop-blur border-t border-coffee-200 px-4 py-3 lg:static lg:bg-transparent lg:border-0 lg:p-0 lg:mt-8">
              <div className="max-w-6xl mx-auto flex items-center gap-3">
                {unavailable ? (
                  <div className="flex-1 rounded-full bg-coffee-100 px-5 py-3.5 text-center">
                    <p className="text-sm font-medium text-coffee-600">{soldOut ? 'Currently sold out' : 'Ordering is currently paused'}</p>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-3 rounded-full border border-coffee-200 bg-white px-3 py-2.5">
                      <button type="button" onClick={() => setQuantity((q) => Math.max(1, q - 1))} className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-coffee-100" aria-label="Decrease quantity">
                        <Minus className="w-3.5 h-3.5 text-coffee-700" />
                      </button>
                      <span className="font-semibold text-coffee-900 w-5 text-center text-sm" aria-live="polite">{quantity}</span>
                      <button type="button" onClick={() => setQuantity((q) => q + 1)} className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-coffee-100" aria-label="Increase quantity">
                        <Plus className="w-3.5 h-3.5 text-coffee-700" />
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={handleAddToCart}
                      disabled={!canAddToCart() || adding}
                      className="flex-1 flex items-center justify-between rounded-full bg-coffee-900 hover:bg-coffee-700 disabled:opacity-50 text-white px-6 py-3.5 transition-colors"
                    >
                      <span className="text-sm font-medium">{adding ? 'Adding…' : 'Add to order'}</span>
                      <span className="text-sm font-semibold">{formatCurrency(calculatePrice())}</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      <CustomerFooter />
    </div>
  );
}
