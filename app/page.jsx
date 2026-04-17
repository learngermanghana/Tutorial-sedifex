'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { PageShell } from '@/components/page-shell';
import { sortedTutorials } from '@/data/tutorials';

const learningOrder = ['dashboard', 'items', 'sell', 'receipts', 'close-day', 'public-page'];
const statusOrder = ['next up', 'in progress', 'completed'];
const statusStyles = {
  completed: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  'in progress': 'border-amber-200 bg-amber-50 text-amber-700',
  'next up': 'border-blue-200 bg-blue-50 text-blue-700'
};

const quickFixes = [
  {
    title: 'Can’t find Invoice?',
    fix: 'Open Sell first and confirm Owner/Admin role access.'
  },
  {
    title: 'Can’t find Product?',
    fix: 'Use Items — Product was renamed to Items.'
  },
  {
    title: 'Receipts not delivered?',
    fix: 'Verify contact details, then resend from sales history.'
  }
];

const releaseNotes = [
  'Added tutorial coverage for Invoice, Customers, and Bookings workflows.',
  'Expanded marketing operations guides with Social Media and SMS playbooks.',
  'Added Data, Account, and Troubleshooting tutorials for admin reliability.'
];

const confidenceMetrics = [
  '14 guided tutorials',
  'Role-based onboarding paths',
  'Covers checkout, receipts, close-day, and storefront visibility'
];

const getProgressMap = () => {
  if (typeof window === 'undefined') {
    return {};
  }

  const saved = window.localStorage.getItem('tutorial-progress');
  if (!saved) {
    return {};
  }

  try {
    const parsed = JSON.parse(saved);
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
};

const setProgressMap = (progressMap) => {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem('tutorial-progress', JSON.stringify(progressMap));
};

const recordTutorialClick = (slug) => {
  if (typeof window === 'undefined') {
    return;
  }

  const saved = window.localStorage.getItem('tutorial-clicks');
  const counts = saved ? JSON.parse(saved) : {};
  const nextCounts = { ...counts, [slug]: (counts[slug] ?? 0) + 1 };
  window.localStorage.setItem('tutorial-clicks', JSON.stringify(nextCounts));

  window.dispatchEvent(
    new CustomEvent('tutorial-click', {
      detail: { slug, count: nextCounts[slug], at: new Date().toISOString() }
    })
  );
};

const getClickCountMap = () => {
  if (typeof window === 'undefined') {
    return {};
  }

  try {
    return JSON.parse(window.localStorage.getItem('tutorial-clicks') ?? '{}');
  } catch {
    return {};
  }
};

export default function HomePage() {
  const [search, setSearch] = useState('');
  const [progressMap, setProgressState] = useState(() => getProgressMap());
  const [clickCounts, setClickCounts] = useState(() => getClickCountMap());

  const featured = useMemo(() => {
    const tutorialsBySlug = new Map(sortedTutorials.map((item) => [item.slug, item]));
    const ordered = learningOrder
      .map((slug) => tutorialsBySlug.get(slug))
      .filter(Boolean)
      .map((tutorial, index) => ({ ...tutorial, baseIndex: index }));

    return ordered
      .filter((tutorial) => {
        const query = search.trim().toLowerCase();
        if (!query) {
          return true;
        }

        return (
          tutorial.title.toLowerCase().includes(query) ||
          tutorial.description.toLowerCase().includes(query) ||
          tutorial.slug.toLowerCase().includes(query)
        );
      })
      .sort((a, b) => {
        const clickDelta = (clickCounts[b.slug] ?? 0) - (clickCounts[a.slug] ?? 0);
        return clickDelta !== 0 ? clickDelta : a.baseIndex - b.baseIndex;
      });
  }, [clickCounts, search]);

  const nextUpSlug = learningOrder.find((slug) => progressMap[slug] !== 'completed');

  const updateProgress = (slug, status) => {
    const nextMap = { ...progressMap, [slug]: status };
    setProgressState(nextMap);
    setProgressMap(nextMap);
  };

  const handleTutorialClick = (slug) => {
    recordTutorialClick(slug);
    setClickCounts((current) => ({ ...current, [slug]: (current[slug] ?? 0) + 1 }));
  };

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
          <div className="mt-4 flex flex-wrap gap-2 text-sm text-slate-700">
            {confidenceMetrics.map((metric) => (
              <span key={metric} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1">
                {metric}
              </span>
            ))}
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/tutorials/dashboard" className="rounded-full bg-teal-600 px-5 py-2.5 font-medium text-white hover:bg-teal-700">
              Start with Dashboard
            </Link>
            <Link href="/tutorials/sell" className="rounded-full border border-slate-300 px-5 py-2.5 font-medium text-slate-700 hover:border-teal-300 hover:text-teal-700">
              Start with Sell (for Staff)
            </Link>
            <Link href="/tutorials/items" className="rounded-full border border-slate-300 px-5 py-2.5 font-medium text-slate-700 hover:border-teal-300 hover:text-teal-700">
              Start with Items (for Inventory)
            </Link>
            <a href="https://www.sedifex.com" target="_blank" rel="noreferrer" className="rounded-full border border-slate-300 px-5 py-2.5 font-medium text-slate-700 hover:border-teal-300 hover:text-teal-700">
              Explore Sedifex Platform
            </a>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <h2 className="text-2xl font-semibold text-slate-900">Quick paths by role</h2>
          <p className="mt-2 text-slate-600">Jump straight into the right starting flow for each team role.</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link href="/tutorials/dashboard" className="rounded-full bg-teal-600 px-5 py-2.5 font-medium text-white hover:bg-teal-700">
              I&apos;m Owner/Admin → Start here
            </Link>
            <Link href="/tutorials/sell" className="rounded-full border border-teal-300 bg-teal-50 px-5 py-2.5 font-medium text-teal-900 hover:bg-teal-100">
              I&apos;m Staff → Start here
            </Link>
          </div>
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
              <span className="mb-2 block text-sm font-medium text-slate-700">Search tutorials</span>
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Try: receipts, close day, invoice"
                className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none ring-teal-600/20 transition focus:ring"
                aria-label="Search tutorials"
              />
            </label>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3" role="list" aria-label="Recommended tutorial order">
            {featured.map((tutorial, index) => {
              const status = progressMap[tutorial.slug] ?? (nextUpSlug === tutorial.slug ? 'next up' : 'in progress');
              const clicks = clickCounts[tutorial.slug] ?? 0;

              return (
                <div key={tutorial.slug} className="rounded-xl border border-slate-200 p-4 hover:border-teal-300 hover:bg-teal-50/40">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-xs font-semibold uppercase text-teal-700">Step {index + 1}</p>
                    <span className={`rounded-full border px-2 py-1 text-xs font-medium capitalize ${statusStyles[status]}`}>
                      {status}
                    </span>
                  </div>
                  <Link
                    href={`/tutorials/${tutorial.slug}`}
                    className="mt-2 block"
                    onClick={() => handleTutorialClick(tutorial.slug)}
                    data-tutorial-slug={tutorial.slug}
                  >
                    <h3 className="font-semibold text-slate-900">{tutorial.title}</h3>
                    <p className="mt-1 text-sm text-slate-600">{tutorial.description}</p>
                    <p className="mt-2 text-xs text-slate-500">{clicks} homepage clicks</p>
                  </Link>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {statusOrder.map((option) => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => updateProgress(tutorial.slug, option)}
                        className={`rounded-full border px-2.5 py-1 text-xs font-medium capitalize ${
                          status === option ? statusStyles[option] : 'border-slate-200 text-slate-600 hover:border-teal-300 hover:text-teal-700'
                        }`}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <h2 className="text-2xl font-semibold text-slate-900">Most common fixes</h2>
            <p className="mt-2 text-slate-600">Top troubleshooting wins surfaced directly on the homepage.</p>
            <ul className="mt-4 space-y-3">
              {quickFixes.map((issue) => (
                <li key={issue.title} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="font-semibold text-slate-900">{issue.title}</p>
                  <p className="mt-1 text-sm text-slate-600">{issue.fix}</p>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <h2 className="text-2xl font-semibold text-slate-900">What&apos;s new</h2>
            <p className="mt-2 text-slate-600">Quick release notes for returning teams.</p>
            <ul className="mt-4 space-y-3 text-sm text-slate-700">
              {releaseNotes.map((note) => (
                <li key={note} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  {note}
                </li>
              ))}
            </ul>
          </div>
        </section>
      </div>
    </PageShell>
  );
}
