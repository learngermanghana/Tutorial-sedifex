import Link from 'next/link';
import { Activity, AlertTriangle, ArrowUpRight, Clock3, Package, Search, ShoppingBag, Store, Users } from 'lucide-react';
import { SectionCard, StatCard, StatusBadge } from '../../../components/admin/ui';
import { getFirebaseEnvStatus, listFirestoreDocuments } from '../../../lib/firebase-admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type SearchParams = Promise<{ q?: string }>;
type RecordDoc = Record<string, unknown> & { id?: string; path?: string; updateTime?: string | null; createTime?: string | null };

type ModuleStat = {
  id: string;
  label: string;
  count: number;
  amount: number;
  lastAt: number | null;
};

type StoreActivityRow = {
  id: string;
  name: string;
  contact: string;
  phone: string;
  location: string;
  status: 'active' | 'warm' | 'quiet' | 'empty';
  lastAt: number | null;
  totalRecords: number;
  revenue: number;
  modules: ModuleStat[];
  activeModules: string[];
};

type ActivityData = {
  ok: boolean;
  error: string | null;
  stores: StoreActivityRow[];
  collectionErrors: Record<string, string>;
};

const ACTIVITY_COLLECTIONS = [
  { id: 'storeProfiles', label: 'Store profile', collection: 'stores', amount: false },
  { id: 'storeSettings', label: 'Store settings', collection: 'storeSettings', amount: false },
  { id: 'orders', label: 'Online / Quick Pay orders', collection: 'integrationOrders', amount: true },
  { id: 'bookings', label: 'Website bookings', collection: 'integrationBookings', amount: true },
  { id: 'customers', label: 'Customers', collection: 'customers', amount: false },
  { id: 'publicListings', label: 'Marketplace listings', collection: 'publicListings', amount: false },
  { id: 'publicProducts', label: 'Public products', collection: 'publicProducts', amount: false },
  { id: 'products', label: 'Products', collection: 'products', amount: false },
  { id: 'services', label: 'Services', collection: 'services', amount: false },
  { id: 'courses', label: 'Courses', collection: 'courses', amount: false },
  { id: 'catalogItems', label: 'Catalog items', collection: 'catalogItems', amount: false },
  { id: 'webhookDeliveries', label: 'Webhook deliveries', collection: 'webhookDeliveries', amount: false },
] as const;

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function valueText(value: unknown, fallback = '') {
  if (typeof value === 'string') return value.trim() || fallback;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return fallback;
}

function fieldText(record: RecordDoc | null | undefined, fields: string[], fallback = '') {
  if (!record) return fallback;
  for (const field of fields) {
    const text = valueText(record[field], '');
    if (text) return text;
  }
  return fallback;
}

function nestedValue(record: RecordDoc | null | undefined, path: string[]) {
  let current: unknown = record;
  for (const key of path) {
    const currentObject = asRecord(current);
    if (!currentObject) return undefined;
    current = currentObject[key];
  }
  return current;
}

function nestedText(record: RecordDoc | null | undefined, paths: string[][], fallback = '') {
  for (const path of paths) {
    const text = valueText(nestedValue(record, path), '');
    if (text) return text;
  }
  return fallback;
}

function timestampToMillis(value: unknown): number | null {
  if (!value) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.getTime();

  if (typeof value === 'object') {
    const candidate = value as { seconds?: unknown; _seconds?: unknown; toMillis?: unknown };
    if (typeof candidate.toMillis === 'function') {
      const millis = candidate.toMillis();
      return typeof millis === 'number' && Number.isFinite(millis) ? millis : null;
    }
    const seconds = typeof candidate.seconds === 'number' ? candidate.seconds : typeof candidate._seconds === 'number' ? candidate._seconds : null;
    return seconds !== null ? seconds * 1000 : null;
  }

  return null;
}

function recordTime(record: RecordDoc) {
  return (
    timestampToMillis(record.lastActivityAt) ??
    timestampToMillis(record.paymentUpdatedAt) ??
    timestampToMillis(record.deliveredAt) ??
    timestampToMillis(record.completedAt) ??
    timestampToMillis(record.updatedAt) ??
    timestampToMillis(record.updated_at) ??
    timestampToMillis(record.updateTime) ??
    timestampToMillis(record.createdAt) ??
    timestampToMillis(record.created_at) ??
    timestampToMillis(record.orderDate) ??
    timestampToMillis(record.order_date) ??
    timestampToMillis(record.createTime)
  );
}

function later(current: number | null, next: number | null) {
  if (current === null) return next;
  if (next === null) return current;
  return next > current ? next : current;
}

function storeIdFromRecord(record: RecordDoc, collectionId: string) {
  const direct = fieldText(record, ['storeId', 'store_id', 'merchantId', 'merchant_id', 'businessId', 'business_id', 'workspaceId', 'workspace_id'], '');
  if (direct) return direct;

  const metadata = asRecord(record.metadata);
  const metadataStore = valueText(metadata?.storeId ?? metadata?.store_id ?? metadata?.merchantId ?? metadata?.merchant_id, '');
  if (metadataStore) return metadataStore;

  if (collectionId === 'storeProfiles' || collectionId === 'storeSettings') return valueText(record.id, '');
  return '';
}

function storeName(record: RecordDoc | null | undefined, fallback: string) {
  return fieldText(record, ['displayName', 'storeName', 'name', 'businessName', 'merchantName', 'profileName', 'ownerName'], fallback);
}

function storeContact(record: RecordDoc | null | undefined) {
  return fieldText(record, ['publicEmail', 'email', 'ownerEmail', 'adminEmail', 'supportEmail', 'contactEmail', 'businessEmail'], 'Not set');
}

function storePhone(record: RecordDoc | null | undefined) {
  return fieldText(record, ['publicPhone', 'phone', 'phoneNumber', 'contactPhone', 'storePhone', 'whatsappNumber', 'businessPhone'], 'Not set');
}

function storeLocation(record: RecordDoc | null | undefined) {
  const address = fieldText(record, ['addressLine1', 'address', 'businessAddress'], '');
  const city = fieldText(record, ['city', 'storeCity', 'town', 'location'], '');
  const country = fieldText(record, ['country', 'storeCountry'], '');
  return [address, city, country].filter(Boolean).join(', ') || 'Not set';
}

function orderStatus(record: RecordDoc) {
  return [record.paymentStatus, record.payment_status, record.orderStatus, record.order_status, record.fulfillmentStatus, record.deliveryStatus, record.status]
    .map((value) => (typeof value === 'string' ? value.trim().toLowerCase() : ''))
    .filter(Boolean)
    .join(' ');
}

function amountFromRecord(record: RecordDoc) {
  const payment = asRecord(record.payment);
  const minor = record.amountMinor ?? record.amount_minor ?? payment?.amountMinor ?? payment?.amount_minor;
  if (typeof minor === 'number' && Number.isFinite(minor) && minor > 0) return minor / 100;

  const candidates = [
    payment?.customerTotal,
    payment?.amount,
    record.customerTotal,
    record.finalTotal,
    record.final_total,
    record.amountPaid,
    record.amount_paid,
    record.confirmedAmount,
    record.totalAmount,
    record.total_amount,
    record.grandTotal,
    record.total,
    record.amount,
  ];
  const value = candidates.find((item) => typeof item === 'number' && Number.isFinite(item));
  return typeof value === 'number' ? value : 0;
}

function shouldCountRevenue(record: RecordDoc) {
  const status = orderStatus(record);
  if (!status) return true;
  if (/failed|cancelled|canceled|declined|abandoned|refunded/.test(status)) return false;
  return /paid|success|successful|confirmed|delivered|completed|paid_cash/.test(status);
}

function formatMoney(value: number) {
  return `GHS ${value.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(value: number | null) {
  if (!value) return 'No activity yet';
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

function ageLabel(value: number | null) {
  if (!value) return 'No activity';
  const minutes = Math.max(0, Math.round((Date.now() - value) / 60000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function activityStatus(lastAt: number | null): StoreActivityRow['status'] {
  if (!lastAt) return 'empty';
  const days = (Date.now() - lastAt) / 86400000;
  if (days <= 2) return 'active';
  if (days <= 14) return 'warm';
  return 'quiet';
}

function statusTone(status: StoreActivityRow['status']): 'green' | 'yellow' | 'red' | 'slate' {
  if (status === 'active') return 'green';
  if (status === 'warm') return 'yellow';
  if (status === 'quiet') return 'red';
  return 'slate';
}

function statusLabel(status: StoreActivityRow['status']) {
  if (status === 'active') return 'Active';
  if (status === 'warm') return 'Warm';
  if (status === 'quiet') return 'Quiet';
  return 'No activity';
}

function searchableText(row: StoreActivityRow) {
  return [row.name, row.id, row.contact, row.phone, row.location, row.activeModules.join(' ')].join(' ').toLowerCase();
}

async function safeRead(collection: string, limit = 500) {
  try {
    const result = await listFirestoreDocuments(collection, limit);
    return { ok: true, error: null, documents: result.documents as RecordDoc[] };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : `Unable to read ${collection}.`, documents: [] as RecordDoc[] };
  }
}

function ensureModule(map: Map<string, ModuleStat>, id: string, label: string) {
  const existing = map.get(id);
  if (existing) return existing;
  const created = { id, label, count: 0, amount: 0, lastAt: null };
  map.set(id, created);
  return created;
}

async function loadActivityData(): Promise<ActivityData> {
  const env = getFirebaseEnvStatus();
  if (!env.ready) {
    return { ok: false, error: 'Firebase environment variables are not ready in this deployment.', stores: [], collectionErrors: {} };
  }

  const results = await Promise.all(ACTIVITY_COLLECTIONS.map((item) => safeRead(item.collection, 600)));
  const collectionErrors: Record<string, string> = {};
  const storeProfiles = new Map<string, RecordDoc>();
  const storeModules = new Map<string, Map<string, ModuleStat>>();

  ACTIVITY_COLLECTIONS.forEach((collectionConfig, index) => {
    const result = results[index];
    if (!result.ok && result.error) collectionErrors[collectionConfig.collection] = result.error;

    result.documents.forEach((record) => {
      const storeId = storeIdFromRecord(record, collectionConfig.id);
      if (!storeId) return;

      if (collectionConfig.id === 'storeProfiles') {
        const existing = storeProfiles.get(storeId);
        storeProfiles.set(storeId, { ...(existing || {}), ...record, id: storeId });
      }

      if (collectionConfig.id === 'storeSettings') {
        const existing = storeProfiles.get(storeId);
        storeProfiles.set(storeId, { ...record, ...(existing || {}), id: storeId });
      }

      const modules = storeModules.get(storeId) || new Map<string, ModuleStat>();
      const module = ensureModule(modules, collectionConfig.id, collectionConfig.label);
      module.count += 1;
      module.lastAt = later(module.lastAt, recordTime(record));
      if (collectionConfig.amount && shouldCountRevenue(record)) {
        module.amount += amountFromRecord(record);
      }
      storeModules.set(storeId, modules);
    });
  });

  const allStoreIds = new Set([...storeProfiles.keys(), ...storeModules.keys()]);
  const stores = [...allStoreIds].map((storeId) => {
    const profile = storeProfiles.get(storeId) || { id: storeId };
    const modules = [...(storeModules.get(storeId)?.values() || [])].filter((module) => module.count > 0).sort((a, b) => b.count - a.count);
    const lastAt = modules.map((module) => module.lastAt).reduce(later, recordTime(profile));
    const totalRecords = modules.reduce((sum, module) => sum + module.count, 0);
    const revenue = modules.reduce((sum, module) => sum + module.amount, 0);

    return {
      id: storeId,
      name: storeName(profile, storeId),
      contact: storeContact(profile),
      phone: storePhone(profile),
      location: storeLocation(profile),
      status: activityStatus(lastAt),
      lastAt,
      totalRecords,
      revenue,
      modules,
      activeModules: modules.map((module) => module.label),
    } satisfies StoreActivityRow;
  }).sort((a, b) => (b.lastAt || 0) - (a.lastAt || 0));

  return {
    ok: true,
    error: null,
    stores,
    collectionErrors,
  };
}

export default async function StoreActivityPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const query = (params.q || '').trim().toLowerCase();
  const data = await loadActivityData();
  const stores = query ? data.stores.filter((store) => searchableText(store).includes(query)) : data.stores;
  const activeStores = data.stores.filter((store) => store.status === 'active' || store.status === 'warm').length;
  const totalRecords = data.stores.reduce((sum, store) => sum + store.totalRecords, 0);
  const totalRevenue = data.stores.reduce((sum, store) => sum + store.revenue, 0);
  const topModules = ACTIVITY_COLLECTIONS.map((config) => {
    const count = data.stores.reduce((sum, store) => sum + (store.modules.find((module) => module.id === config.id)?.count || 0), 0);
    return { ...config, count };
  }).filter((module) => module.count > 0).sort((a, b) => b.count - a.count).slice(0, 8);

  return (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Stores tracked" value={data.ok ? String(data.stores.length) : 'Setup'} delta={data.ok ? `${activeStores} active or warm` : 'Database not ready'} />
        <StatCard label="Tracked records" value={data.ok ? String(totalRecords) : '—'} delta="Orders, catalog, customers, setup" />
        <StatCard label="Tracked revenue" value={data.ok ? formatMoney(totalRevenue) : '—'} delta="Paid/readable order records" />
        <StatCard label="Module types" value={data.ok ? String(topModules.length) : '—'} delta="Collections with activity" />
      </section>

      {data.error ? (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <div className="flex gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="font-semibold">Store activity is not available yet.</p>
              <p className="mt-1 leading-6">{data.error}</p>
            </div>
          </div>
        </section>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[1.8fr_0.8fr]">
        <SectionCard
          title="Who is using what"
          action={<Link href="/admin/orders" className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-500">Open orders <ArrowUpRight className="h-3.5 w-3.5" /></Link>}
        >
          <form className="mb-4 flex flex-col gap-3 sm:flex-row" action="/admin/store-activity">
            <label className="relative flex-1">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                name="q"
                defaultValue={params.q || ''}
                placeholder="Search by store, email, phone, location, or module"
                className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-sm text-slate-900 outline-none transition focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100"
              />
            </label>
            <button className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-bold text-white transition hover:bg-slate-800">Search</button>
          </form>

          <div className="overflow-hidden rounded-2xl border border-slate-200">
            <div className="grid grid-cols-[1.3fr_0.65fr_0.9fr_1.1fr_0.65fr_0.7fr] bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 max-xl:hidden">
              <span>Store</span><span>Status</span><span>Last activity</span><span>Modules used</span><span>Records</span><span>Revenue</span>
            </div>
            <div className="divide-y divide-slate-200">
              {stores.length === 0 ? (
                <div className="p-8 text-center text-sm text-slate-500">No store activity matches this search.</div>
              ) : stores.map((store) => (
                <div key={store.id} className="grid gap-3 px-4 py-4 text-sm transition hover:bg-indigo-50/60 xl:grid-cols-[1.3fr_0.65fr_0.9fr_1.1fr_0.65fr_0.7fr] xl:items-center">
                  <Link href={`/admin/stores/${encodeURIComponent(store.id)}`} className="flex min-w-0 items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600"><Store className="h-4 w-4" /></span>
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-slate-950">{store.name}</p>
                      <p className="truncate text-xs text-slate-500">{store.contact} · {store.phone}</p>
                      <p className="truncate text-xs text-slate-400">{store.id}</p>
                    </div>
                  </Link>
                  <div><StatusBadge tone={statusTone(store.status)}>{statusLabel(store.status)}</StatusBadge></div>
                  <div className="text-slate-600">
                    <p className="font-medium text-slate-900">{ageLabel(store.lastAt)}</p>
                    <p className="text-xs text-slate-500">{formatDate(store.lastAt)}</p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {store.modules.length === 0 ? <span className="text-xs text-slate-400">No module usage yet</span> : null}
                    {store.modules.slice(0, 6).map((module) => (
                      <span key={module.id} className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700 ring-1 ring-inset ring-slate-200">{module.label}: {module.count}</span>
                    ))}
                    {store.modules.length > 6 ? <span className="text-xs text-slate-500">+{store.modules.length - 6} more</span> : null}
                  </div>
                  <div className="font-semibold text-slate-950">{store.totalRecords}</div>
                  <div className="font-semibold text-slate-950">{formatMoney(store.revenue)}</div>
                </div>
              ))}
            </div>
          </div>
        </SectionCard>

        <div className="space-y-6">
          <SectionCard title="Most used modules">
            <div className="space-y-3">
              {topModules.length === 0 ? <p className="text-sm text-slate-500">No module activity detected yet.</p> : null}
              {topModules.map((module) => (
                <div key={module.id} className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3 text-sm">
                  <span className="font-medium text-slate-700">{module.label}</span>
                  <StatusBadge tone="blue">{module.count}</StatusBadge>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="What this page tracks">
            <div className="grid gap-3 text-sm text-slate-600">
              <div className="flex gap-3 rounded-2xl bg-slate-50 p-4"><Store className="h-5 w-5 text-indigo-500" /><span>Store profiles and store settings.</span></div>
              <div className="flex gap-3 rounded-2xl bg-slate-50 p-4"><ShoppingBag className="h-5 w-5 text-indigo-500" /><span>Online orders, Quick Pay, booking payments, and revenue signals.</span></div>
              <div className="flex gap-3 rounded-2xl bg-slate-50 p-4"><Package className="h-5 w-5 text-indigo-500" /><span>Products, services, courses, public listings, and catalog items.</span></div>
              <div className="flex gap-3 rounded-2xl bg-slate-50 p-4"><Users className="h-5 w-5 text-indigo-500" /><span>Customer and webhook delivery activity when those collections exist.</span></div>
            </div>
          </SectionCard>

          {Object.keys(data.collectionErrors).length > 0 ? (
            <SectionCard title="Unreadable collections">
              <div className="space-y-2 text-xs text-amber-700">
                {Object.entries(data.collectionErrors).map(([collection, error]) => (
                  <p key={collection} className="rounded-xl bg-amber-50 p-3"><strong>{collection}</strong>: {error}</p>
                ))}
              </div>
            </SectionCard>
          ) : null}

          <SectionCard title="Next improvement">
            <div className="flex gap-3 rounded-2xl bg-indigo-50 p-4 text-sm text-indigo-900">
              <Activity className="h-5 w-5 shrink-0" />
              <p>For exact click-by-click analytics, add a small event logger to the store dashboard later. This page already shows activity from existing business records.</p>
            </div>
          </SectionCard>
        </div>
      </section>
    </div>
  );
}
