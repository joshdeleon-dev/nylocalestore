'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Category, Product, HeroSlide, Announcement } from '@/types';
import Link from 'next/link';
import { Coffee, Info, AlertTriangle, Tag, Calendar } from 'lucide-react';
import CustomerNav from '@/components/CustomerNav';
import HeroSlider from '@/components/HeroSlider';

const announcementIcons: Record<string, React.ElementType> = {
  info: Info,
  warning: AlertTriangle,
  promotion: Tag,
  event: Calendar,
};

export default function Home() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [heroSlides, setHeroSlides] = useState<HeroSlide[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [{ data: categoriesData }, prodsRes, { data: slidesData }, announcementsRes] = await Promise.all([
          supabase.from('categories').select('*').eq('is_active', true).order('display_order'),
          fetch('/api/products').then((r) => r.json()),
          supabase.from('hero_slides').select('*').eq('is_active', true).order('display_order'),
          fetch('/api/announcements').then((r) => r.json()),
        ]);
        setCategories(categoriesData || []);
        setProducts(prodsRes.data || []);
        setHeroSlides(slidesData || []);
        setAnnouncements(announcementsRes.data || []);
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const featuredProducts = products.filter((p) => p.is_featured);

  const filteredProducts = selectedCategory
    ? products.filter((p) => p.category_id === selectedCategory)
    : products.filter((p) => !p.is_featured);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-coffee-900">
        <div className="text-center">
          <Coffee className="w-8 h-8 mx-auto mb-3 text-coffee-400 animate-pulse" />
          <p className="text-xs text-coffee-500 tracking-widest uppercase">Loading menu…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-coffee-50">
      <CustomerNav wide />

      <div className="lg:grid lg:grid-cols-[380px_1fr]">

        {/* ── Left: brand territory (dark, sticky) ── */}
        <aside className="lg:sticky lg:top-14 lg:h-[calc(100vh-56px)] lg:overflow-y-auto bg-coffee-900 flex flex-col">

          {/* Brand tagline */}
          <div className="px-7 pt-8 pb-5 border-b border-white/10">
            <p className="font-serif italic text-white text-[1.35rem] leading-relaxed font-normal">
              Fresh coffee,<br />for the neighborhood.
            </p>
            <p className="text-coffee-500 text-xs mt-3 tracking-widest2 uppercase font-medium">
              New York · Order & Pickup
            </p>
          </div>

          {/* Hero Slider */}
          <div className="p-4">
            <div className="rounded-xl overflow-hidden">
              <HeroSlider slides={heroSlides} />
            </div>
          </div>

          {/* Announcements */}
          {announcements.length > 0 && (
            <div className="px-4 pb-4 space-y-2">
              {announcements.map((a) => {
                const Icon = announcementIcons[a.type] ?? announcementIcons.info;
                return (
                  <div key={a.id} className="flex gap-3 p-3 rounded-lg bg-white/[0.07] border border-white/[0.10]">
                    <Icon className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-coffee-400" />
                    <div>
                      <p className="text-white text-xs font-medium leading-snug">{a.title}</p>
                      {a.body && (
                        <p className="text-coffee-500 text-xs mt-0.5 leading-relaxed">{a.body}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Footer */}
          <div className="mt-auto px-7 py-5">
            <p className="text-coffee-700 text-xs">© NY Locale Store · New York</p>
          </div>
        </aside>

        {/* ── Right: menu ── */}
        <main className="bg-white min-h-screen" id="menu">

          {/* Category tabs — sticky below nav */}
          <div className="sticky top-14 z-10 bg-white border-b border-coffee-100">
            <div className="flex overflow-x-auto scrollbar-none px-6">
              <button
                onClick={() => setSelectedCategory(null)}
                className={`flex-shrink-0 px-1 mr-5 py-3.5 text-sm font-medium border-b-2 transition-colors ${
                  selectedCategory === null
                    ? 'border-coffee-900 text-coffee-900'
                    : 'border-transparent text-coffee-400 hover:text-coffee-700'
                }`}
              >
                All
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`flex-shrink-0 px-1 mr-5 py-3.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                    selectedCategory === cat.id
                      ? 'border-coffee-900 text-coffee-900'
                      : 'border-transparent text-coffee-400 hover:text-coffee-700'
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>

          <div className="p-6 lg:p-8">

            {/* Featured */}
            {featuredProducts.length > 0 && !selectedCategory && (
              <section className="mb-10">
                <p className="text-[10px] font-semibold uppercase tracking-widest2 text-coffee-400 mb-4">
                  Featured
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {featuredProducts.map((product) => {
                    const soldOut = product.current_stock === 0;
                    const El = soldOut ? 'div' : Link;
                    const props = soldOut ? {} : { href: `/product/${product.id}` };
                    return (
                      <El
                        key={product.id}
                        {...(props as any)}
                        className={`group block rounded-xl overflow-hidden border border-coffee-100 bg-white transition-all duration-300 ${
                          soldOut
                            ? 'opacity-60 cursor-default'
                            : 'hover:border-coffee-200 hover:shadow-[0_4px_20px_rgba(23,13,5,0.08)] cursor-pointer'
                        }`}
                      >
                        <div className="relative h-52 bg-coffee-50 overflow-hidden">
                          {product.image_url ? (
                            <img
                              src={product.image_url}
                              alt={product.name}
                              className={`w-full h-full object-cover transition-transform duration-700 ${!soldOut && 'group-hover:scale-105'}`}
                            />
                          ) : (
                            <div className="h-full flex items-center justify-center">
                              <Coffee className="w-10 h-10 text-coffee-200" />
                            </div>
                          )}
                          {soldOut ? (
                            <div className="absolute inset-0 bg-coffee-900/50 flex items-center justify-center">
                              <span className="bg-white text-coffee-900 text-xs font-semibold px-3 py-1 rounded-full uppercase tracking-wider">
                                Sold Out
                              </span>
                            </div>
                          ) : (
                            <span className="absolute top-3 left-3 bg-white/95 text-coffee-700 text-[10px] font-semibold px-2.5 py-1 rounded-full tracking-wide uppercase">
                              ✦ Featured
                            </span>
                          )}
                        </div>
                        <div className="p-4">
                          <h3 className="text-coffee-900 font-medium text-sm leading-snug">{product.name}</h3>
                          {product.description && (
                            <p className="text-coffee-500 text-xs mt-1 line-clamp-2 leading-relaxed">{product.description}</p>
                          )}
                          <div className="flex items-baseline justify-between mt-3">
                            <span className="text-coffee-900 font-semibold">${product.base_price.toFixed(2)}</span>
                            {!soldOut && <span className="text-coffee-400 text-xs">Customize →</span>}
                          </div>
                        </div>
                      </El>
                    );
                  })}
                </div>
              </section>
            )}

            {/* All / filtered products */}
            {(filteredProducts.length > 0 || selectedCategory) && (
              <section>
                {!selectedCategory && featuredProducts.length > 0 && (
                  <p className="text-[10px] font-semibold uppercase tracking-widest2 text-coffee-400 mb-4">
                    Menu
                  </p>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {filteredProducts.map((product) => {
                    const soldOut = product.current_stock === 0;
                    const El = soldOut ? 'div' : Link;
                    const props = soldOut ? {} : { href: `/product/${product.id}` };
                    return (
                      <El
                        key={product.id}
                        {...(props as any)}
                        className={`group block rounded-xl overflow-hidden border border-coffee-100 bg-white transition-all duration-300 ${
                          soldOut
                            ? 'opacity-60 cursor-default'
                            : 'hover:border-coffee-200 hover:shadow-[0_4px_20px_rgba(23,13,5,0.08)] cursor-pointer'
                        }`}
                      >
                        <div className="relative h-48 bg-coffee-50 overflow-hidden">
                          {product.image_url ? (
                            <img
                              src={product.image_url}
                              alt={product.name}
                              className={`w-full h-full object-cover transition-transform duration-700 ${!soldOut && 'group-hover:scale-105'}`}
                            />
                          ) : (
                            <div className="h-full flex items-center justify-center">
                              <Coffee className="w-10 h-10 text-coffee-200" />
                            </div>
                          )}
                          {soldOut && (
                            <div className="absolute inset-0 bg-coffee-900/50 flex items-center justify-center">
                              <span className="bg-white text-coffee-900 text-xs font-semibold px-3 py-1 rounded-full uppercase tracking-wider">
                                Sold Out
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="p-4">
                          <h3 className="text-coffee-900 font-medium text-sm leading-snug">{product.name}</h3>
                          {product.description && (
                            <p className="text-coffee-500 text-xs mt-1 line-clamp-2 leading-relaxed">{product.description}</p>
                          )}
                          <div className="flex items-baseline justify-between mt-3">
                            <span className="text-coffee-900 font-semibold">${product.base_price.toFixed(2)}</span>
                            {!soldOut && <span className="text-coffee-400 text-xs">Order →</span>}
                          </div>
                        </div>
                      </El>
                    );
                  })}
                </div>

                {filteredProducts.length === 0 && selectedCategory && (
                  <div className="text-center py-20">
                    <Coffee className="w-8 h-8 mx-auto mb-3 text-coffee-200" />
                    <p className="text-coffee-400 text-sm">Nothing in this category yet</p>
                  </div>
                )}
              </section>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
