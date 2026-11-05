'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';

interface Props {
  images: string[];
  index: number;
  title?: string;
  onIndexChange: (index: number) => void;
  onClose: () => void;
}

// Full-screen photo viewer: arrows, ←/→ keys, swipe, Esc or backdrop click to close.
// Shared by the public item page and the admin listing editor.
export function ImageLightbox({ images, index, title = 'Photo', onIndexChange, onClose }: Props) {
  const closeButton = useRef<HTMLButtonElement>(null);
  const touchStartX = useRef<number | null>(null);
  const [mounted, setMounted] = useState(false);
  const count = images.length;

  const step = useCallback((d: number) => onIndexChange((index + d + count) % count), [index, count, onIndexChange]);

  useEffect(() => {
    setMounted(true);
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButton.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus?.();
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose(); }
      else if (e.key === 'ArrowRight' && count > 1) step(1);
      else if (e.key === 'ArrowLeft' && count > 1) step(-1);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [step, onClose, count]);

  if (!mounted || count === 0) return null;

  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current == null || count < 2) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(dx) > 50) step(dx < 0 ? 1 : -1);
    touchStartX.current = null;
  };

  const arrow = 'absolute top-1/2 -translate-y-1/2 w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white';

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${title} — photo ${index + 1} of ${count}`}
      className="fixed inset-0 z-[100] bg-black/95 flex flex-col"
      onClick={onClose}
    >
      <div className="flex items-center justify-between px-4 sm:px-6 h-14 text-white/80 text-sm" onClick={(e) => e.stopPropagation()}>
        <span className="truncate pr-4">{title}</span>
        <div className="flex items-center gap-3">
          {count > 1 && <span className="tabular-nums">{index + 1} / {count}</span>}
          <button
            ref={closeButton}
            type="button"
            onClick={onClose}
            className="w-10 h-10 rounded-full hover:bg-white/10 flex items-center justify-center text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div
        className="relative flex-1 min-h-0 flex items-center justify-center px-2 sm:px-20"
        onTouchStart={(e) => { touchStartX.current = e.touches[0].clientX; }}
        onTouchEnd={onTouchEnd}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={images[index]}
          src={images[index]}
          alt={`${title} — photo ${index + 1} of ${count}`}
          className="max-w-full max-h-full object-contain select-none rounded-sm shadow-2xl"
          onClick={(e) => e.stopPropagation()}
          draggable={false}
        />
        {count > 1 && (
          <>
            <button type="button" onClick={(e) => { e.stopPropagation(); step(-1); }} className={`${arrow} left-2 sm:left-5`} aria-label="Previous photo">
              <ChevronLeft className="w-6 h-6" />
            </button>
            <button type="button" onClick={(e) => { e.stopPropagation(); step(1); }} className={`${arrow} right-2 sm:right-5`} aria-label="Next photo">
              <ChevronRight className="w-6 h-6" />
            </button>
          </>
        )}
      </div>

      {count > 1 && (
        <div className="flex justify-center gap-2 px-4 py-4 overflow-x-auto scrollbar-none" onClick={(e) => e.stopPropagation()}>
          {images.map((src, i) => (
            <button
              key={src}
              type="button"
              onClick={() => onIndexChange(i)}
              className={`w-14 h-14 flex-shrink-0 rounded-md overflow-hidden border-2 transition-opacity ${i === index ? 'border-white' : 'border-transparent opacity-50 hover:opacity-90'}`}
              aria-label={`Show photo ${i + 1}`}
              aria-current={i === index}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>,
    document.body
  );
}
