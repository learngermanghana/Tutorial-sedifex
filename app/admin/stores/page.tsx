import Link from 'next/link';
import { AlertTriangle, ArrowUpRight, Database, Store } from 'lucide-react';
import { SectionCard, StatCard, StatusBadge } from '../../../components/admin/ui';
import { getFirebaseEnvStatus, listFirestoreDocuments } from '../../../lib/firebase-admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type StoreRecord = Record<string, unknown> & { id?: string; path?: string; updateTime?: string | null };

function objectValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function nestedValue(store: StoreRecord, keys: string[]) {
  let current: unknown = store;
  for (const key of keys) {
    const currentObject = objectValue(current);
    if (!currentObject) return undefined;
    current = currentObject[key];
  }
  return current;
}

function fieldText(store: StoreRecord, fields: string[], fallback = 'Not set') {
  for (const field of fields) {
    const value = store[field];
    if (typeof value === 'string' && value.trim()) return value;
    if (typeof value === 'number') return String(value);
  }
  return fallback;
}

function storeName(store: StoreRecord) {
  return fieldText(store, ['storeName', 'name', 'businessName', 'displayName', 'merchantName', 'id'], 'Unnamed store');
}

function storeContact(store: StoreRecord) {
  return fieldText(store, ['owner', 'ownerName', 'adminName', 'email', 'ownerEmail'], 'Not set');
}

function storeLocation(store: StoreRecord) {
  const city = fieldText(store, ['city'], '');
  const country = fieldText(store, ['country'], '');
  return [city, country].filter(Boolean).join(', ') || fieldText(store, ['location', 'address', 'businessAddress'], 'Not set');
}

function shoppingConnected(store: StoreRecord) {
  return nestedValue(store, ['googleShopping', 'connection', 'connected']) === true;
}

function autoSyncEnabled(store: StoreRecord) {
  return nestedValue(store, ['googleShopping', 'catalogSync', 'autoSyncEnabled']) === true;
}

function formatDate(value: unknown) {
  if (typeof value !== 'string') return '—';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
}

async function loadStores() {
  const env = getFirebaseEnvStatus();
  if (!env.ready) {
    return { ok: false, error: 'Firebase envs are not ready in Vercel.', stores: [] as StoreRecord[] };
  }

  try {
    const result = await listFirestoreDocuments('storeSettings', 100);
    return { ok: true, error: null, stores: result.documents as StoreRecord[] };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Unable to load store data.',
      stores: [] as StoreRecord[],
    };
  }
}

export default async function StoresPage() {
  const result = await loadStores();
  const stores = result.stores;
  const connectedCount = stores.filter(shoppingConnected).length;
  const syncCount = stores.filter(autoSyncEnabled).length;
  const firstStore = stores[0] || null;

  const stats = [
    { label: 'Total stores', value: result.ok ? String(stores.length) : 'Setup', delta: result.ok ? 'Loaded from storeSettings' : 'Database not ready' },
    { label: 'Shopping connected', value: result.ok ? String(connectedCount) : '—', delta: 'Google Shopping enabled' },
    { label: 'Auto sync enabled', value: result.ok ? String(syncCount) : '—', delta: 'Catalog sync active' },
    { label: 'Need review', value: result.ok ? String(stores.length - connectedCount) : '—', delta: 'Not connected yet' },
  ];

  return (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => <StatCard key={stat.label} {...stat} />)}
      </section>

      {result.error ? (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <div className="flex gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="font-semibold">Store data is not available yet.</p>
              <p className="mt-1 leading-6">{result.error}</p>
            </div>
          </div>
        </section>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[1.7fr_0.9fr]">
        <SectionCard
          title="Store directory"
          action={<Link href="/api/admin/firestore/store-settings" className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-500">Raw data <ArrowUpRight className="h-3.5 w-3.5" /></Link>}
        >
          <div className="overflow-hidden rounded-2xl border border-slate-200">
            <div className="grid grid-cols-[1.3fr_0.9fr_0.9fr_0.8fr] bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 max-lg:hidden">
              <span>Store</span><span>Contact</span><span>Location</span><span>Integration</span>
            </div>
            <div className="divide-y divide-slate-200">
              {stores.length === 0 ? (
                <div className="p-8 text-center text-sm text-slate-500">No storeSettings records found.</div>
              ) : stores.map((store) => (
                <div key={store.path || store.id} className="grid gap-3 px-4 py-4 text-sm transition hover:bg-slate-50 lg:grid-cols-[1.3fr_0.9fr_0.9fr_0.8fr] lg:items-center">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600"><Store className="h-4 w-4" /></span>
                    <div className="min-w-0"><p className="truncate font-semibold text-slate-950">{storeName(store)}</p><p className="truncate text-xs text-slate-500">{store.id || 'No ID'}</p></div>
                  </div>
                  <p className="truncate text-slate-600">{storeContact(store)}</p>
                  <p className="truncate text-slate-600">{storeLocation(store)}</p>
                  <StatusBadge tone={shoppingConnected(store) ? 'green' : 'slate'}>{shoppingConnected(store) ? 'Connected' : 'Not connected'}</StatusBadge>
                </div>
              ))}
            </div>
          </div>
        </SectionCard>

        <div className="space-y-6">
          <SectionCard title="Store preview">
            {firstStore ? (
              <div className="space-y-4 text-sm">
                <div className="rounded-2xl bg-slate-950 p-5 text-white">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-200">Selected store</p>
                  <h3 className="mt-2 text-xl font-bold">{storeName(firstStore)}</h3>
                  <p className="mt-1 text-xs text-slate-400">{firstStore.id}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Contact</p><p className="mt-1 font-semibold text-slate-950">{storeContact(firstStore)}</p></div>
                <div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Last updated</p><p className="mt-1 font-semibold text-slate-950">{formatDate(firstStore.updateTime)}</p></div>
              </div>
            ) : <p className="text-sm text-slate-500">No store selected yet.</p>}
          </SectionCard>

          <SectionCard title="Next upgrade">
            <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
              <div className="flex items-center gap-2 font-semibold text-slate-950"><Database className="h-4 w-4 text-indigo-600" />Store detail page</div>
              <p className="mt-2 leading-6">Next we should add a page for one store so you can inspect products, bookings, checkout setup, and integrations.</p>
            </div>
          </SectionCard>
        </div>
      </section>
    </div>
  );
}
