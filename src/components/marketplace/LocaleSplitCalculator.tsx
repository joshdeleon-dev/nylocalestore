'use client';

import { useState } from 'react';
import { QUICK_PICK_PERCENTS, calcLocaleSplit, formatCents } from '@/lib/marketplace';

interface Props {
  priceCents: number | null;
  percent: number;
  onChange: (value: { priceCents: number | null; percent: number }) => void;
  priceLabel?: string;
  receiveLabel?: string;
  allowCustom?: boolean; // sellers only get the quick picks; admins can enter any percentage
  percentRequired?: boolean; // sellers must pick an option, so it can't be cleared back to 0%
}

const toDollars = (cents: number | null) => (cents == null ? '' : (cents / 100).toFixed(2));

// Price + voluntary "For Locale" donation, with a live breakdown.
// Shared by the admin listing editor and (Phase 2) the public seller form.
// Initial values are read once; give it a `key` to reset it for a different listing.
export function LocaleSplitCalculator({ priceCents, percent, onChange, priceLabel = 'Asking price', receiveLabel = 'Seller receives', allowCustom = true, percentRequired = false }: Props) {
  const [priceText, setPriceText] = useState(toDollars(priceCents));
  // 0% (no donation) shows nothing selected; any other non-quick-pick value shows Custom
  const [custom, setCustom] = useState(percent !== 0 && !QUICK_PICK_PERCENTS.includes(percent));
  const [percentText, setPercentText] = useState(String(percent));

  const setPrice = (text: string) => {
    setPriceText(text);
    const n = Number(text.replace(/[$,\s]/g, ''));
    onChange({ priceCents: text.trim() === '' || !Number.isFinite(n) || n < 0 ? null : Math.round(n * 100), percent });
  };

  const setPercent = (text: string) => {
    setPercentText(text);
    const n = Number(text);
    if (Number.isFinite(n) && n >= 0 && n <= 100) onChange({ priceCents, percent: Math.round(n * 100) / 100 });
  };

  // Tapping the selected quick pick again clears it back to no donation
  const pick = (p: number) => {
    const next = !custom && percent === p && !percentRequired ? 0 : p;
    setCustom(false);
    setPercentText(String(next));
    onChange({ priceCents, percent: next });
  };

  const { localeCents, payoutCents } = calcLocaleSplit(priceCents ?? 0, percent);

  return (
    <div className="space-y-4">
      <div>
        <label className="label">{priceLabel} *</label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-coffee-400 text-sm">$</span>
          <input
            type="text"
            inputMode="decimal"
            className="input pl-7"
            placeholder="0.00"
            value={priceText}
            onChange={(e) => setPrice(e.target.value)}
            onBlur={() => priceCents != null && setPriceText(toDollars(priceCents))}
          />
        </div>
      </div>

      <div>
        <label className="label">{percentRequired ? 'Donate to the locale *' : 'Donate to the locale (optional)'}</label>
        <div className="flex flex-wrap gap-2">
          {QUICK_PICK_PERCENTS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => pick(p)}
              aria-pressed={!custom && percent === p}
              className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                !custom && percent === p
                  ? 'bg-coffee-900 text-white border-coffee-900'
                  : 'bg-white text-coffee-700 border-coffee-200 hover:bg-coffee-50'
              }`}
            >
              {p}%
            </button>
          ))}
          {allowCustom && (
            <button
              type="button"
              onClick={() => setCustom(true)}
              aria-pressed={custom}
              className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                custom ? 'bg-coffee-900 text-white border-coffee-900' : 'bg-white text-coffee-700 border-coffee-200 hover:bg-coffee-50'
              }`}
            >
              Custom
            </button>
          )}
          {custom && (
            <div className="relative w-28">
              <input
                type="number"
                min={0}
                max={100}
                step="0.01"
                className="input pr-7"
                value={percentText}
                onChange={(e) => setPercent(e.target.value)}
                autoFocus
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-coffee-400 text-sm">%</span>
            </div>
          )}
        </div>
      </div>

      <div className="rounded-xl bg-coffee-50 border border-coffee-100 p-4 text-sm">
        <div className="flex justify-between py-1">
          <span className="text-coffee-600">{priceLabel}</span>
          <span className="font-medium text-coffee-900">{formatCents(priceCents ?? 0)}</span>
        </div>
        <div className="flex justify-between py-1">
          <span className="text-coffee-600">For Locale ({percent}%)</span>
          <span className="font-medium text-coffee-900">− {formatCents(localeCents)}</span>
        </div>
        <div className="flex justify-between pt-2 mt-1 border-t border-coffee-200">
          <span className="font-semibold text-coffee-900">{receiveLabel}</span>
          <span className="font-semibold text-coffee-900">{formatCents(payoutCents)}</span>
        </div>
      </div>
    </div>
  );
}
