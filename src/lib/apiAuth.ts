// Server-side auth for API routes. Verifies the caller's Supabase access token
// (sent as `Authorization: Bearer <token>`) and looks up their role.

import { NextRequest, NextResponse } from 'next/server';
import { supabase, supabaseAdmin } from '@/lib/supabase';
import { UserRole } from '@/types';

const db = supabaseAdmin ?? supabase;

export interface ApiUser {
  id: string;
  role: UserRole;
  group_number: number | null;
}

// Role groups used across routes
export const ADMIN_ONLY: UserRole[] = ['ADMIN'];
export const ADMIN_MANAGER: UserRole[] = ['ADMIN', 'MANAGER'];
export const ORDER_STAFF: UserRole[] = ['ADMIN', 'MANAGER', 'BARISTA', 'CASHIER'];

export async function getApiUser(req: NextRequest): Promise<ApiUser | null> {
  const header = req.headers.get('authorization');
  if (!header?.startsWith('Bearer ')) return null;

  const { data: { user } } = await db.auth.getUser(header.slice(7));
  if (!user) return null;

  const { data: profile } = await db
    .from('users')
    .select('is_active, group_number, role:roles(name)')
    .eq('id', user.id)
    .single();
  if (!profile || profile.is_active === false) return null;

  return {
    id: user.id,
    role: (profile as any).role?.name,
    group_number: (profile as any).group_number ?? null,
  };
}

// Returns the user when their role is allowed, otherwise a 401/403 response to return as-is:
//   const auth = await requireRole(req, ADMIN_MANAGER);
//   if (auth instanceof NextResponse) return auth;
export async function requireRole(req: NextRequest, roles: UserRole[]): Promise<ApiUser | NextResponse> {
  const user = await getApiUser(req);
  if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  if (!roles.includes(user.role)) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  return user;
}
