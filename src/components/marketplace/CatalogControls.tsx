'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';

interface Props {
  base: string;
  categories: { name: string; slug: string; count: number }[];
}

// Search, category chips and sort for the public catalog — all kept in the URL
export function CatalogControls({ base, categories }: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get('q') ?? '');
  const category = params.get('category') ?? '';
  const sort = params.get('sort') ?? 'newest';

  const go = (changes: Record<string, string>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(changes)) {
      if (v && !(k === 'sort' && v === 'newest')) next.set(k, v); else next.delete(k);
    }
    next.delete('page');
    const qs = next.toString();
    router.push(`${base || '/'}${qs ? `?${qs}` : ''}`);
  };

  // Search as you type, after a short pause
  useEffect(() => {
    if (q === (params.get('q') ?? '')) return;
    const t = setTimeout(() => go({ q: q.trim() }), 350);
    return () => clearTimeout(t);
  }, [q]); // eslint-disable-line react-hooks/exhaustive-deps

  const chip = (active: boolean) =>
    `whitespace-nowrap rounded-full px-4 py-1.5 text-sm border transition-colors ${
      active ? 'bg-coffee-900 text-white border-coffee-900' : 'bg-white text-coffee-700 border-coffee-200 hover:bg-coffee-50'
    }`;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-coffee-400" />
          <input
            type="search"
            className="input pl-10 py-3 rounded-full"
            placeholder="Search furniture, books, toys…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Search the marketplace"
          />
        </div>
        <select className="select rounded-full py-3 sm:w-48" value={sort} onChange={(e) => go({ sort: e.target.value })} aria-label="Sort">
          <option value="newest">Newest first</option>
          <option value="price_asc">Price: low to high</option>
          <option value="price_desc">Price: high to low</option>
        </select>
      </div>
      {categories.length > 0 && (
        <div className="flex gap-2 overflow-x-auto scrollbar-none -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap">
          <button type="button" className={chip(!category)} onClick={() => go({ category: '' })}>All</button>
          {categories.map((c) => (
            <button key={c.slug} type="button" className={chip(category === c.slug)} onClick={() => go({ category: c.slug })}>
              {c.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
