'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';

type Scope = 'platform' | 'store';

type AdminContextValue = {
  scope: Scope;
  setScope: (scope: Scope) => void;
  role: string;
};

const AdminContext = createContext<AdminContextValue | null>(null);

function readCookie(name: string) {
  if (typeof document === 'undefined') return '';
  return document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${name}=`))
    ?.split('=')[1] ?? '';
}

export function AdminContextProvider({ children }: { children: React.ReactNode }) {
  const [scope, setScopeState] = useState<Scope>('platform');
  const [role, setRole] = useState('');

  useEffect(() => {
    const cookieScope = readCookie('sedifex_admin_scope');
    const cookieRole = readCookie('sedifex_admin_role');
    if (cookieScope === 'store' || cookieScope === 'platform') setScopeState(cookieScope);
    if (cookieRole) setRole(cookieRole);
  }, []);

  const setScope = (next: Scope) => {
    setScopeState(next);
    document.cookie = `sedifex_admin_scope=${next}; path=/; max-age=86400`;
  };

  const value = useMemo(() => ({ scope, setScope, role }), [scope, role]);
  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>;
}

export function useAdminContext() {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error('useAdminContext must be used within AdminContextProvider');
  return ctx;
}
