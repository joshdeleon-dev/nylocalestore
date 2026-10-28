'use client';

import { ReactNode } from 'react';
import { Toaster } from 'react-hot-toast';
import { supabase } from '@/lib/supabase';

// API routes verify the caller's Supabase token server-side. Attach it to every
// same-origin /api request so individual fetch calls don't each have to.
if (typeof window !== 'undefined' && !(window as any).__apiAuthFetch) {
  (window as any).__apiAuthFetch = true;
  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const isOwnApi = url.startsWith('/api/') || url.startsWith(`${window.location.origin}/api/`);
    if (!isOwnApi) return originalFetch(input, init);

    const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
    if (!headers.has('Authorization')) {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) headers.set('Authorization', `Bearer ${session.access_token}`);
    }
    return originalFetch(input, { ...init, headers });
  };
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <Toaster position="top-right" />
    </>
  );
}
