'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Coffee } from 'lucide-react';
import { HeroSlide } from '@/types';

interface HeroSliderProps {
  slides: HeroSlide[];
  autoPlayMs?: number;
}

export default function HeroSlider({ slides, autoPlayMs = 5000 }: HeroSliderProps) {
  const active = slides.filter((s) => s.is_active);
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);

  const next = useCallback(() => setIdx((i) => (i + 1) % active.length), [active.length]);
  const prev = useCallback(() => setIdx((i) => (i - 1 + active.length) % active.length), [active.length]);

  useEffect(() => {
    if (paused || active.length <= 1) return;
    const t = setInterval(next, autoPlayMs);
    return () => clearInterval(t);
  }, [paused, active.length, next, autoPlayMs]);

  if (active.length === 0) {
    return (
      <div className="bg-gradient-to-br from-coffee-800 to-coffee-700 flex items-center justify-center py-16 px-6">
        <div className="text-center text-white">
          <Coffee className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <h1 className="text-2xl font-bold mb-2">NY Locale Store</h1>
          <p className="text-sm text-white/70 mb-5">Fresh coffee, crafted for you.</p>
          <Link
            href="/#menu"
            className="inline-block bg-white text-coffee-700 font-semibold text-sm px-6 py-2.5 rounded-full hover:bg-white/90 transition-colors"
          >
            Order Now
          </Link>
        </div>
      </div>
    );
  }

  const slide = active[idx];

  return (
    <div
      className="relative overflow-hidden select-none grid"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {active.map((s, i) => (
        <div
          key={s.id}
          style={{ gridArea: '1 / 1' }}
          className={`relative transition-opacity duration-700 ${i === idx ? 'opacity-100 z-10' : 'opacity-0 z-0'}`}
        >
          <img
            src={s.image_url}
            alt={s.title || 'Hero slide'}
            className="w-full h-auto block"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/30 to-transparent" />
        </div>
      ))}

      {/* Content overlay */}
      <div className="absolute inset-0 z-20 flex items-center px-8 md:px-16 max-w-6xl mx-auto" style={{ gridArea: '1 / 1' }}>
        <div className="text-white max-w-xl">
          {slide.title && (
            <h1 className="text-3xl md:text-5xl font-bold mb-3 drop-shadow-md">{slide.title}</h1>
          )}
          {slide.subtitle && (
            <p className="text-base md:text-xl text-white/90 mb-6 drop-shadow">{slide.subtitle}</p>
          )}
          <Link
            href={slide.cta_href || '/#menu'}
            className="inline-block bg-white text-coffee-700 font-bold px-8 py-3 rounded-full hover:bg-white/90 transition-colors shadow-lg"
          >
            {slide.cta_text || 'Order Now'}
          </Link>
        </div>
      </div>

      {/* Prev / Next */}
      {active.length > 1 && (
        <>
          <button
            onClick={prev}
            className="absolute left-3 top-1/2 -translate-y-1/2 z-30 w-10 h-10 bg-black/30 hover:bg-black/50 rounded-full flex items-center justify-center text-white transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={next}
            className="absolute right-3 top-1/2 -translate-y-1/2 z-30 w-10 h-10 bg-black/30 hover:bg-black/50 rounded-full flex items-center justify-center text-white transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </button>

          {/* Dots */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 flex gap-2">
            {active.map((_, i) => (
              <button
                key={i}
                onClick={() => setIdx(i)}
                className={`w-2 h-2 rounded-full transition-all ${i === idx ? 'bg-white w-5' : 'bg-white/50'}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
