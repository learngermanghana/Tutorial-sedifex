import Link from 'next/link';
import { ArrowLeft, Database, Hammer, PackageSearch, ShoppingBag, Store } from 'lucide-react';
import { SectionCard, StatusBadge } from '../../../../components/admin/ui';
import { getFirebaseEnvStatus, getFirestoreDocument, listFirestoreDocuments } from '../../../../lib/firebase-admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Params = Promise<{ storeId: string }>;
type DashboardRecord = Record<string, unknown> & {
  id?: string;
  path?: string;
  updateTime?: string | null;
  createTime?: string | null;
};

type StoreDocs = {
  profile: DashboardRecord | null;
  settings: DashboardRecord | null;
  catalogItems: DashboardRecord[];
  orders: DashboardRecord[];
  error: string | null;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function text(record: DashboardRecord | null | undefined, fields: string[], fallback = 'Not set') {
  if (!record) return fallback;
  for (const field of fields) {
    const value = record[field];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number') return String(value);
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  }
  return fallback;
}

function nested(record: DashboardRecord | null | undefined, path: string[]) {
  let current: unknown = record;
  for (const key of path) {
    const currentRecord = asRecord(current);
    if (!currentRecord) return undefined;
    current = currentRecord[key];
  }
  return current;
}

function nestedText(record: DashboardRecord | null | undefined, path: string[], fallback = 'Not set') {
  const value = nested(record, path);
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return fallback;
}

function numberField(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function countMap(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function storeName(profile: DashboardRecord | null, settings: DashboardRecord | null, fallback: string) {
  return text(profile, ['displayName', 'name', 'storeName', 'businessName'], text(settings, ['displayName', 'name', 'storeName', 'businessName'], fallback));
}

function isStoreCatalogItem(item: DashboardRecord, storeId: string) {
  return text(item, ['storeId', 'merchantId', 'businessId'], '') === storeId;
}

function isStoreOrder(order: DashboardRecord, storeId: string) {
  return text(order, ['storeId', 'merchantId', 'businessId'], '') === storeId;
}

function missingCatalogFields(item: DashboardRecord) {
  const missing = [
    text(item, ['name', 'title', 'productName', 'serviceName', 'courseName'], '') ? null : 'name',
    text(item, ['storeId', 'merchantId', 'businessId'], '') ? null : 'storeId',
    text(item, ['category', 'categoryName', 'categoryKey'], '') ? null : 'category',
    text(item, ['imageUrl', 'image', 'photoUrl', 'thumbnailUrl'], '') || Array.isArray(item.imageUrls) ? null : 'image',
    numberField(item.price) > 0 || numberField(item.fullFee) > 0 ? null : 'price',
  ].filter(Boolean);
  return missing.length;
}

function recordTime(record: DashboardRecord) {
  const value = record.updatedAt ?? record.updateTime ?? record.createdAt ?? record.createTime;
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  if (value && typeof value === 'object') {
    const candidate = value as { seconds?: unknown; _seconds?: unknown };
    const seconds = typeof candidate.seconds === 'number' ? candidate.seconds : typeof candidate._seconds === 'number' ? candidate._seconds : 0;
    return seconds * 1000;
  }
  return 0;
}

async function readCollection(collectionPath: string, limit = 100) {
  try {
    const result = await listFirestoreDocuments(collectionPath, limit);
    return result.documents as DashboardRecord[];
  } catch {
    return [] as DashboardRecord[];
  }
}

async function loadStore(storeId: string): Promise<StoreDocs> {
  const env = getFirebaseEnvStatus();
  if (!env.ready) {
    return { profile: null, settings: null, catalogItems: [], orders: [], error: 'Firebase envs are not ready in this deployment.' };
  }

  const [profile, settings, products, services, courses, catalogItems, orders] = await Promise.all([
    getFirestoreDocument(`stores/${storeId}`).catch(() => null),
    getFirestoreDocument(`storeSettings/${storeId}`).catch(() => null),
    readCollection('products', 200),
    readCollection('services', 200),
    readCollection('courses', 200),
    readCollection('catalogItems', 200),
    readCollection('integrationOrders', 100),
  ]);

  return {
    profile: profile as DashboardRecord | null,
    settings: settings as DashboardRecord | null,
    catalogItems: [...products, ...services, ...courses, ...catalogItems].filter((item) => isStoreCatalogItem(item, storeId)),
    orders: orders.filter((order) => isStoreOrder(order, storeId)),
    error: !profile && !settings ? 'Store not available in stores or storeSettings.' : null,
  };
}

function InfoCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 break-words text-lg font-bold text-slate-950">{value}</p>
    </div>
  );
}

export default async function StoreDetailPage({ params }: { params: Params }) {
  const { storeId } = await params;
  const decodedStoreId = decodeURIComponent(storeId);
  const result = await loadStore(decodedStoreId);
  const identity = result.profile || result.settings;
  const counts = countMap(identity?.publicCatalogDocCount);
  const catalogIssuesCount = result.catalogItems.reduce((sum: number, item) => sum + missingCatalogFields(item), 0);
  const recentOrders = [...result.orders].sort((a, b) => recordTime(b) - recordTime(a)).slice(0, 5);
  const shoppingConnected = nested(result.settings, ['googleShopping', 'connection', 'connected']) === true;
  const autoSyncEnabled = nested(result.settings, ['googleShopping', 'catalogSync', 'autoSyncEnabled']) === true;

  if (!identity) {
    return (
      <div className="space-y-6">
        <Link href="/admin/stores" className="inline-flex items-center gap-2 text-sm font-semibold text-indigo-600 hover:text-indigo-500">
          <ArrowLeft className="h-4 w-4" /> Back to stores
        </Link>
        <SectionCard title="Store not available">
          <p className="text-sm leading-6 text-slate-600">{result.error || 'This store could not be loaded.'}</p>
        </SectionCard>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link href="/admin/stores" className="inline-flex items-center gap-2 text-sm font-semibold text-indigo-600 hover:text-indigo-500">
        <ArrowLeft className="h-4 w-4" /> Back to stores
      </Link>

      <section className="rounded-3xl border border-slate-200 bg-slate-950 p-6 text-white shadow-sm sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-indigo-300/20 bg-indigo-400/10 px-3 py-1 text-xs font-semibold text-indigo-100">
              <Store className="h-4 w-4" /> Store control page
            </div>
            <h2 className="mt-5 text-3xl font-bold tracking-tight sm:text-4xl">{storeName(result.profile, result.settings, decodedStoreId)}</h2>
            <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-300">Store ID: {decodedStoreId}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <StatusBadge tone={shoppingConnected ? 'green' : 'slate'}>Shopping {shoppingConnected ? 'On' : 'Off'}</StatusBadge>
            <StatusBadge tone={autoSyncEnabled ? 'green' : 'slate'}>Auto sync {autoSyncEnabled ? 'On' : 'Off'}</StatusBadge>
            <StatusBadge tone={numberField(identity.publicCatalogOutOfSyncCount) > 0 ? 'yellow' : 'green'}>{numberField(identity.publicCatalogOutOfSyncCount)} out of sync</StatusBadge>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <InfoCard label="Public listings" value={numberField(counts.listings)} />
        <InfoCard label="Products" value={numberField(counts.products)} />
        <InfoCard label="Services" value={numberField(counts.services)} />
        <InfoCard label="Courses" value={numberField(counts.courses)} />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-6">
          <SectionCard title="Store basics">
            <div className="grid gap-3 sm:grid-cols-2">
              <InfoCard label="Contact" value={text(identity, ['email', 'ownerEmail', 'adminEmail', 'supportEmail'])} />
              <InfoCard label="Phone" value={text(identity, ['phone', 'contactPhone', 'businessPhone', 'whatsappNumber'])} />
              <InfoCard label="City" value={text(identity, ['city', 'town', 'storeCity'])} />
              <InfoCard label="Catalog issues" value={catalogIssuesCount} />
            </div>
          </SectionCard>

          <SectionCard title="Marketplace catalog repair">
            <div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex items-center gap-2 font-semibold text-slate-950">
                    <Hammer className="h-5 w-5 text-indigo-600" /> Repair this store from the Catalog Repair page
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    Use this when publicListings have duplicates, draft records, or wrong product/service/course type.
                  </p>
                </div>
                <Link href="/admin/catalog-repair" className="inline-flex shrink-0 items-center justify-center rounded-2xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-indigo-500">
                  Open Catalog Repair
                </Link>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Catalog sample for this store">
            {result.catalogItems.length === 0 ? (
              <p className="text-sm leading-6 text-slate-600">No catalog records were found in the first loaded products, services, courses, or catalogItems records.</p>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-slate-200">
                <div className="grid grid-cols-[1.3fr_0.7fr_0.7fr] bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <span>Item</span><span>Type</span><span>Issues</span>
                </div>
                <div className="divide-y divide-slate-200">
                  {result.catalogItems.slice(0, 10).map((item) => (
                    <div key={String(item.path || item.id)} className="grid grid-cols-[1.3fr_0.7fr_0.7fr] items-center px-4 py-3 text-sm">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-slate-950">{text(item, ['name', 'title', 'productName', 'serviceName', 'courseName'], 'Untitled item')}</p>
                        <p className="truncate text-xs text-slate-500">{String(item.id || '')}</p>
                      </div>
                      <StatusBadge tone="slate">{text(item, ['listingType', 'itemType', 'type'], 'item')}</StatusBadge>
                      <StatusBadge tone={missingCatalogFields(item) > 0 ? 'yellow' : 'green'}>{missingCatalogFields(item)}</StatusBadge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </SectionCard>
        </div>

        <div className="space-y-6">
          <SectionCard title="Google Shopping setup">
            <div className="space-y-3 text-sm text-slate-600">
              <InfoCard label="Connection" value={nestedText(result.settings, ['googleShopping', 'connection', 'connected'])} />
              <InfoCard label="Merchant ID" value={nestedText(result.settings, ['googleShopping', 'connection', 'merchantId'])} />
              <InfoCard label="Auto sync" value={nestedText(result.settings, ['googleShopping', 'catalogSync', 'autoSyncEnabled'])} />
              <InfoCard label="Integration base URL" value={nestedText(result.settings, ['googleShopping', 'catalogSync', 'integrationBaseUrl'])} />
            </div>
          </SectionCard>

          <SectionCard title="Recent orders">
            {recentOrders.length === 0 ? (
              <p className="text-sm leading-6 text-slate-600">No recent orders found for this store.</p>
            ) : (
              <div className="space-y-3">
                {recentOrders.map((order) => (
                  <div key={String(order.id || order.path)} className="rounded-2xl bg-slate-50 p-4 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-semibold text-slate-950">{text(order, ['customerName', 'customerEmail', 'sourceLabel', 'id'], 'Order')}</p>
                      <StatusBadge tone={text(order, ['paymentStatus', 'orderStatus', 'status'], '').toLowerCase().includes('paid') ? 'green' : 'slate'}>{text(order, ['paymentStatus', 'orderStatus', 'status'], 'Unknown')}</StatusBadge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard title="Raw admin data">
            <Link href="/api/admin/firestore/store-settings" className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
              <Database className="h-4 w-4" /> Open store settings API
            </Link>
          </SectionCard>
        </div>
      </section>
    </div>
  );
}
