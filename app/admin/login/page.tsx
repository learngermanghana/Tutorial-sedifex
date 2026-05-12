'use client';

import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { ADMIN_ROLES } from '@/lib/admin-access';

export default function AdminLoginPage() {
  const router = useRouter();
  const [role, setRole] = useState<(typeof ADMIN_ROLES)[number]>('ops_admin');

  function login(e: FormEvent) {
    e.preventDefault();
    document.cookie = `sedifex_admin_role=${role}; path=/; max-age=86400`;
    document.cookie = 'sedifex_admin_scope=platform; path=/; max-age=86400';
    router.push('/admin');
  }

  return (
    <div className="mx-auto mt-24 max-w-md rounded-2xl border border-gray-200 bg-white p-6">
      <h1 className="text-2xl font-bold">Firebase Admin Login (Mock)</h1>
      <p className="mt-1 text-sm text-gray-600">Starter auth gate before protected admin routes.</p>
      <form className="mt-6 space-y-4" onSubmit={login}>
        <label className="block text-sm font-medium">Role</label>
        <select className="w-full rounded-lg border border-gray-300 px-3 py-2" value={role} onChange={(e) => setRole(e.target.value as never)}>
          {ADMIN_ROLES.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
        <button className="w-full rounded-lg bg-black py-2 text-white">Sign in</button>
      </form>
    </div>
  );
}
