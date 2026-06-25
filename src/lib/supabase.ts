// Supabase client initialization and utilities

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

// Client for browser (public)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Client for server with service role (admin operations)
export const supabaseAdmin = supabaseServiceRoleKey
  ? createClient(supabaseUrl, supabaseServiceRoleKey)
  : null;

export type SupabaseClient = ReturnType<typeof createClient>;

// Middleware reads this cookie to guard dashboard routes.
// Must be kept in sync with the session stored in localStorage.
export function setAuthCookie(accessToken: string, refreshToken: string) {
  const value = encodeURIComponent(JSON.stringify([accessToken, refreshToken, null, null, null]));
  document.cookie = `supabase.auth.token=${value}; path=/; max-age=${60 * 60 * 24 * 7}; samesite=lax`;
}

export function clearAuthCookie() {
  document.cookie = 'supabase.auth.token=; path=/; max-age=0; samesite=lax';
}
