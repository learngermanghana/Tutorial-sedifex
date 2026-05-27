import Link from 'next/link';
import { Activity, Banknote, CreditCard, Database, Package, ReceiptText, Store, Users } from 'lucide-react';
import { SectionCard, StatCard, StatusBadge } from '../../../components/admin/ui';
import { getFirebaseEnvStatus, listFirestoreCollectionGroupDocuments, listFirestoreDocuments } from '../../../lib/firebase-admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type AdminRecord = Record<string, unknown> & {
  id?: string;
  path?: string;
  createTime?: string | null;
  updateTime?: string | null;
};

type ActivityRow = {
  id: string;
  storeId: string;
  storeName: string;
  type: 'pos' | 'online' | 'booking' | 'cash';
  label: string;
  reference: string;
  customerName: string;
  itemName: string;
  amount: number;
  currency: string;
  paymentStatus: string;
  orderStatus: string;
  settlementScope: 'sedifex_settlement' | 'store_only' | 'pos';
  createdAt: string | null;
};

type StoreSummary = {
  storeId: string;
  storeName: string;
  activityCount: number;
  activityValue: number;
  settlementValue: number;
  storeOnlyValue: number;
  posValue: number;
  customers: number;
  products: number;
  lastActivityAt: string | null;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function text(value: unknown, fallback = '') {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (typeof value === 'number') return String(value);
  return fallback;
}

function numberValue(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function timestampToIso(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === 'string') {
    const time = Date.parse(value);
    return Number.isNaN(time) ? value : new Date(time).toISOString();
  }
  if (typeof value === 'number') return new Date(value).toISOString();
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') {
    const candidate = value as { seconds?: unknown; _seconds?: unknown; toDate?: unknown };
    if (typeof candidate.toDate === 'function') {
      const date = (candidate.toDate as () => Date)();
      return date instanceof Date ? date.toISOString() : null;
    }
    const seconds = typeof candidate.seconds === 'number' ? candidate.seconds : typeof candidate._seconds === 'number' ? candidate._seconds : null;
    if (seconds !== null) return new Date(seconds * 1000).toISOString();
  }
  return null;
}

function timeValue(value: string | null) {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function formatDate(value: string | null) {
  if (!value) return '—';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
}

function formatMoney(value: number, currency = 'GHS') {
  return `${currency || 'GHS'} ${value.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function firstItem(record: AdminRecord) {
  const items = Array.isArray(record.items) ? record.items : Array.isArray(record.cart) ? record.cart : [];
  return asRecord(items[0]);
}

function readAmount(record: AdminRecord) {
  const payment = asRecord(record.payment);
  const pricing = asRecord(record.pricingSnapshot);
  const pricingSnake = asRecord(record.pricing_snapshot);
  const amountMinor = numberValue(record.amountMinor, 0);
  if (amountMinor > 0) return amountMinor / 100;
  const finalMinor = numberValue(pricing.final_total_minor ?? pricing.finalTotalMinor ?? pricingSnake.final_total_minor ?? pricingSnake.finalTotalMinor, 0);
  if (finalMinor > 0) return finalMinor / 100;
  const raw = numberValue(
    record.amountPaid ??
      record.amount_paid ??
      record.confirmedAmount ??
      record.amount ??
      record.total ??
      record.grandTotal ??
      record.finalTotal ??
      record.final_total ??
      payment.customerTotal ??
      payment.amount ??
      pricing.final_total ??
      pricing.finalTotal ??
      pricingSnake.final_total ??
      pricingSnake.finalTotal,
    0,
  );
  return raw > 999 && (pricing.final_total || pricingSnake.final_total) ? raw / 100 : raw;
}

function normalizeSourceChannel(record: AdminRecord) {
  const metadata = asRecord(record.metadata);
  const raw = text(record.sourceChannel ?? record.source_channel ?? metadata.sourceChannel ?? record.source, 'sedifex_market')
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/-/g, '_');
  if (raw.includes('quick_pay_cash')) return 'quick_pay_cash';
  if (raw.includes('website') || raw.includes('client') || raw.includes('wordpress')) return 'client_website';
  if (raw.includes('market')) return 'sedifex_market';
  return raw || 'sedifex_market';
}

function isStoreOnlyCash(record: AdminRecord) {
  const payment = asRecord(record.payment);
  const joined = [
    record.paymentCollectionMode,
    record.payment_collection_mode,
    record.paymentMethod,
    record.payment_method,
    record.paymentProvider,
    record.payment_provider,
    record.paymentStatus,
    record.payment_status,
    normalizeSourceChannel(record),
    payment.mode,
    payment.provider,
  ]
    .map((value) => text(value).toLowerCase())
    .join(' ');

  return record.storeOnly === true || record.excludedFromSedifexSettlement === true || joined.includes('quick_pay_cash') || joined.includes('cash');
}

function statusText(record: AdminRecord) {
  return text(record.paymentStatus ?? record.payment_status ?? asRecord(record.payment).status ?? record.status, 'pending');
}

function orderStatusText(record: AdminRecord) {
  return text(record.orderStatus ?? record.order_status ?? record.bookingStatus ?? record.status, 'pending');
}

function createdAt(record: AdminRecord) {
  return timestampToIso(record.createdAtServer ?? record.createdAt ?? record.saleDate ?? record.createTime ?? record.updatedAt ?? record.updateTime);
}

function storeNameFromRecord(record: AdminRecord) {
  const business = asRecord(record.business);
  const profile = asRecord(record.profile);
  return text(record.name ?? record.storeName ?? record.businessName ?? record.displayName ?? business.name ?? profile.name ?? record.id, 'Unknown store');
}

function buildStoreMap(stores: AdminRecord[], storeSettings: AdminRecord[]) {
  const map = new Map<string, string>();
  [...stores, ...storeSettings].forEach((store) => {
    const id = text(store.id ?? store.storeId ?? store.merchantId);
    if (id) map.set(id, storeNameFromRecord(store));
  });
  return map;
}

function storeName(storeId: string, stores: Map<string, string>) {
  return stores.get(storeId) || storeId || 'Unknown store';
}

function mapActivity(record: AdminRecord, type: ActivityRow['type'], stores: Map<string, string>): ActivityRow {
  const customer = asRecord(record.customer);
  const item = firstItem(record);
  const storeId = text(record.storeId ?? record.merchantId ?? (record.path || '').split('/')[1]);
  const storeOnly = type === 'cash' || isStoreOnlyCash(record);
  const settlementScope: ActivityRow['settlementScope'] = type === 'pos' ? 'pos' : storeOnly ? 'store_only' : 'sedifex_settlement';
  const reference = text(record.reference ?? record.paymentReference ?? record.payment_reference ?? record.receiptNumber ?? record.saleId ?? record.id, record.id || '');

  return {
    id: `${type}-${record.id || reference}`,
    storeId,
    storeName: storeName(storeId, stores),
    type,
    label: type === 'pos' ? 'POS / Sell' : type === 'online' ? 'Online order' : type === 'booking' ? 'Booking / Service' : 'Store cash / Manual',
    reference,
    customerName: text(customer.name ?? record.customerName ?? record.name, type === 'pos' ? 'Walk-in customer' : 'Customer'),
    itemName: text(record.itemName ?? record.productName ?? record.serviceName ?? item.name ?? item.itemName ?? item.productName, type === 'cash' ? 'Manual cash sale' : type === 'booking' ? 'Service booking' : type === 'pos' ? 'POS sale' : 'Online order'),
    amount: readAmount(record),
    currency: text(record.currency ?? asRecord(record.payment).currency, 'GHS'),
    paymentStatus: statusText(record),
    orderStatus: orderStatusText(record),
    settlementScope,
    createdAt: createdAt(record),
  };
}

async function safeRead(collectionPath: string, limit = 1000) {
  try {
    return { documents: (await listFirestoreDocuments(collectionPath, limit)).documents as AdminRecord[], error: null as string | null };
  } catch (error) {
    return { documents: [] as AdminRecord[], error: error instanceof Error ? error.message : `Unable to read ${collectionPath}` };
  }
}

async function safeReadGroup(collectionId: string, limit = 1000) {
  try {
    return { documents: (await listFirestoreCollectionGroupDocuments(collectionId, limit)).documents as AdminRecord[], error: null as string | null };
  } catch (error) {
    return { documents: [] as AdminRecord[], error: error instanceof Error ? error.message : `Unable to read collection group ${collectionId}` };
  }
}

export default async function PlatformActivityPage() {
  const env = getFirebaseEnvStatus();

  if (!env.ready) {
    return (
      <main className="space-y-6">
        <SectionCard title="Platform Activity" description="Firebase is not configured for this admin deployment.">
          <StatusBadge tone="red">Firebase environment missing</StatusBadge>
        </SectionCard>
      </main>
    );
  }

  const [storesResult, settingsResult, salesResult, ordersResult, bookingsResult, cashResult, customersResult, productsResult] = await Promise.all([
    safeRead('publicStores', 1000),
    safeRead('storeSettings', 1000),
    safeRead('sales', 1000),
    safeRead('integrationOrders', 1000),
    safeRead('integrationBookings', 1000),
    safeReadGroup('cashOrders', 1000),
    safeRead('customers', 1000),
    safeRead('products', 1000),
  ]);

  const collectionErrors = [storesResult, settingsResult, salesResult, ordersResult, bookingsResult, cashResult, customersResult, productsResult]
    .map((result) => result.error)
    .filter(Boolean) as string[];

  const stores = buildStoreMap(storesResult.documents, settingsResult.documents);
  const rows = [
    ...salesResult.documents.map((record) => mapActivity(record, 'pos', stores)),
    ...ordersResult.documents.map((record) => mapActivity(record, 'online', stores)),
    ...bookingsResult.documents.map((record) => mapActivity(record, 'booking', stores)),
    ...cashResult.documents.map((record) => mapActivity(record, 'cash', stores)),
  ].sort((a, b) => timeValue(b.createdAt) - timeValue(a.createdAt));

  const customerCounts = new Map<string, number>();
  customersResult.documents.forEach((record) => {
    const storeId = text(record.storeId);
    if (storeId) customerCounts.set(storeId, (customerCounts.get(storeId) || 0) + 1);
  });

  const productCounts = new Map<string, number>();
  productsResult.documents.forEach((record) => {
    const storeId = text(record.storeId);
    if (storeId) productCounts.set(storeId, (productCounts.get(storeId) || 0) + 1);
  });

  const storeIds = new Set<string>([...Array.from(stores.keys()), ...rows.map((row) => row.storeId).filter(Boolean), ...Array.from(customerCounts.keys()), ...Array.from(productCounts.keys())]);
  const summaries: StoreSummary[] = Array.from(storeIds).map((storeId) => {
    const storeRows = rows.filter((row) => row.storeId === storeId);
    return {
      storeId,
      storeName: storeName(storeId, stores),
      activityCount: storeRows.length,
      activityValue: storeRows.reduce((sum, row) => sum + row.amount, 0),
      settlementValue: storeRows.filter((row) => row.settlementScope === 'sedifex_settlement').reduce((sum, row) => sum + row.amount, 0),
      storeOnlyValue: storeRows.filter((row) => row.settlementScope === 'store_only').reduce((sum, row) => sum + row.amount, 0),
      posValue: storeRows.filter((row) => row.settlementScope === 'pos').reduce((sum, row) => sum + row.amount, 0),
      customers: customerCounts.get(storeId) || 0,
      products: productCounts.get(storeId) || 0,
      lastActivityAt: storeRows[0]?.createdAt || null,
    };
  }).sort((a, b) => timeValue(b.lastActivityAt) - timeValue(a.lastActivityAt));

  const totals = {
    stores: summaries.length,
    activeStores: summaries.filter((store) => store.activityCount > 0).length,
    activities: rows.length,
    activityValue: rows.reduce((sum, row) => sum + row.amount, 0),
    settlementValue: rows.filter((row) => row.settlementScope === 'sedifex_settlement').reduce((sum, row) => sum + row.amount, 0),
    storeOnlyValue: rows.filter((row) => row.settlementScope === 'store_only').reduce((sum, row) => sum + row.amount, 0),
    posValue: rows.filter((row) => row.settlementScope === 'pos').reduce((sum, row) => sum + row.amount, 0),
    customers: customersResult.documents.length,
    products: productsResult.documents.length,
  };

  const recentRows = rows.slice(0, 80);
  const topStores = summaries.slice(0, 50);

  return (
    <main className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-600">Sedifex Admin</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-950">Platform Activity</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-600">
            Track all store activity from the admin repo. Store-only cash/manual activity is visible for usage analysis, but it is separated from Sedifex settlement money.
          </p>
        </div>
        <Link href="/admin/settlements" className="inline-flex rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800">
          Open settlements
        </Link>
      </div>

      {collectionErrors.length ? (
        <SectionCard title="Some collections could not be read" description="The page is still showing the data it could load.">
          <div className="space-y-2 text-sm text-red-700">
            {collectionErrors.map((error) => <p key={error}>{error}</p>)}
          </div>
        </SectionCard>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Active stores" value={`${totals.activeStores}/${totals.stores}`} icon={Store} tone="blue" />
        <StatCard title="Total activities" value={totals.activities.toLocaleString()} icon={Activity} tone="green" />
        <StatCard title="All activity value" value={formatMoney(totals.activityValue)} icon={Database} tone="slate" />
        <StatCard title="Settlement value" value={formatMoney(totals.settlementValue)} icon={CreditCard} tone="green" />
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Store-only cash/manual" value={formatMoney(totals.storeOnlyValue)} icon={Banknote} tone="yellow" />
        <StatCard title="POS activity value" value={formatMoney(totals.posValue)} icon={ReceiptText} tone="blue" />
        <StatCard title="Customers captured" value={totals.customers.toLocaleString()} icon={Users} tone="slate" />
        <StatCard title="Products/services" value={totals.products.toLocaleString()} icon={Package} tone="slate" />
      </section>

      <SectionCard title="Store usage summary" description="This is the admin view of which stores are active and what kind of value they are recording.">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Store</th>
                <th className="px-4 py-3 text-right">Activities</th>
                <th className="px-4 py-3 text-right">All activity</th>
                <th className="px-4 py-3 text-right">Settlement</th>
                <th className="px-4 py-3 text-right">Store-only cash</th>
                <th className="px-4 py-3 text-right">Customers</th>
                <th className="px-4 py-3 text-right">Products</th>
                <th className="px-4 py-3">Last activity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {topStores.map((store) => (
                <tr key={store.storeId}>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-slate-900">{store.storeName}</p>
                    <p className="text-xs text-slate-500">{store.storeId}</p>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold">{store.activityCount}</td>
                  <td className="px-4 py-3 text-right">{formatMoney(store.activityValue)}</td>
                  <td className="px-4 py-3 text-right text-emerald-700">{formatMoney(store.settlementValue)}</td>
                  <td className="px-4 py-3 text-right text-amber-700">{formatMoney(store.storeOnlyValue)}</td>
                  <td className="px-4 py-3 text-right">{store.customers}</td>
                  <td className="px-4 py-3 text-right">{store.products}</td>
                  <td className="px-4 py-3 text-slate-600">{formatDate(store.lastActivityAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard title="Recent platform activities" description="Detailed activity across POS, online orders, bookings, and store-only manual cash.">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Store</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Reference</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Item/activity</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3">Scope</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {recentRows.map((row) => (
                <tr key={row.id}>
                  <td className="px-4 py-3 text-slate-600">{formatDate(row.createdAt)}</td>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-slate-900">{row.storeName}</p>
                    <p className="text-xs text-slate-500">{row.storeId}</p>
                  </td>
                  <td className="px-4 py-3 font-semibold">{row.label}</td>
                  <td className="px-4 py-3 font-mono text-xs">{row.reference}</td>
                  <td className="px-4 py-3">{row.customerName}</td>
                  <td className="px-4 py-3">{row.itemName}</td>
                  <td className="px-4 py-3 text-right font-semibold">{formatMoney(row.amount, row.currency)}</td>
                  <td className="px-4 py-3">
                    {row.settlementScope === 'sedifex_settlement' ? <StatusBadge tone="green">Settlement</StatusBadge> : row.settlementScope === 'store_only' ? <StatusBadge tone="yellow">Store-only</StatusBadge> : <StatusBadge tone="blue">POS</StatusBadge>}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600">{row.paymentStatus}<br />{row.orderStatus}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </main>
  );
}
