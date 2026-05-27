'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Activity, LayoutDashboard, Package, ShoppingBag, Store } from 'lucide-react';
import { useAdminContext } from './admin-context';

const items = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard, scopes: ['platform', 'store'] },
  { href: '/admin/platform-activity', label: 'Platform Activity', icon: Activity, scopes: ['platform'] },
  { href: '/admin/stores', label: 'Stores', icon: Store, scopes: ['platform', 'store'] },
  { href: '/admin/products', label: 'Products', icon: Package, scopes: ['platform', 'store'] },
  { href: '/admin/orders', label: 'Orders', icon: ShoppingBag, scopes: ['platform', 'store'] },
];

export default function AdminSidebar() {
  const pathname = usePathname();
  const { scope } = useAdminContext();

  return (
    <aside className="min-h-screen w-72 border-r border-gray-200 bg-white">
      <div className="border-b border-gray-200 p-6">
        <p className="text-lg font-bold">Sedifex Admin</p>
      </div>
      <nav className="space-y-2 p-4">
        {items.filter((i) => i.scopes.includes(scope)).map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href;
          return (
            <Link key={item.href} href={item.href} className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium ${active ? 'bg-black text-white' : 'text-gray-700 hover:bg-gray-100'}`}>
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
