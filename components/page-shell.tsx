import { ReactNode } from 'react';
import { SiteHeader } from '@/components/site-header';
import { SidebarNav } from '@/components/sidebar-nav';

type PageShellProps = {
  children: ReactNode;
  currentSlug?: string;
};

export function PageShell({ children, currentSlug }: PageShellProps) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <SiteHeader />
      <div className="mx-auto grid w-full max-w-7xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[280px_minmax(0,1fr)] lg:px-8">
        <div className="hidden lg:block">
          <SidebarNav currentSlug={currentSlug} />
        </div>
        <main>{children}</main>
      </div>
      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-2 px-4 py-6 text-sm text-slate-600 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <p>© {new Date().getFullYear()} Sedifex Tutorials</p>
          <div className="flex gap-4">
            <a href="https://www.sedifex.com" target="_blank" rel="noreferrer" className="hover:text-teal-700">www.sedifex.com</a>
            <a href="https://developer.sedifex.com" target="_blank" rel="noreferrer" className="hover:text-teal-700">developer.sedifex.com</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
