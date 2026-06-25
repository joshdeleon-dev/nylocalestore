'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase, clearAuthCookie } from '@/lib/supabase';
import { UserRole } from '@/types';
import { useRouter } from 'next/navigation';

export interface AuthUser {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  role_id: number;
  location_id?: number;
}

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const fetchProfile = useCallback(async (userId: string, userEmail: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return;

    const res = await fetch('/api/auth/profile', {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (!res.ok) return;

    const { profile } = await res.json();
    if (profile) {
      setUser({
        id: profile.id,
        email: userEmail,
        full_name: profile.full_name,
        role: profile.role?.name as UserRole,
        role_id: profile.role_id,
        location_id: profile.location_id,
      });
    }
  }, []);

  useEffect(() => {
    const initAuth = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (session?.user) {
          await fetchProfile(session.user.id, session.user.email!);
        }
      } finally {
        setLoading(false);
      }
    };

    initAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        await fetchProfile(session.user.id, session.user.email!);
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [fetchProfile]);

  const signOut = async () => {
    await supabase.auth.signOut();
    clearAuthCookie();
    router.push('/auth/login');
  };

  const getDashboardRoute = (role: UserRole): string => {
    const routes: Record<UserRole, string> = {
      ADMIN: '/dashboard/admin',
      MANAGER: '/dashboard/manager',
      BARISTA: '/dashboard/barista',
      CASHIER: '/dashboard/cashier',
      CUSTOMER: '/',
    };
    return routes[role] || '/';
  };

  return { user, loading, signOut, getDashboardRoute };
}
