'use client';

import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Menu } from 'lucide-react';
import { AdminContextProvider } from './admin-context';
import Sidebar from './Sidebar';
import Header from './Header';
import PageHeader from './PageHeader';

const titleMap: Record<string, { title: string; description: string }> = {
  '/admin': { title: 'Overview', description: 'Monitor the health and performance of your Sedifex platform.' },
  '/admin/stores': { title: 'Stores', description: 'Manage tenant stores, plans, status, and storefront operations.' },
  '/admin/products': { title: 'Products', description: 'Inspect Sedifex product quality and catalog readiness.' },
  '/admin/live-chat': { title: 'Live Chat', description: 'Reply to Sedifex Market visitor messages and manage support conversations.' },
};

export default function AdminShell({ children }: { children: ReactNode }) {
  return (
    <AdminContextProvider>
      <ShellFrame>{children}</ShellFrame>
    </AdminContextProvider>
  );
}

function ShellFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  if (pathname === '/admin/login') {
    return <>{children}</>;
  }

  const pageMeta = useMemo(() => titleMap[pathname] ?? { title: 'Admin', description: 'Sedifex administration portal.' }, [pathname]);

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="flex">
        <Sidebar mobileOpen={mobileOpen} onMobileClose={() => setMobileOpen(false)} />
        <div className="min-w-0 flex-1 lg:pl-72">
          <Header onOpenMobile={() => setMobileOpen(true)} mobileTrigger={<Menu className="h-5 w-5" />} />
          <main className="px-4 py-6 sm:px-6 lg:px-8">
            <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
              <PageHeader title={pageMeta.title} description={pageMeta.description} />
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}