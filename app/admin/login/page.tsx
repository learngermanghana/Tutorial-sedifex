'use client';

import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function login(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data?.error ?? 'Unable to sign in.');
        return;
      }

      document.cookie = `sedifex_admin_role=${data.role}; path=/; max-age=86400`;
      document.cookie = `sedifex_admin_scope=${data.scope}; path=/; max-age=86400`;
      router.push('/admin');
    } catch {
      setError('Unexpected error signing in.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto mt-24 max-w-md rounded-2xl border border-gray-200 bg-white p-6">
      <h1 className="text-2xl font-bold">Admin Login</h1>
      <p className="mt-1 text-sm text-gray-600">Uses Vercel environment credentials for admin/staff logins.</p>
      <form className="mt-6 space-y-4" onSubmit={login}>
        <div>
          <label className="mb-1 block text-sm font-medium">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2"
            placeholder="you@company.com"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Password</label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2"
            placeholder="••••••••"
          />
        </div>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <button disabled={loading} className="w-full rounded-lg bg-black py-2 text-white disabled:opacity-60">
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
