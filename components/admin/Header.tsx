'use client';

import type { ReactNode } from 'react';
import { Bell, ChevronDown, Search } from 'lucide-react';
import { useAdminContext } from './admin-context';

export default function Header({ onOpenMobile, mobileTrigger }: { onOpenMobile: () => void; mobileTrigger: ReactNode }) {
  const { scope, setScope } = useAdminContext();

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8">
        <button onClick={onOpenMobile} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden" aria-label="Open navigation">{mobileTrigger}</button>
        <div className="hidden flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 md:flex">
          <Search className="h-4 w-4 text-slate-400" /><input className="w-full bg-transparent text-sm outline-none" placeholder="Search stores, users, or webhooks" />
        </div>
        <div className="ml-auto flex items-center gap-2">
          <select className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" value={scope} onChange={(e) => setScope(e.target.value as 'platform' | 'store')}>
            <option value="platform">Platform</option><option value="store">Store</option>
          </select>
          <button className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50" aria-label="Notifications"><Bell className="h-4 w-4" /></button>
          <button className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-1.5 hover:bg-slate-50">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-700">SA</div>
            <div className="hidden text-left sm:block"><p className="text-sm font-medium text-slate-900">Sedifex Admin</p><p className="text-xs text-slate-500">Platform Owner</p></div>
            <ChevronDown className="h-4 w-4 text-slate-500" />
          </button>
        </div>
      </div>
    </header>
  );
}
