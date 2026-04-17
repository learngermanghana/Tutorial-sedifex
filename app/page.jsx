import Link from 'next/link';
import { PageShell } from '@/components/page-shell';
import { sortedTutorials } from '@/data/tutorials';

const learningOrder = ['dashboard', 'items', 'sell', 'receipts', 'close-day', 'public-page'];

export default function HomePage() {
  const featured = sortedTutorials.filter((item) => learningOrder.includes(item.slug));

  return (
    <PageShell>
      <div className="space-y-6">
        <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm sm:p-10">
          <p className="text-sm font-semibold uppercase tracking-wide text-teal-700">tutorial.sedifex.com</p>
          <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl">
            Help your team manage inventory, sell faster, share receipts, and get discovered online.
          </h1>
          <p className="mt-4 max-w-3xl text-lg text-slate-600">
            Sedifex is built for modern retail operations. Use these tutorials to onboard owners, cashiers, and operations staff with clear, practical steps.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/tutorials/dashboard" className="rounded-full bg-teal-600 px-5 py-2.5 font-medium text-white hover:bg-teal-700">
              Start with Dashboard
            </Link>
            <a href="https://www.sedifex.com" target="_blank" rel="noreferrer" className="rounded-full border border-slate-300 px-5 py-2.5 font-medium text-slate-700 hover:border-teal-300 hover:text-teal-700">
              Explore Sedifex Platform
            </a>
          </div>
        </section>

        <section className="rounded-2xl border border-teal-100 bg-teal-50 p-6 shadow-sm sm:p-8">
          <h2 className="text-2xl font-semibold text-teal-900">Sedifex Market visibility benefit</h2>
          <p className="mt-3 max-w-3xl text-teal-900/90">
            Verified stores may have eligible inventory automatically displayed on{' '}
            <a href="https://www.sedifexmarket.com" className="font-semibold underline decoration-teal-300 underline-offset-4" target="_blank" rel="noreferrer">
              www.sedifexmarket.com
            </a>
            . This can increase product discovery and help new customers find your business online.
          </p>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-slate-900">Recommended learning order</h2>
              <p className="mt-2 text-slate-600">A practical path for quick onboarding and daily execution.</p>
            </div>
            <label className="w-full max-w-sm">
              <span className="mb-2 block text-sm font-medium text-slate-700">Search tutorials (coming soon)</span>
              <input
                type="search"
                placeholder="Try: receipts, close day, invoice"
                className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none ring-teal-600/20 transition focus:ring"
                aria-label="Search tutorials placeholder"
                disabled
              />
            </label>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3" role="list" aria-label="Recommended tutorial order">
            {featured.map((tutorial, index) => (
              <Link key={tutorial.slug} href={`/tutorials/${tutorial.slug}`} className="rounded-xl border border-slate-200 p-4 hover:border-teal-300 hover:bg-teal-50/40">
                <p className="text-xs font-semibold uppercase text-teal-700">Step {index + 1}</p>
                <h3 className="mt-1 font-semibold text-slate-900">{tutorial.title}</h3>
                <p className="mt-1 text-sm text-slate-600">{tutorial.description}</p>
              </Link>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <h2 className="text-2xl font-semibold text-slate-900">Owner/Admin and Staff quick guidance</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <h3 className="font-semibold text-slate-900">For Owners/Admins</h3>
              <p className="mt-2 text-sm text-slate-600">Configure workspace, inventory policy, billing, close day, and public storefront visibility.</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <h3 className="font-semibold text-slate-900">For Staff</h3>
              <p className="mt-2 text-sm text-slate-600">Focus on Sell, receipts, and customer-facing speed. Some navigation may differ by role permissions.</p>
            </div>
          </div>
        </section>
      </div>
    </PageShell>
  );
}
