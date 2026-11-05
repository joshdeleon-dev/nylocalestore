'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Category, Product, HeroSlide, Announcement } from '@/types';
import { Coffee, Info, AlertTriangle, Tag, Calendar, Search } from 'lucide-react';
import CustomerNav from '@/components/CustomerNav';
import HeroSlider from '@/components/HeroSlider';
import { CustomerFooter } from '@/components/food/CustomerFooter';
import { FoodCard } from '@/components/food/FoodCard';

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
  const [orderingActive, setOrderingActive] = useState(true);
  const [search, setSearch] = useState('');

  const fetchData = async () => {
    try {
      const [{ data: categoriesData }, prodsRes, { data: slidesData }, announcementsRes, settingsRes] = await Promise.all([
        supabase.from('categories').select('*').eq('is_active', true).order('display_order'),
        fetch('/api/products').then((r) => r.json()),
        supabase.from('hero_slides').select('*').eq('is_active', true).order('display_order'),
        fetch('/api/announcements').then((r) => r.json()),
        fetch('/api/settings').then((r) => r.json()),
      ]);
      setCategories(categoriesData || []);
      setProducts(prodsRes.data || []);
      setHeroSlides(slidesData || []);
      setAnnouncements(announcementsRes.data || []);
      if (settingsRes.data) setOrderingActive(settingsRes.data.ordering_status ?? true);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') fetchData();
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  // Search matches name and description, across every category (featured included)
  const query = search.trim().toLowerCase();
  const matches = (p: Product) => !query || `${p.name} ${p.description ?? ''}`.toLowerCase().includes(query);
  const featuredProducts = products.filter((p) => p.is_featured);
  const browsing = !query && selectedCategory === null;
  const results = products.filter((p) => matches(p) && (selectedCategory === null || p.category_id === selectedCategory));
  // When browsing everything, non-featured items are grouped under their category
  const sections = categories
    .map((cat) => ({ cat, items: products.filter((p) => p.category_id === cat.id && !p.is_featured) }))
    .filter((s) => s.items.length > 0);
  const uncategorized = products.filter((p) => !p.is_featured && !categories.some((c) => c.id === p.category_id));

  const grid = 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-5';
  const chip = (active: boolean) =>
    `whitespace-nowrap rounded-full px-4 py-1.5 text-sm border transition-colors ${
      active ? 'bg-coffee-900 text-white border-coffee-900' : 'bg-white text-coffee-700 border-coffee-200 hover:bg-coffee-50'
    }`;

  return (
    <div className="min-h-screen flex flex-col">
      <CustomerNav paused={!orderingActive} />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-5 py-8 sm:py-12">
        <div className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-widest2 text-coffee-500 mb-2">New York · Order &amp; Pickup</p>
          <h1 className="font-serif text-4xl sm:text-5xl font-medium text-coffee-900 leading-tight">
            Made with love, <span className="italic">served with care</span>
          </h1>
          <p className="mt-3 text-coffee-600 max-w-xl">Order ahead and pick up your coffee and food at the Locale.</p>
        </div>

        {announcements.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2 mb-8">
            {announcements.map((a) => {
              const Icon = announcementIcons[a.type] ?? announcementIcons.info;
              return (
                <div key={a.id} className="flex gap-3 rounded-2xl border border-coffee-200 bg-white p-4">
                  <span className="w-8 h-8 rounded-full bg-coffee-100 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-4 h-4 text-coffee-700" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-coffee-900 leading-snug">{a.title}</p>
                    {a.body && <p className="text-sm text-coffee-600 mt-0.5 leading-relaxed">{a.body}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {heroSlides.length > 0 && (
          <div className="mb-10 rounded-3xl overflow-hidden">
            <HeroSlider slides={heroSlides} />
          </div>
        )}

        <div id="menu" className="scroll-mt-24 space-y-4">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-coffee-400" />
            <input
              type="search"
              className="input pl-10 py-3 rounded-full"
              placeholder="Search the menu…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search the menu"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto scrollbar-none -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap">
            <button type="button" className={chip(selectedCategory === null)} onClick={() => setSelectedCategory(null)}>All</button>
            {categories.map((cat) => (
              <button key={cat.id} type="button" className={chip(selectedCategory === cat.id)} onClick={() => setSelectedCategory(cat.id)}>
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className={`mt-8 ${grid}`} aria-busy="true" aria-label="Loading menu">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="rounded-2xl bg-white border border-coffee-100 overflow-hidden">
                <div className="aspect-square bg-coffee-100 animate-pulse" />
                <div className="p-4 space-y-2"><div className="h-4 w-16 bg-coffee-100 rounded animate-pulse" /><div className="h-3 w-28 bg-coffee-100 rounded animate-pulse" /></div>
              </div>
            ))}
          </div>
        ) : browsing ? (
          <div className="mt-8 space-y-12">
            {featuredProducts.length > 0 && (
              <section>
                <h2 className="font-serif text-2xl text-coffee-900 mb-4">Featured</h2>
                <div className={grid}>
                  {featuredProducts.map((p) => <FoodCard key={p.id} product={p} orderingActive={orderingActive} featured />)}
                </div>
              </section>
            )}
            {sections.map(({ cat, items }) => (
              <section key={cat.id}>
                <h2 className="font-serif text-2xl text-coffee-900 mb-4">{cat.name}</h2>
                <div className={grid}>
                  {items.map((p) => <FoodCard key={p.id} product={p} orderingActive={orderingActive} />)}
                </div>
              </section>
            ))}
            {uncategorized.length > 0 && (
              <section>
                <h2 className="font-serif text-2xl text-coffee-900 mb-4">More</h2>
                <div className={grid}>
                  {uncategorized.map((p) => <FoodCard key={p.id} product={p} orderingActive={orderingActive} />)}
                </div>
              </section>
            )}
            {products.length === 0 && (
              <div className="text-center py-20">
                <Coffee className="w-8 h-8 mx-auto mb-3 text-coffee-300" />
                <p className="text-coffee-500 text-sm">The menu is empty right now — check back soon.</p>
              </div>
            )}
          </div>
        ) : (
          <section className="mt-6">
            <p className="text-sm text-coffee-500 mb-4">{results.length} item{results.length === 1 ? '' : 's'}</p>
            {results.length > 0 ? (
              <div className={grid}>
                {results.map((p) => <FoodCard key={p.id} product={p} orderingActive={orderingActive} featured={p.is_featured} />)}
              </div>
            ) : (
              <div className="text-center py-20">
                <Coffee className="w-8 h-8 mx-auto mb-3 text-coffee-300" />
                <p className="text-coffee-500 text-sm">{query ? 'Nothing on the menu matches your search.' : 'Nothing in this category yet.'}</p>
              </div>
            )}
          </section>
        )}
      </main>

      <CustomerFooter />
    </div>
  );
}
