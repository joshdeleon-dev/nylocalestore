'use client';

import Image from 'next/image';
import { useState } from 'react';
import { ChevronLeft, ChevronRight, ImageOff } from 'lucide-react';

export function PhotoGallery({ images, title, reserved }: { images: string[]; title: string; reserved: boolean }) {
  const [index, setIndex] = useState(0);

  if (images.length === 0) {
    return (
      <div className="aspect-square rounded-2xl bg-coffee-100 flex items-center justify-center text-coffee-300">
        <ImageOff className="w-10 h-10" />
      </div>
    );
  }

  const step = (d: number) => setIndex((i) => (i + d + images.length) % images.length);

  return (
    <div className="space-y-3">
      <div className="relative aspect-square rounded-2xl overflow-hidden bg-coffee-100">
        <Image
          src={images[index]}
          alt={`${title} — photo ${index + 1} of ${images.length}`}
          fill
          priority
          sizes="(min-width: 1024px) 50vw, 100vw"
          className={`object-cover ${reserved ? 'grayscale opacity-60' : ''}`}
        />
        {reserved && (
          <span className="absolute top-4 left-4 rounded-full bg-coffee-900 text-white text-xs font-semibold uppercase tracking-wider px-3.5 py-1.5">
            Reserved
          </span>
        )}
        {images.length > 1 && (
          <>
            <button type="button" onClick={() => step(-1)} className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 text-coffee-900 flex items-center justify-center shadow hover:bg-white" aria-label="Previous photo">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button type="button" onClick={() => step(1)} className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 text-coffee-900 flex items-center justify-center shadow hover:bg-white" aria-label="Next photo">
              <ChevronRight className="w-5 h-5" />
            </button>
            <span className="absolute bottom-3 right-3 rounded-full bg-black/60 text-white text-xs px-2.5 py-1">{index + 1} / {images.length}</span>
          </>
        )}
      </div>
      {images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto scrollbar-none">
          {images.map((src, i) => (
            <button
              key={src}
              type="button"
              onClick={() => setIndex(i)}
              className={`relative w-16 h-16 sm:w-20 sm:h-20 flex-shrink-0 rounded-lg overflow-hidden border-2 ${i === index ? 'border-coffee-900' : 'border-transparent opacity-70 hover:opacity-100'}`}
              aria-label={`Show photo ${i + 1}`}
            >
              <Image src={src} alt="" fill sizes="80px" className="object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
