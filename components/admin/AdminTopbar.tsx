'use client';

import { useAdminContext } from './admin-context';

export default function AdminTopbar() {
  const { scope, setScope, role } = useAdminContext();

  return (
    <header className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Admin Dashboard</h1>
        <p className="text-sm text-gray-500">Role: {role || 'Unknown'}</p>
      </div>

      <div className="flex items-center gap-3">
        <select
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          value={scope}
          onChange={(e) => setScope(e.target.value as 'platform' | 'store')}
        >
          <option value="platform">Platform</option>
          <option value="store">Store</option>
        </select>
      </div>
    </header>
  );
}
