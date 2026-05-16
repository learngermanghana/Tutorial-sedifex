import Link from 'next/link';
import { AlertTriangle, ArrowUpRight, Banknote, CheckCircle2, Clock, PlugZap, ReceiptText, Store, XCircle } from 'lucide-react';
import { SectionCard, StatCard, StatusBadge } from '../../../components/admin/ui';
import { getFirebaseEnvStatus, listFirestoreDocuments } from '../../../lib/firebase-admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type OrderRecord = Record<string, unknown> & {
  id?: string;
  path?: string;
  merchantId?: string;
  storeId?: string;
  reference?: string;
  productName?: string;
  customer?: unknown;
  paymentStatus?: string;
  payment_status?: string;
  orderStatus?: string;
  order_status?: string;
  syncStatus?: string;
  sourceChannel?: string;
  source_channel?: string;
  sourceLabel?: string;
  createdAt?: string | null;
  updatedAt?: string | null;
};

type StoreRecord = Record<string, unknown> & {
  id?: string;
  status?: string;
  storeStatus?: string;
  contractStatus?: string;
};

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function nestedValue(record: Record<string, unknown>, path: string[]) {
  let current: unknown = record;
  for (const key of path) {
    const object = asObject(current);
    current = object[key];
  }
  return current;
}

function orderStoreId(order: OrderRecord) {
  return cleanText(order.storeId) || cleanText(order.merchantId);
}

function orderStatus(order: OrderRecord) {
  return cleanText(order.orderStatus) || cleanText(order.order_status) || 'unknown';
}

function paymentStatus(order: OrderRecord) {
  return cleanText(order.paymentStatus) || cleanText(order.payment_status) || 'unknown';
}

function syncStatus(order: OrderRecord) {
  return cleanText(order.syncStatus) || 'unknown';
}

function sourceLabel(order: OrderRecord) {
  return cleanText(order.sourceLabel) || cleanText(order.sourceChannel) || cleanText(order.source_channel) || 'Unknown source';
}

function customerName(order: OrderRecord) {
  const customer = asObject(order.customer);
  return cleanText(customer.name) || 'No customer';
}

function formatDate(value: unknown) {
  if (typeof value !== 'string') return '—';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
}

function moneyValue(order: OrderRecord) {
  const pricing = asObject(order.pricingSnapshot || order.pricing_snapshot);
  const payment = asObject(order.payment);
  const amount = Number(pricing.subtotal ?? payment.amount ?? 0);
  const currency = cleanText(pricing.currency) || cleanText(payment.currency) || 'GHS';
  if (!Number.isFinite(amount)) return '—';
  return new Intl.NumberFormat('en', { style: 'currency', currency, maximumFractionDigits: 2 }).format(amount);
}

function statusTone(status: string) {
  const value = status.toLowerCase();
  if (value.includes('confirm') || value.includes('success') || value.includes('complete') || value === 'synced') return 'green' as const;
  if (value.includes('pending') || value.includes('cash') || value.includes('delivery')) return 'yellow' as const;
  if (value.includes('fail') || value.includes('error') || value.includes('cancel')) return 'red' as const;
  return 'slate' as const;
}

function storeIsActive(store: StoreRecord) {
  const status = cleanText(store.status || store.storeStatus || store.contractStatus).toLowerCase();
  return !status || status === 'active';
}

function hasCheckoutConfig(settings: Record<string, unknown>) {
  const integrationApiKey = cleanText(nestedValue(settings, ['googleShopping', 'catalogSync', 'integrationApiKey']));
  const integrationBaseUrl = cleanText(nestedValue(settings, ['googleShopping', 'catalogSync', 'integrationBaseUrl']));
  return Boolean(integrationApiKey && integrationBaseUrl);
}

async function loadCheckoutData() {
  const env = getFirebaseEnvStatus();

  if (!env.ready) {
    return {
      ok: false,
      error: 'Firebase envs are not ready in Vercel.',
      orders: [] as OrderRecord[],
      stores: [] as StoreRecord[],
      settings: [] as Record<string, unknown>[],
    };
  }

  try {
    const [ordersResult, storesResult, settingsResult] = await Promise.all([
      listFirestoreDocuments('integrationOrders', 100),
      listFirestoreDocuments('stores', 100),
      listFirestoreDocuments('storeSettings', 100),
    ]);

    return {
      ok: true,
      error: null,
      orders: ordersResult.documents as OrderRecord[],
      stores: storesResult.documents as StoreRecord[],
      settings: settingsResult.documents as Record<string, unknown>[],
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Unable to load checkout data from Firestore.',
      orders: [] as OrderRecord[],
      stores: [] as StoreRecord[],
      settings: [] as Record<string, unknown>[],
    };
  }
}

export default async function CheckoutPage() {
  const result = await loadCheckoutData();
  const orders = result.orders;
  const stores = result.stores;
  const settings = result.settings;
  const storeIds = new Set(stores.map((store) => cleanText(store.id)).filter(Boolean));
  const settingIds = new Set(settings.map((item) => cleanText(item.id)).filter(Boolean));
  const activeStores = stores.filter(storeIsActive);
  const storesMissingSettings = activeStores.filter((store) => !settingIds.has(cleanText(store.id)));
  const storesMissingCheckoutConfig = settings.filter((item) => !hasCheckoutConfig(item));
  const ordersMissingStore = orders.filter((order) => !orderStoreId(order));
  const ordersWithUnknownStore = orders.filter((order) => {
    const id = orderStoreId(order);
    return Boolean(id && storeIds.size > 0 && !storeIds.has(id));
  });
  const pendingOrders = orders.filter((order) => orderStatus(order).toLowerCase().includes('pending'));
  const pendingPayments = orders.filter((order) => paymentStatus(order).toLowerCase().includes('pending'));
  const pendingSync = orders.filter((order) => syncStatus(order).toLowerCase().includes('pending'));
  const failedOrders = orders.filter((order) => {
    const combined = `${orderStatus(order)} ${paymentStatus(order)} ${syncStatus(order)}`.toLowerCase();
    return combined.includes('fail') || combined.includes('error') || combined.includes('cancel');
  });

  const stats = [
    { label: 'Integration orders', value: result.ok ? String(orders.length) : 'Setup', delta: result.ok ? 'From integrationOrders' : 'Database not ready' },
    { label: 'Pending orders', value: result.ok ? String(pendingOrders.length) : '—', delta: 'orderStatus includes pending' },
    { label: 'Pending payments', value: result.ok ? String(pendingPayments.length) : '—', delta: 'paymentStatus pending' },
    { label: 'Sync pending', value: result.ok ? String(pendingSync.length) : '—', delta: 'Waiting for Sedifex sync' },
  ];

  const setupStats = [
    { label: 'Active stores', value: String(activeStores.length), icon: Store, tone: 'blue' as const },
    { label: 'Missing settings', value: String(storesMissingSettings.length), icon: PlugZap, tone: storesMissingSettings.length ? ('yellow' as const) : ('green' as const) },
    { label: 'Missing checkout config', value: String(storesMissingCheckoutConfig.length), icon: XCircle, tone: storesMissingCheckoutConfig.length ? ('red' as const) : ('green' as const) },
    { label: 'Failed/cancelled orders', value: String(failedOrders.length), icon: AlertTriangle, tone: failedOrders.length ? ('red' as const) : ('green' as const) },
    { label: 'Orders missing store ID', value: String(ordersMissingStore.length), icon: ReceiptText, tone: ordersMissingStore.length ? ('red' as const) : ('green' as const) },
    { label: 'Unknown store orders', value: String(ordersWithUnknownStore.length), icon: Store, tone: ordersWithUnknownStore.length ? ('yellow' as const) : ('green' as const) },
  ];

  const reviewOrders = [...ordersMissingStore, ...ordersWithUnknownStore, ...failedOrders, ...pendingSync]
    .filter((order, index, array) => array.findIndex((entry) => entry.id === order.id) === index)
    .slice(0, 15);

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
              <p className="font-semibold">Checkout data is not available yet.</p>
              <p className="mt-1 leading-6">{result.error}</p>
            </div>
          </div>
        </section>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[1.45fr_0.9fr]">
        <div className="space-y-6">
          <SectionCard
            title="Checkout/order review"
            action={<Link href="/admin/marketplace" className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-500">Marketplace <ArrowUpRight className="h-3.5 w-3.5" /></Link>}
          >
            <div className="overflow-hidden rounded-2xl border border-slate-200">
              <div className="grid grid-cols-[1.1fr_0.8fr_0.8fr_0.8fr_0.8fr_auto] bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 max-lg:hidden">
                <span>Order</span><span>Store</span><span>Customer</span><span>Payment</span><span>Sync</span><span>Status</span>
              </div>
              <div className="divide-y divide-slate-200">
                {reviewOrders.length === 0 ? (
                  <div className="p-8 text-center text-sm text-slate-500">No checkout issues found in the loaded sample.</div>
                ) : reviewOrders.map((order) => (
                  <div key={order.path || order.id} className="grid gap-3 px-4 py-4 text-sm lg:grid-cols-[1.1fr_0.8fr_0.8fr_0.8fr_0.8fr_auto] lg:items-center">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-slate-950">{cleanText(order.reference) || order.id || 'No reference'}</p>
                      <p className="truncate text-xs text-slate-500">{cleanText(order.productName) || sourceLabel(order)}</p>
                    </div>
                    <p className="truncate text-slate-600">{orderStoreId(order) || 'Missing store'}</p>
                    <p className="truncate text-slate-600">{customerName(order)}</p>
                    <StatusBadge tone={statusTone(paymentStatus(order))}>{paymentStatus(order)}</StatusBadge>
                    <StatusBadge tone={statusTone(syncStatus(order))}>{syncStatus(order)}</StatusBadge>
                    <StatusBadge tone={statusTone(orderStatus(order))}>{orderStatus(order)}</StatusBadge>
                  </div>
                ))}
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Recent integration orders">
            <div className="overflow-hidden rounded-2xl border border-slate-200">
              <div className="grid grid-cols-[1fr_0.75fr_0.8fr_0.7fr_0.7fr] bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 max-lg:hidden">
                <span>Order</span><span>Amount</span><span>Source</span><span>Created</span><span>Status</span>
              </div>
              <div className="divide-y divide-slate-200">
                {orders.slice(0, 12).map((order) => (
                  <div key={`recent-${order.path || order.id}`} className="grid gap-3 px-4 py-4 text-sm lg:grid-cols-[1fr_0.75fr_0.8fr_0.7fr_0.7fr] lg:items-center">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-slate-950">{cleanText(order.reference) || order.id || 'No reference'}</p>
                      <p className="truncate text-xs text-slate-500">{customerName(order)}</p>
                    </div>
                    <p className="truncate text-slate-600"><Banknote className="mr-1 inline h-3.5 w-3.5" />{moneyValue(order)}</p>
                    <p className="truncate text-slate-600">{sourceLabel(order)}</p>
                    <p className="truncate text-slate-600">{formatDate(order.createdAt)}</p>
                    <StatusBadge tone={statusTone(orderStatus(order))}>{orderStatus(order)}</StatusBadge>
                  </div>
                ))}
              </div>
            </div>
          </SectionCard>
        </div>

        <div className="space-y-6">
          <SectionCard title="Setup checks">
            <div className="space-y-3">
              {setupStats.map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.label} className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 p-4">
                    <div className="flex items-center gap-3">
                      <span className="rounded-xl bg-white p-2 text-slate-500 shadow-sm ring-1 ring-slate-200"><Icon className="h-4 w-4" /></span>
                      <span className="text-sm font-semibold text-slate-800">{item.label}</span>
                    </div>
                    <StatusBadge tone={item.tone}>{item.value}</StatusBadge>
                  </div>
                );
              })}
            </div>
          </SectionCard>

          <SectionCard title="Checkout readiness rules">
            <div className="space-y-3 text-sm leading-6 text-slate-600">
              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="mb-2 flex items-center gap-2 font-semibold text-slate-950"><CheckCircle2 className="h-4 w-4 text-emerald-600" /> Store identity</div>
                Every market order must have merchantId/storeId so Sedifex knows the receiving store.
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="mb-2 flex items-center gap-2 font-semibold text-slate-950"><PlugZap className="h-4 w-4 text-indigo-600" /> Integration setup</div>
                Each active store should have storeSettings and the required integration fields for sync.
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="mb-2 flex items-center gap-2 font-semibold text-slate-950"><Clock className="h-4 w-4 text-amber-600" /> Pending sync</div>
                Orders with syncStatus=pending should be monitored until the Sedifex app confirms or processes them.
              </div>
            </div>
          </SectionCard>
        </div>
      </section>
    </div>
  );
}
