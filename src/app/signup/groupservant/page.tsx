'use client';

import { useState } from 'react';
import { Coffee, Eye, EyeOff, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';

export default function GroupLeaderSignupPage() {
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    password: '',
    phone: '',
    group_number: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/signup/group-leader', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Signup failed');
      setDone(true);
    } catch (err: any) {
      toast.error(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-coffee-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white/10 rounded-2xl mb-4">
            <Coffee className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">NY Locale Store</h1>
          <p className="text-coffee-300 mt-1">Group Leader Portal</p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {done ? (
            <div className="text-center py-4">
              <CheckCircle2 className="w-14 h-14 text-green-500 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-gray-900 mb-2">Account Created!</h2>
              <p className="text-gray-500 text-sm mb-6">
                Your group leader account is ready. You can now sign in with your email and password.
              </p>
              <Link
                href="/auth/login"
                className="btn btn-primary w-full justify-center"
              >
                Sign In
              </Link>
            </div>
          ) : (
            <>
              <h2 className="text-xl font-semibold text-gray-800 mb-1">Create your account</h2>
              <p className="text-sm text-gray-400 mb-6">Register to access your group's sales reports.</p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="label">Full Name *</label>
                  <input
                    className="input"
                    value={form.full_name}
                    onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                    placeholder="Jane Smith"
                    required
                    autoComplete="name"
                  />
                </div>

                <div>
                  <label className="label">Group Number *</label>
                  <input
                    type="number"
                    min="1"
                    className="input"
                    value={form.group_number}
                    onChange={(e) => setForm({ ...form, group_number: e.target.value })}
                    placeholder="e.g., 5"
                    required
                  />
                  <p className="text-xs text-gray-400 mt-1">Enter the group number assigned to you.</p>
                </div>

                <div>
                  <label className="label">Email Address *</label>
                  <input
                    type="email"
                    className="input"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="you@example.com"
                    required
                    autoComplete="email"
                  />
                </div>

                <div>
                  <label className="label">Password *</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      className="input pr-10"
                      value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                      placeholder="Min. 6 characters"
                      minLength={6}
                      required
                      autoComplete="new-password"
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

                <div>
                  <label className="label">Phone <span className="text-gray-400 font-normal normal-case">(optional)</span></label>
                  <input
                    type="tel"
                    className="input"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="(212) 555-0100"
                    autoComplete="tel"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="btn btn-primary w-full justify-center mt-2"
                >
                  {loading ? 'Creating account…' : 'Create Account'}
                </button>
              </form>
            </>
          )}
        </div>

        <p className="text-center text-coffee-400 text-xs mt-6">
          Already have an account?{' '}
          <Link href="/auth/login" className="text-coffee-200 hover:text-white underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
