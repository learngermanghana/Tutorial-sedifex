'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ArrowRight, BarChart3, Bell, Menu, ShieldCheck, Store, Users, X } from 'lucide-react';

const navItems = [
  { href: '#features', label: 'Features' },
  { href: '#team-dashboard', label: 'Team Dashboard' },
  { href: '/admin/login', label: 'Log in' },
];

const dashboardHighlights = [
  { title: 'Platform health', value: '99.98%', meta: 'Uptime across all tenant stores', icon: BarChart3 },
  { title: 'Active admins', value: '28', meta: 'Secure role-based sessions', icon: Users },
  { title: 'Webhook reliability', value: '99.4%', meta: 'Successful deliveries (24h)', icon: Bell },
];

export default function HomePage() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-slate-950/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-indigo-300">Sedifex</p>
            <p className="text-lg font-semibold">Team Command</p>
          </div>
          <nav className="hidden items-center gap-6 md:flex">
            {navItems.map((item) => (
              <Link key={item.label} href={item.href} className="text-sm text-slate-200 hover:text-white">
                {item.label}
              </Link>
            ))}
            <Link href="/admin/login" className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold hover:bg-indigo-400">
              Open Dashboard
            </Link>
          </nav>
          <button className="rounded-lg border border-white/20 p-2 md:hidden" onClick={() => setMobileOpen((prev) => !prev)} aria-label="Toggle menu">
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
        {mobileOpen ? (
          <nav className="space-y-3 border-t border-white/10 px-4 py-4 md:hidden">
            {navItems.map((item) => (
              <Link key={item.label} href={item.href} className="block text-sm text-slate-200" onClick={() => setMobileOpen(false)}>
                {item.label}
              </Link>
            ))}
          </nav>
        ) : null}
      </header>

      <main>
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_#4f46e5_0%,_transparent_45%),radial-gradient(circle_at_bottom_left,_#0ea5e9_0%,_transparent_35%)] opacity-40" />
          <div className="relative mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:px-8 lg:py-24">
            <div>
              <p className="inline-flex rounded-full border border-indigo-400/40 bg-indigo-400/10 px-3 py-1 text-xs font-medium text-indigo-200">New: Sedifex Team Dashboard</p>
              <h1 className="mt-6 text-4xl font-bold tracking-tight sm:text-5xl">Run the Sedifex platform from one modern command center.</h1>
              <p className="mt-5 max-w-xl text-slate-300">A cleaner landing page, secure login flow, mobile-friendly navigation, and a focused operations dashboard for your team.</p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/admin/login" className="inline-flex items-center gap-2 rounded-lg bg-white px-5 py-3 font-semibold text-slate-900">
                  Log in to Admin <ArrowRight className="h-4 w-4" />
                </Link>
                <Link href="/admin" className="rounded-lg border border-white/20 px-5 py-3 font-semibold text-white hover:bg-white/10">Preview Dashboard</Link>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 rounded-2xl border border-white/10 bg-white/5 p-4">
                <img src="https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=1200&q=80" alt="Sedifex team collaborating around operations dashboard" className="h-52 w-full rounded-xl object-cover" />
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <img src="https://images.unsplash.com/photo-1551434678-e076c223a692?auto=format&fit=crop&w=800&q=80" alt="Team monitoring product metrics" className="h-40 w-full rounded-xl object-cover" />
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <img src="https://images.unsplash.com/photo-1461749280684-dccba630e2f6?auto=format&fit=crop&w=800&q=80" alt="Developer reviewing secure login system" className="h-40 w-full rounded-xl object-cover" />
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="grid gap-4 md:grid-cols-3">
            <Feature title="Secure login" description="Route your team through the existing admin authentication and role scopes." icon={ShieldCheck} />
            <Feature title="Navigation upgrade" description="Use desktop nav and mobile hamburger menus for fast movement." icon={Menu} />
            <Feature title="Store + platform view" description="Keep tenant and store operations in one connected control center." icon={Store} />
          </div>
        </section>

        <section id="team-dashboard" className="mx-auto max-w-7xl px-4 pb-20 sm:px-6 lg:px-8">
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 lg:p-8">
            <h2 className="text-2xl font-semibold">Ködern dashboard for the Sedifex team</h2>
            <p className="mt-2 text-slate-300">Quick pulse metrics and direct paths to the operational admin tools.</p>
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              {dashboardHighlights.map((item) => {
                const Icon = item.icon;
                return (
                  <article key={item.title} className="rounded-xl border border-white/10 bg-slate-900/60 p-4">
                    <Icon className="h-5 w-5 text-indigo-300" />
                    <p className="mt-4 text-sm text-slate-300">{item.title}</p>
                    <p className="mt-1 text-3xl font-bold">{item.value}</p>
                    <p className="mt-2 text-xs text-slate-400">{item.meta}</p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

function Feature({
  title,
  description,
  icon: Icon,
}: {
  title: string;
  description: string;
  icon: typeof ShieldCheck;
}) {
  return (
    <article className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
      <Icon className="h-5 w-5 text-indigo-300" />
      <h3 className="mt-3 text-lg font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-slate-300">{description}</p>
    </article>
  );
}
