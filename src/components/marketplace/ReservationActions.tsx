'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Copy, Loader2 } from 'lucide-react';

export function CopyLinkButton() {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt('Copy this link:', window.location.href);
    }
  };
  return (
    <button type="button" onClick={copy} className="inline-flex items-center gap-1.5 rounded-full border border-coffee-200 bg-white px-4 py-2 text-sm font-medium text-coffee-800 hover:bg-coffee-50">
      {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
      {copied ? 'Copied' : 'Copy link'}
    </button>
  );
}

export function CancelReservationButton({ token }: { token: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const cancel = async () => {
    setBusy(true);
    setError('');
    const res = await fetch('/api/marketplace/reservations/cancel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setError(json.error || 'Something went wrong — please try again'); return; }
    router.refresh();
  };

  if (!confirming) {
    return (
      <button type="button" onClick={() => setConfirming(true)} className="text-sm font-medium text-red-700 hover:text-red-800 underline underline-offset-4">
        Cancel reservation
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-4 space-y-3">
      <p className="text-sm text-red-800">Cancel this reservation? The item will go back on sale for other buyers.</p>
      {error && <p className="text-sm text-red-700" role="alert">{error}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={cancel} disabled={busy} className="inline-flex items-center gap-2 rounded-full bg-red-700 text-white text-sm font-medium px-4 py-2 hover:bg-red-800 disabled:opacity-60">
          {busy && <Loader2 className="w-4 h-4 animate-spin" />} Yes, cancel it
        </button>
        <button type="button" onClick={() => setConfirming(false)} className="rounded-full border border-coffee-200 bg-white text-sm font-medium px-4 py-2 text-coffee-700 hover:bg-coffee-50">
          Keep it
        </button>
      </div>
    </div>
  );
}
