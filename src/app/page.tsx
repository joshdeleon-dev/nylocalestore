'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Category, Product, HeroSlide, Announcement } from '@/types';
import Link from 'next/link';
import { Coffee, Star, Info, AlertTriangle, Tag, Calendar } from 'lucide-react';
import CustomerNav from '@/components/CustomerNav';
import HeroSlider from '@/components/HeroSlider';

const announcementStyles: Record<string, { bg: string; border: string; text: string; icon: React.ElementType }> = {
  info:      { bg: 'bg-blue-50',   border: 'border-blue-200',  text: 'text-blue-800',  icon: Info },
  warning:   { bg: 'bg-amber-50',  border: 'border-amber-200', text: 'text-amber-800', icon: AlertTriangle },
  promotion: { bg: 'bg-green-50',  border: 'border-green-200', text: 'text-green-800', icon: Tag },
  event:     { bg: 'bg-purple-50', border: 'border-purple-200',text: 'text-purple-800',icon: Calendar },
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

        // default to "All" — no category pre-selected
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
    : products;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <Coffee className="w-10 h-10 mx-auto mb-3 animate-bounce text-coffee-700" />
          <p className="text-sm text-gray-500">Loading menu…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <CustomerNav wide />

      <div className="grid grid-cols-1 lg:grid-cols-3 min-h-[calc(100vh-64px)]">

        {/* ── Left panel 1/3 ── */}
        <div className="lg:col-span-1 bg-gray-50 border-b lg:border-b-0 lg:border-r border-gray-200 flex flex-col gap-0">

          {/* Announcements */}
          {announcements.length > 0 && (
            <div className="p-4 space-y-2.5 border-b border-gray-200">
              {announcements.map((a) => {
                const style = announcementStyles[a.type] ?? announcementStyles.info;
                const Icon = style.icon;
                return (
                  <div key={a.id} className={`flex gap-3 p-3 rounded-xl border ${style.bg} ${style.border}`}>
                    <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${style.text}`} />
                    <div>
                      <p className={`text-sm font-semibold leading-snug ${style.text}`}>{a.title}</p>
                      {a.body && <p className={`text-xs mt-0.5 leading-relaxed opacity-80 ${style.text}`}>{a.body}</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Hero Slider — padded to match announcement area */}
          <div className="p-4">
            <div className="rounded-2xl overflow-hidden shadow-sm">
              <HeroSlider slides={heroSlides} />
            </div>
          </div>
        </div>

        {/* ── Right panel 2/3 ── */}
        <div className="lg:col-span-2 p-6 lg:p-8" id="menu">

          {/* Featured Products */}
          {featuredProducts.length > 0 && (
            <section className="mb-8">
              <div className="flex items-center gap-2 mb-5">
                <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-widest">Featured</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {featuredProducts.map((product) => {
                  const soldOut = product.current_stock === 0;
                  const CardEl = soldOut ? 'div' : Link;
                  const cardProps = soldOut ? {} : { href: `/product/${product.id}` };
                  return (
                    <CardEl
                      key={product.id}
                      {...(cardProps as any)}
                      className={`group rounded-2xl overflow-hidden border border-amber-200 bg-white transition-all duration-200 ${soldOut ? 'opacity-70 cursor-not-allowed' : 'hover:shadow-md'}`}
                    >
                      <div className="h-44 bg-coffee-50 flex items-center justify-center overflow-hidden relative">
                        {product.image_url ? (
                          <img src={product.image_url} alt={product.name} className={`h-full w-full object-cover transition-transform duration-300 ${!soldOut && 'group-hover:scale-105'}`} />
                        ) : (
                          <Coffee className="w-12 h-12 text-coffee-200" />
                        )}
                        {soldOut ? (
                          <span className="absolute inset-0 bg-black/40 flex items-center justify-center">
                            <span className="bg-white text-gray-900 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide">Sold Out</span>
                          </span>
                        ) : (
                          <span className="absolute top-3 right-3 bg-amber-400 text-amber-900 text-xs font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                            <Star className="w-2.5 h-2.5 fill-amber-900" /> Featured
                          </span>
                        )}
                      </div>
                      <div className="p-4">
                        <h3 className={`font-semibold mb-1 ${soldOut ? 'text-gray-400' : 'text-gray-900'}`}>{product.name}</h3>
                        <p className="text-gray-500 text-sm mb-4 line-clamp-2 leading-relaxed">{product.description}</p>
                        <div className="flex items-center justify-between">
                          <span className={`text-lg font-bold ${soldOut ? 'text-gray-400' : 'text-coffee-700'}`}>${product.base_price.toFixed(2)}</span>
                          {soldOut ? (
                            <span className="text-xs font-medium text-gray-400 bg-gray-100 px-3 py-1 rounded-full">Unavailable</span>
                          ) : (
                            <span className="text-xs font-medium text-coffee-600 bg-coffee-50 px-3 py-1 rounded-full">Customize →</span>
                          )}
                        </div>
                      </div>
                    </CardEl>
                  );
                })}
              </div>
            </section>
          )}

          {/* Divider */}
          {featuredProducts.length > 0 && <hr className="border-gray-200 mb-8" />}

          {/* Category filter */}
          <section className="mb-6">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-widest mb-4">Browse Menu</h2>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setSelectedCategory(null)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-150 ${
                  selectedCategory === null
                    ? 'bg-coffee-700 text-white shadow-sm'
                    : 'bg-white border border-gray-200 text-gray-600 hover:border-coffee-300 hover:text-coffee-700'
                }`}
              >
                All
              </button>
              {categories.map((category) => (
                <button
                  key={category.id}
                  onClick={() => setSelectedCategory(category.id)}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-150 ${
                    selectedCategory === category.id
                      ? 'bg-coffee-700 text-white shadow-sm'
                      : 'bg-white border border-gray-200 text-gray-600 hover:border-coffee-300 hover:text-coffee-700'
                  }`}
                >
                  {category.name}
                </button>
              ))}
            </div>
          </section>

          {/* Products Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {filteredProducts.map((product) => {
              const soldOut = product.current_stock === 0;
              const CardEl = soldOut ? 'div' : Link;
              const cardProps = soldOut ? {} : { href: `/product/${product.id}` };
              return (
                <CardEl
                  key={product.id}
                  {...(cardProps as any)}
                  className={`group rounded-2xl overflow-hidden border bg-white transition-all duration-200 ${soldOut ? 'border-gray-100 opacity-70 cursor-not-allowed' : 'border-gray-100 hover:shadow-md hover:border-gray-200'}`}
                >
                  <div className="h-44 bg-gray-50 flex items-center justify-center overflow-hidden relative">
                    {product.image_url ? (
                      <img src={product.image_url} alt={product.name} className={`h-full w-full object-cover transition-transform duration-300 ${!soldOut && 'group-hover:scale-105'}`} />
                    ) : (
                      <Coffee className="w-12 h-12 text-gray-200" />
                    )}
                    {soldOut && (
                      <span className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        <span className="bg-white text-gray-900 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide">Sold Out</span>
                      </span>
                    )}
                  </div>
                  <div className="p-4">
                    <h3 className={`font-semibold mb-1 ${soldOut ? 'text-gray-400' : 'text-gray-900'}`}>{product.name}</h3>
                    <p className="text-gray-500 text-sm mb-4 line-clamp-2 leading-relaxed">{product.description}</p>
                    <div className="flex items-center justify-between">
                      <span className={`text-lg font-bold ${soldOut ? 'text-gray-400' : 'text-coffee-700'}`}>${product.base_price.toFixed(2)}</span>
                      {soldOut ? (
                        <span className="text-xs font-medium text-gray-400 bg-gray-100 px-3 py-1 rounded-full">Unavailable</span>
                      ) : (
                        <span className="text-xs font-medium text-coffee-600 bg-coffee-50 px-3 py-1 rounded-full">Customize →</span>
                      )}
                    </div>
                  </div>
                </CardEl>
              );
            })}
          </div>

          {filteredProducts.length === 0 && (
            <div className="text-center py-16">
              <Coffee className="w-10 h-10 mx-auto mb-3 text-gray-200" />
              <p className="text-gray-400 text-sm">No products in this category</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
