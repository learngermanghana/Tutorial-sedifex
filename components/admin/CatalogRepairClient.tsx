'use client';

import { FormEvent, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Hammer, RefreshCw, Search } from 'lucide-react';

type StoreOption = {
  id: string;
  name: string;
  city?: string;
  outOfSync?: number;
  listings?: number;
  products?: number;
  services?: number;
  courses?: number;
};

type RepairResult = {
  ok?: boolean;
  error?: string;
  storeId?: string;
  deletedListings?: number;
  scannedProducts?: number;
  skippedProducts?: number;
  writtenListings?: number;
};

function numberField(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

export default function CatalogRepairClient({ stores }: { stores: StoreOption[] }) {
  const [query, setQuery] = useState('');
  const [storeId, setStoreId] = useState(stores[0]?.id ?? '');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RepairResult | null>(null);

  const filteredStores = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return stores;
    return stores.filter((store) => [store.id, store.name, store.city].filter(Boolean).join(' ').toLowerCase().includes(normalized));
  }, [query, stores]);

  const selectedStore = stores.find((store) => store.id === storeId) ?? null;

  async function handleRepair(event: FormEvent) {
    event.preventDefault();
    if (!storeId.trim()) return;
    setLoading(true);
    setResult(null);

    try {
      const response = await fetch('/api/admin/catalog-repair', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ storeId: storeId.trim() }),
      });
      const data = await response.json().catch(() => ({})) as RepairResult;
      setResult(data);
    } catch (error) {
      setResult({ ok: false, error: error instanceof Error ? error.message : 'Unable to run catalog repair.' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <span className="rounded-2xl bg-indigo-50 p-3 text-indigo-600"><Search className="h-5 w-5" /></span>
          <div>
            <h2 className="text-lg font-semibold text-slate-950">Choose store</h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">Search by store name, city, or store ID. Then run a clean rebuild for only that store.</p>
          </div>
        </div>

        <div className="mt-5">
          <label className="text-sm font-medium text-slate-700" htmlFor="catalog-store-search">Search stores</label>
          <input
            id="catalog-store-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search store name or ID"
            className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100"
          />
        </div>

        <div className="mt-5 max-h-[520px] space-y-2 overflow-y-auto pr-1">
          {filteredStores.map((store) => {
            const active = store.id === storeId;
            return (
              <button
                key={store.id}
                type="button"
                onClick={() => setStoreId(store.id)}
                className={`w-full rounded-2xl border p-4 text-left transition ${active ? 'border-indigo-300 bg-indigo-50 ring-4 ring-indigo-100' : 'border-slate-200 bg-white hover:border-indigo-200 hover:bg-indigo-50/40'}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-950">{store.name}</p>
                    <p className="mt-1 truncate text-xs text-slate-500">{store.id}</p>
                    {store.city ? <p className="mt-1 text-xs text-slate-500">{store.city}</p> : null}
                  </div>
                  {numberField(store.outOfSync) > 0 ? (
                    <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-700">{store.outOfSync} out</span>
                  ) : (
                    <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700">ready</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">Repair public catalog</h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">This deletes old publicListings for the selected store and rebuilds clean product, service, and course listings from the source records.</p>
          </div>
          <span className="rounded-2xl bg-slate-100 p-3 text-slate-600"><Hammer className="h-5 w-5" /></span>
        </div>

        {selectedStore ? (
          <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-950">{selectedStore.name}</p>
            <p className="mt-1 break-all text-xs text-slate-500">{selectedStore.id}</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-4">
              <div className="rounded-xl bg-white p-3"><p className="text-xs text-slate-500">Listings</p><p className="text-lg font-semibold text-slate-950">{selectedStore.listings ?? 0}</p></div>
              <div className="rounded-xl bg-white p-3"><p className="text-xs text-slate-500">Products</p><p className="text-lg font-semibold text-slate-950">{selectedStore.products ?? 0}</p></div>
              <div className="rounded-xl bg-white p-3"><p className="text-xs text-slate-500">Services</p><p className="text-lg font-semibold text-slate-950">{selectedStore.services ?? 0}</p></div>
              <div className="rounded-xl bg-white p-3"><p className="text-xs text-slate-500">Courses</p><p className="text-lg font-semibold text-slate-950">{selectedStore.courses ?? 0}</p></div>
            </div>
          </div>
        ) : null}

        <form className="mt-6 space-y-4" onSubmit={handleRepair}>
          <div>
            <label className="text-sm font-medium text-slate-700" htmlFor="catalog-store-id">Store ID</label>
            <input
              id="catalog-store-id"
              value={storeId}
              onChange={(event) => setStoreId(event.target.value)}
              placeholder="Paste store ID"
              className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100"
            />
          </div>

          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-800">
            <div className="flex gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> <span>This affects production Firestore. Use it only when public listings are duplicated, stuck as draft, or showing under the wrong type.</span></div>
          </div>

          <button
            disabled={loading || !storeId.trim()}
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Hammer className="h-4 w-4" />}
            {loading ? 'Repairing catalog…' : 'Repair selected store catalog'}
          </button>
        </form>

        {result ? (
          <div className={`mt-6 rounded-2xl border p-4 ${result.ok ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-800'}`}>
            <div className="flex items-start gap-2">
              {result.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />}
              <div className="min-w-0">
                <p className="font-semibold">{result.ok ? 'Catalog repaired' : 'Repair failed'}</p>
                {result.ok ? (
                  <p className="mt-1 text-sm leading-6">
                    Deleted {result.deletedListings ?? 0} old public listings, scanned {result.scannedProducts ?? 0} source records, skipped {result.skippedProducts ?? 0}, and wrote {result.writtenListings ?? 0} clean listings.
                  </p>
                ) : (
                  <p className="mt-1 text-sm leading-6">{result.error ?? 'Unknown error.'}</p>
                )}
              </div>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
