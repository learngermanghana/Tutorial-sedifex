import CatalogRepairClient from '../../../components/admin/CatalogRepairClient';
import { listFirestoreDocuments } from '../../../lib/firebase-admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type StoreRecord = Record<string, unknown> & { id?: string };

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function numberField(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function countMap(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function storeName(store: StoreRecord) {
  return text(store.displayName) ?? text(store.name) ?? text(store.businessName) ?? text(store.storeName) ?? text(store.id) ?? 'Unnamed store';
}

async function loadStores() {
  try {
    const result = await listFirestoreDocuments('stores', 200);
    return (result.documents as StoreRecord[]).map((store) => {
      const counts = countMap(store.publicCatalogDocCount);
      return {
        id: String(store.id ?? ''),
        name: storeName(store),
        city: text(store.city) ?? text(store.town) ?? text(store.storeCity),
        outOfSync: numberField(store.publicCatalogOutOfSyncCount),
        listings: numberField(counts.listings),
        products: numberField(counts.products),
        services: numberField(counts.services),
        courses: numberField(counts.courses),
      };
    }).filter((store) => store.id).sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return [];
  }
}

export default async function CatalogRepairPage() {
  const stores = await loadStores();

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-slate-950 p-6 text-white shadow-sm sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.22em] text-indigo-200">Marketplace repair</p>
        <h2 className="mt-3 text-3xl font-bold tracking-tight">Repair public listings per store</h2>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">
          Use this when Sedifex Market shows duplicates, draft public listings, or courses/services/products under the wrong tab. Choose a store and rebuild its publicListings from the current source records.
        </p>
      </section>

      {stores.length === 0 ? (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-800">
          No stores loaded. Check that the admin Firebase environment variables are configured and the stores collection is readable.
        </section>
      ) : null}

      <CatalogRepairClient stores={stores} />
    </div>
  );
}
