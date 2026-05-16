'use client';

import Link from 'next/link';
import type { ComponentType } from 'react';
import { usePathname } from 'next/navigation';
import { Boxes, ChartNoAxesCombined, ChevronRight, Cog, House, Package, Plug, ShoppingBag, Store, Users, X } from 'lucide-react';

type Item = { href: string; label: string; icon: ComponentType<{ className?: string }> };
const groups: { label: string; items: Item[] }[] = [
  { label: 'Overview', items: [{ href: '/admin', label: 'Command Center', icon: House }] },
  { label: 'Commerce', items: [{ href: '/admin/stores', label: 'Stores', icon: Store }, { href: '/admin/products', label: 'Products', icon: Package }, { href: '/admin/marketplace', label: 'Marketplace', icon: ShoppingBag }] },
  { label: 'Customers', items: [{ href: '/admin/users', label: 'Admins & Roles', icon: Users }] },
  { label: 'Engagement', items: [{ href: '/admin', label: 'Campaign Health', icon: ChartNoAxesCombined }] },
  { label: 'Integrations', items: [{ href: '/admin/integrations', label: 'Overview', icon: Plug }, { href: '/admin/webhooks', label: 'Webhooks', icon: Plug }, { href: '/admin/deliveries', label: 'Deliveries', icon: Boxes }] },
  { label: 'Operations', items: [{ href: '/admin/audit-logs', label: 'Audit Logs', icon: ChartNoAxesCombined }] },
  { label: 'Settings', items: [{ href: '/admin/settings', label: 'Preferences', icon: Cog }] },
];

export default function Sidebar({ mobileOpen, onMobileClose }: { mobileOpen: boolean; onMobileClose: () => void }) {
  const pathname = usePathname();
  const nav = (
    <div className="flex h-full flex-col bg-slate-950 text-slate-200">
      <div className="flex items-center justify-between border-b border-slate-800 px-5 py-5">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Sedifex</p>
          <p className="text-lg font-semibold text-white">Admin Console</p>
        </div>
        <button className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 lg:hidden" onClick={onMobileClose}>
          <X className="h-5 w-5" />
        </button>
      </div>
      <nav className="space-y-6 overflow-y-auto px-3 py-4">
        {groups.map((group) => (
          <div key={group.label}>
            <p className="px-3 pb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">{group.label}</p>
            <div className="space-y-1">
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.href;
                return (
                  <Link key={`${group.label}-${item.label}`} href={item.href} className={`flex items-center justify-between rounded-xl px-3 py-2 text-sm transition ${active ? 'bg-slate-800 text-white shadow' : 'text-slate-300 hover:bg-slate-900 hover:text-white'}`}>
                    <span className="flex items-center gap-2"><Icon className="h-4 w-4" />{item.label}</span>
                    {active ? <ChevronRight className="h-4 w-4 text-indigo-300" /> : null}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    </div>
  );

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-72 lg:block">{nav}</aside>
      {mobileOpen ? <div className="fixed inset-0 z-50 bg-slate-950/50 lg:hidden" onClick={onMobileClose} /> : null}
      <aside className={`fixed inset-y-0 left-0 z-50 w-72 transform transition lg:hidden ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>{nav}</aside>
    </>
  );
}
