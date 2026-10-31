'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ImagePlus, Loader2, X } from 'lucide-react';
import { LocaleSplitCalculator } from './LocaleSplitCalculator';
import { CONDITION_LABELS } from '@/lib/marketplace';
import { MAX_PHOTOS, checkPhoto, uploadPhotos } from '@/lib/marketplaceUpload';
import { ListingCondition } from '@/types/marketplace';

interface Props {
  base: string;
  categories: { id: number; name: string }[];
}

export function SellForm({ base, categories }: Props) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [photos, setPhotos] = useState<{ file: File; preview: string }[]>([]);
  const [form, setForm] = useState({
    name: '', email: '', phone: '',
    title: '', description: '', condition: '' as ListingCondition | '', category_id: '',
    priceCents: null as number | null, percent: 0, consent: false,
  });
  const [error, setError] = useState('');
  const [status, setStatus] = useState<'idle' | 'uploading' | 'saving'>('idle');

  useEffect(() => () => photos.forEach((p) => URL.revokeObjectURL(p.preview)), []); // eslint-disable-line react-hooks/exhaustive-deps

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

  const addPhotos = (list: FileList | null) => {
    if (!list) return;
    const files = Array.from(list);
    if (fileInput.current) fileInput.current.value = '';
    const problem = files.map(checkPhoto).find(Boolean);
    if (problem) { setError(problem); return; }
    if (photos.length + files.length > MAX_PHOTOS) { setError(`You can add up to ${MAX_PHOTOS} photos`); return; }
    setError('');
    setPhotos((p) => [...p, ...files.map((file) => ({ file, preview: URL.createObjectURL(file) }))]);
  };

  const removePhoto = (i: number) => {
    URL.revokeObjectURL(photos[i].preview);
    setPhotos((p) => p.filter((_, j) => j !== i));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (photos.length === 0) return setError('Add at least one photo of your item');
    if (!form.condition) return setError('Choose the item’s condition');
    if (!form.priceCents) return setError('Enter your price');
    if (!form.consent) return setError('Please confirm the agreement to continue');

    try {
      setStatus('uploading');
      const paths = await uploadPhotos('/api/marketplace/submissions', photos.map((p) => p.file));
      setStatus('saving');
      const res = await fetch('/api/marketplace/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'submit',
          seller: { name: form.name, email: form.email, phone: form.phone },
          title: form.title,
          description: form.description,
          condition: form.condition,
          category_id: form.category_id ? Number(form.category_id) : null,
          asking_price_cents: form.priceCents,
          locale_percent: form.percent,
          paths,
          consent: form.consent,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Something went wrong — please try again');
      router.push(`${base}/sell/thanks?ref=${json.reference}`);
    } catch (err: any) {
      setError(err.message);
      setStatus('idle');
    }
  };

  const busy = status !== 'idle';

  return (
    <form onSubmit={submit} className="space-y-8" noValidate={false}>
      <Section title="Photos" hint={`Up to ${MAX_PHOTOS}. The first photo is the cover.`}>
        <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={(e) => addPhotos(e.target.files)} />
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
          {photos.map((p, i) => (
            <div key={p.preview} className="relative aspect-square rounded-xl overflow-hidden bg-coffee-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.preview} alt="" className="w-full h-full object-cover" />
              {i === 0 && <span className="absolute top-1.5 left-1.5 text-[10px] font-semibold bg-coffee-900 text-white rounded px-1.5 py-0.5">Cover</span>}
              <button type="button" onClick={() => removePhoto(i)} disabled={busy} className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-white/90 text-coffee-800 flex items-center justify-center hover:bg-white" aria-label="Remove photo">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
          {photos.length < MAX_PHOTOS && (
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              disabled={busy}
              className="aspect-square rounded-xl border-2 border-dashed border-coffee-300 text-coffee-500 hover:border-coffee-500 hover:text-coffee-800 flex flex-col items-center justify-center gap-1 text-xs font-medium transition-colors"
            >
              <ImagePlus className="w-6 h-6" />
              Add photo
            </button>
          )}
        </div>
      </Section>

      <Section title="About your item">
        <Field label="Title *">
          <input className="input" value={form.title} onChange={(e) => set('title', e.target.value)} required maxLength={120} placeholder="e.g. Oak bookshelf, 5 shelves" />
        </Field>
        <Field label="Description">
          <textarea className="input min-h-[110px] resize-y" value={form.description} onChange={(e) => set('description', e.target.value)} maxLength={5000} placeholder="Size, brand, age, any wear or defects…" />
        </Field>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Condition *">
            <select className="select" value={form.condition} onChange={(e) => set('condition', e.target.value as ListingCondition)} required>
              <option value="" disabled>Choose…</option>
              {Object.entries(CONDITION_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </Field>
          <Field label="Category">
            <select className="select" value={form.category_id} onChange={(e) => set('category_id', e.target.value)}>
              <option value="">Choose…</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
        </div>
      </Section>

      <Section title="Price" hint="Optionally donate part of the sale to the locale. Buyers only see your price, unless you choose 100%: those items are shown as “100% for Flagship”.">
        <LocaleSplitCalculator
          priceCents={form.priceCents}
          percent={form.percent}
          onChange={({ priceCents, percent }) => setForm((f) => ({ ...f, priceCents, percent }))}
          priceLabel="Your price"
          receiveLabel="You’ll receive"
          allowCustom={false}
        />
      </Section>

      <Section title="Your contact details" hint="Private — only our staff see these, to arrange the sale with you.">
        <Field label="Full name *">
          <input className="input" value={form.name} onChange={(e) => set('name', e.target.value)} required maxLength={120} autoComplete="name" />
        </Field>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Email *">
            <input type="email" className="input" value={form.email} onChange={(e) => set('email', e.target.value)} required maxLength={200} autoComplete="email" />
          </Field>
          <Field label="Phone *">
            <input type="tel" className="input" value={form.phone} onChange={(e) => set('phone', e.target.value)} required minLength={7} maxLength={40} autoComplete="tel" />
          </Field>
        </div>
      </Section>

      <label className="flex gap-3 items-start text-sm text-coffee-700 cursor-pointer">
        <input type="checkbox" className="checkbox mt-0.5" checked={form.consent} onChange={(e) => set('consent', e.target.checked)} />
        <span>
          I agree that NY Locale staff may contact me about this item, and that the For Locale donation I chose
          {form.percent > 0 ? ` (${form.percent}%)` : ''} will be deducted from the sale price before I’m paid.
        </span>
      </label>

      {error && <p className="rounded-lg bg-red-50 text-red-700 text-sm px-4 py-3" role="alert">{error}</p>}

      <button type="submit" disabled={busy} className="w-full rounded-full bg-coffee-900 text-white font-medium py-3.5 hover:bg-coffee-700 transition-colors disabled:opacity-60 inline-flex items-center justify-center gap-2">
        {busy && <Loader2 className="w-4 h-4 animate-spin" />}
        {status === 'uploading' ? 'Uploading photos…' : status === 'saving' ? 'Submitting…' : 'Submit for review'}
      </button>
    </form>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="font-serif text-xl text-coffee-900">{title}</h2>
        {hint && <p className="text-sm text-coffee-500 mt-0.5">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
    </div>
  );
}
