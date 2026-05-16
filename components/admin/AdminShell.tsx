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
  '/admin/marketplace': { title: 'Marketplace', description: 'Monitor SedifexMarket visibility, public products, and catalog quality.' },
  '/admin/users': { title: 'Users', description: 'Control admin access, roles, and account security posture.' },
  '/admin/integrations': { title: 'Integrations', description: 'Manage API clients, webhooks, credentials, and delivery reliability.' },
  '/admin/audit-logs': { title: 'Audit Logs', description: 'Trace actor actions and sensitive system changes.' },
  '/admin/webhooks': { title: 'Webhooks', description: 'Manage endpoints, subscriptions, and webhook health.' },
  '/admin/deliveries': { title: 'Deliveries', description: 'Inspect delivery outcomes, retries, and incident patterns.' },
  '/admin/settings': { title: 'Settings', description: 'Configure session, security, and platform-level preferences.' },
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
