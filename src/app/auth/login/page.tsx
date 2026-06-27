'use client';

import { Suspense, useState } from 'react';
import { supabase, setAuthCookie } from '@/lib/supabase';
import { useRouter, useSearchParams } from 'next/navigation';
import { Coffee, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';
import Link from 'next/link';
import { UserRole } from '@/types';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const getDashboardForRole = (role: UserRole): string => {
    const routes: Record<UserRole, string> = {
      ADMIN: '/dashboard/admin',
      MANAGER: '/dashboard/manager',
      BARISTA: '/dashboard/barista',
      CASHIER: '/dashboard/cashier',
      CUSTOMER: '/',
    };
    return routes[role] || '/';
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: signInData, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      if (!signInData.session) throw new Error('Login failed — no session returned');
      setAuthCookie(signInData.session.access_token, signInData.session.refresh_token);

      // Fetch role via the server-side profile API (uses service role key, bypasses RLS)
      const profileRes = await fetch('/api/auth/profile', {
        headers: { Authorization: `Bearer ${signInData.session.access_token}` },
      });
      const { profile } = profileRes.ok ? await profileRes.json() : {};

      const role = profile?.role?.name as UserRole | undefined;
      const destination = redirect || (role ? getDashboardForRole(role) : '/');

      toast.success('Welcome back!');
      router.push(destination);
    } catch (error: any) {
      toast.error(error.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-2xl p-8">
      <h2 className="text-xl font-semibold text-gray-800 mb-6">Sign in to your account</h2>

      <form onSubmit={handleLogin} className="space-y-4">
        <div>
          <label className="label">Email Address</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input"
            placeholder="you@nylocale.com"
            required
            autoComplete="email"
          />
        </div>

        <div>
          <label className="label">Password</label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input pr-10"
              placeholder="••••••••"
              required
              autoComplete="current-password"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="btn btn-primary w-full justify-center mt-2"
        >
          {loading ? 'Signing in…' : 'Sign In'}
        </button>
      </form>

      <div className="mt-6 pt-6 border-t border-gray-200 text-center">
        <Link href="/" className="text-sm text-coffee-700 hover:text-coffee-800 font-medium">
          ← Back to Customer Menu
        </Link>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-coffee-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white/10 rounded-2xl mb-4">
            <Coffee className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">NY Locale Store</h1>
          <p className="text-coffee-300 mt-1">Staff Portal</p>
        </div>

        <Suspense fallback={
          <div className="bg-white rounded-2xl shadow-2xl p-8 flex items-center justify-center min-h-[280px]">
            <div className="w-6 h-6 border-2 border-coffee-700 border-t-transparent rounded-full animate-spin" />
          </div>
        }>
          <LoginForm />
        </Suspense>

        <p className="text-center text-coffee-400 text-xs mt-6">
          NY Locale Store · Staff Only
        </p>
      </div>
    </div>
  );
}
