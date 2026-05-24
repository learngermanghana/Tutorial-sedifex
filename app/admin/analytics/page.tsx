'use client';

import { useEffect, useMemo, useState } from 'react';
import { Activity, BarChart3, Globe2, MousePointerClick, PackageSearch, RefreshCw, Search, ShoppingCart, Smartphone, Store, Target, TrendingUp, Users } from 'lucide-react';

type TopItem = { key: string; label: string; count: number };
type AnalyticsOverview = {
  ok?: boolean;
  error?: string;
  days?: number;
  generatedAt?: string;
  totals?: {
    visitors: number;
    sessions: number;
    pageViews: number;
    productViews: number;
    storeViews: number;
    searchEvents: number;
    addToCart: number;
    checkoutStarted: number;
    paymentInitialized: number;
    paidOrders: number;
    conversionRate: number;
    whatsappClicks: number;
    phoneClicks: number;
    sellerProfileClicks: number;
    revenue: number;
  };
  topTrafficSources?: TopItem[];
  topCountries?: TopItem[];
  topDevices?: TopItem[];
  topPages?: TopItem[];
  topProducts?: TopItem[];
  topStores?: TopItem[];
  topSearchTerms?: TopItem[];
  recentEvents?: Array<{
    id?: string;
    eventName?: string;
    pagePath?: string | null;
    trafficSource?: string | null;
    country?: string | null;
    device?: string | null;
    storeName?: string | null;
    productName?: string | null;
    searchTerm?: string | null;
    actionTarget?: string | null;
    createdAtIso?: string | null;
  }>;
};

const EMPTY_TOTALS = {
  visitors: 0,
  sessions: 0,
  pageViews: 0,
  productViews: 0,
  storeViews: 0,
  searchEvents: 0,
  addToCart: 0,
  checkoutStarted: 0,
  paymentInitialized: 0,
  paidOrders: 0,
  conversionRate: 0,
  whatsappClicks: 0,
  phoneClicks: 0,
  sellerProfileClicks: 0,
  revenue: 0,
};

function numberText(value: number | undefined, suffix = '') {
  return `${Number(value || 0).toLocaleString()}${suffix}`;
}

function money(value: number | undefined) {
  return `GHS ${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function maxCount(items: TopItem[]) {
  return Math.max(1, ...items.map((item) => item.count));
}

function TopList({ title, icon, items, empty = 'No data yet' }: { title: string; icon: React.ReactNode; items?: TopItem[]; empty?: string }) {
  const list = items || [];
  const max = maxCount(list);
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-sm font-bold text-slate-950">{icon}{title}</h3>
        <span className="text-xs font-semibold text-slate-400">Top {list.length}</span>
      </div>
      <div className="mt-4 space-y-3">
        {list.length === 0 ? <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">{empty}</p> : null}
        {list.map((item) => (
          <div key={`${title}-${item.key}`}>
            <div className="flex items-center justify-between gap-3 text-xs">
              <span className="truncate font-semibold text-slate-700">{item.label || item.key}</span>
              <span className="font-bold text-slate-950">{item.count}</span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-indigo-500" style={{ width: `${Math.max(6, (item.count / max) * 100)}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatCard({ label, value, hint, icon, tone = 'indigo' }: { label: string; value: string; hint: string; icon: React.ReactNode; tone?: 'indigo' | 'emerald' | 'amber' | 'rose' | 'blue' | 'slate' }) {
  const toneClass = {
    indigo: 'bg-indigo-50 text-indigo-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
    rose: 'bg-rose-50 text-rose-600',
    blue: 'bg-blue-50 text-blue-600',
    slate: 'bg-slate-100 text-slate-600',
  }[tone];
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
          <p className="mt-3 text-3xl font-black text-slate-950">{value}</p>
          <p className="mt-2 text-xs leading-5 text-slate-500">{hint}</p>
        </div>
        <span className={`rounded-2xl p-3 ${toneClass}`}>{icon}</span>
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<AnalyticsOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function loadAnalytics(nextDays = days) {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/analytics/overview?days=${nextDays}`, { cache: 'no-store' });
      const raw = await res.text();
      const json = raw ? JSON.parse(raw) as AnalyticsOverview : null;
      if (!res.ok || !json?.ok) throw new Error(json?.error || raw || 'Unable to load analytics.');
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load analytics.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAnalytics(days);
    const timer = setInterval(() => loadAnalytics(days), 60000);
    return () => clearInterval(timer);
  }, [days]);

  const totals = data?.totals || EMPTY_TOTALS;
  const actionClicks = (totals.whatsappClicks || 0) + (totals.phoneClicks || 0) + (totals.sellerProfileClicks || 0);
  const funnel = useMemo(() => [
    { label: 'Product views', value: totals.productViews },
    { label: 'Add to cart', value: totals.addToCart },
    { label: 'Checkout started', value: totals.checkoutStarted },
    { label: 'Payment initialized', value: totals.paymentInitialized },
    { label: 'Paid orders', value: totals.paidOrders },
  ], [totals]);
  const funnelMax = Math.max(1, ...funnel.map((item) => item.value));

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-slate-950 p-6 text-white shadow-sm sm:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-indigo-300/20 bg-indigo-400/10 px-3 py-1 text-xs font-semibold text-indigo-100">
              <BarChart3 className="h-4 w-4" /> Sedifex internal tracking
            </div>
            <h1 className="mt-5 max-w-4xl text-3xl font-black tracking-tight sm:text-4xl">See where customers come from and what they do on Sedifex Market.</h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300">
              Tracks visitors, traffic source, countries, devices, pages, products, stores, search terms, checkout funnel, paid orders, and WhatsApp/call clicks from Sedifex Market events.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <select value={days} onChange={(event) => setDays(Number(event.target.value))} className="rounded-2xl border border-white/10 bg-white px-4 py-3 text-sm font-bold text-slate-950 outline-none">
              <option value={7}>Last 7 days</option>
              <option value={30}>Last 30 days</option>
              <option value={90}>Last 90 days</option>
              <option value={365}>Last 365 days</option>
            </select>
            <button onClick={() => loadAnalytics(days)} className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-bold text-slate-950 hover:bg-slate-100">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </button>
          </div>
        </div>
      </section>

      {error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div> : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Visitors" value={numberText(totals.visitors)} hint={`${numberText(totals.sessions)} sessions tracked`} icon={<Users className="h-5 w-5" />} />
        <StatCard label="Page views" value={numberText(totals.pageViews)} hint={`${numberText(totals.productViews)} product views · ${numberText(totals.storeViews)} store views`} icon={<Activity className="h-5 w-5" />} tone="blue" />
        <StatCard label="Checkout started" value={numberText(totals.checkoutStarted)} hint={`${numberText(totals.addToCart)} add to cart actions`} icon={<ShoppingCart className="h-5 w-5" />} tone="amber" />
        <StatCard label="Paid orders" value={numberText(totals.paidOrders)} hint={`${totals.conversionRate.toFixed(1)}% checkout conversion`} icon={<Target className="h-5 w-5" />} tone="emerald" />
        <StatCard label="Revenue" value={money(totals.revenue)} hint="From paid integrationOrders" icon={<TrendingUp className="h-5 w-5" />} tone="emerald" />
        <StatCard label="Searches" value={numberText(totals.searchEvents)} hint="Search terms inside Sedifex Market" icon={<Search className="h-5 w-5" />} tone="slate" />
        <StatCard label="WhatsApp / calls" value={numberText(actionClicks)} hint={`${numberText(totals.whatsappClicks)} WhatsApp · ${numberText(totals.phoneClicks)} calls`} icon={<MousePointerClick className="h-5 w-5" />} tone="rose" />
        <StatCard label="Seller profile clicks" value={numberText(totals.sellerProfileClicks)} hint="Customers opening seller/store profiles" icon={<Store className="h-5 w-5" />} tone="indigo" />
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-slate-950">Checkout funnel</h2>
          <span className="text-xs font-semibold text-slate-500">Conversion: {totals.conversionRate.toFixed(1)}%</span>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-5">
          {funnel.map((item) => (
            <div key={item.label} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{item.label}</p>
              <p className="mt-2 text-2xl font-black text-slate-950">{numberText(item.value)}</p>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-white">
                <div className="h-full rounded-full bg-indigo-500" style={{ width: `${Math.max(5, (item.value / funnelMax) * 100)}%` }} />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <TopList title="Traffic sources" icon={<Globe2 className="h-4 w-4 text-indigo-500" />} items={data?.topTrafficSources} />
        <TopList title="Top countries" icon={<Globe2 className="h-4 w-4 text-emerald-500" />} items={data?.topCountries} />
        <TopList title="Devices" icon={<Smartphone className="h-4 w-4 text-blue-500" />} items={data?.topDevices} />
        <TopList title="Top pages" icon={<Activity className="h-4 w-4 text-slate-500" />} items={data?.topPages} />
        <TopList title="Top products" icon={<PackageSearch className="h-4 w-4 text-amber-500" />} items={data?.topProducts} />
        <TopList title="Top stores" icon={<Store className="h-4 w-4 text-purple-500" />} items={data?.topStores} />
        <TopList title="Search keywords" icon={<Search className="h-4 w-4 text-rose-500" />} items={data?.topSearchTerms} empty="No search terms tracked yet" />
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-slate-950">Recent analytics events</h2>
          <span className="text-xs font-semibold text-slate-500">Updated {data?.generatedAt ? new Date(data.generatedAt).toLocaleString() : '—'}</span>
        </div>
        <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
          <div className="hidden grid-cols-[0.8fr_1fr_0.8fr_0.8fr_1fr] gap-3 bg-slate-50 px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-500 lg:grid">
            <span>Event</span><span>Page / target</span><span>Source</span><span>Device</span><span>Context</span>
          </div>
          <div className="divide-y divide-slate-100">
            {(data?.recentEvents || []).length === 0 ? <p className="p-6 text-sm text-slate-500">No events yet. After deploying Sedifex Market, visits and clicks will start appearing here.</p> : null}
            {(data?.recentEvents || []).slice(0, 20).map((event) => (
              <div key={event.id} className="grid gap-2 px-4 py-3 text-sm lg:grid-cols-[0.8fr_1fr_0.8fr_0.8fr_1fr] lg:items-center">
                <span className="font-bold text-slate-950">{event.eventName}</span>
                <span className="min-w-0 truncate text-slate-600">{event.pagePath || event.actionTarget || '—'}</span>
                <span className="text-slate-600">{event.trafficSource || 'direct'} · {event.country || 'unknown'}</span>
                <span className="text-slate-600">{event.device || 'unknown'}</span>
                <span className="min-w-0 truncate text-slate-500">{event.productName || event.storeName || event.searchTerm || event.createdAtIso || '—'}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
