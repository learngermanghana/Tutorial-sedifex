import Link from 'next/link';
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  CircleAlert,
  CreditCard,
  Database,
  KeyRound,
  PackageSearch,
  ReceiptText,
  RefreshCw,
  Server,
  ShieldCheck,
  ShoppingBag,
  Store,
  Webhook,
  Zap,
} from 'lucide-react';
import { DashboardOrderFollowUp } from '../../components/admin/DashboardOrderFollowUp';
import { SectionCard, StatCard, StatusBadge } from '../../components/admin/ui';
import { getFirebaseEnvStatus, listFirestoreDocuments } from '../../lib/firebase-admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type DashboardRecord = Record<string, unknown> & {
  id?: string;
  path?: string;
  updateTime?: string | null;
  createTime?: string | null;
};

type CollectionResult = {
  ok: boolean;
  error: string | null;
  documents: DashboardRecord[];
};

type DashboardData = {
  connected: boolean;
  error: string | null;
  stores: DashboardRecord[];
  orders: DashboardRecord[];
  catalogItems: DashboardRecord[];
  deliveries: DashboardRecord[];
  collectionErrors: Record<string, string>;
};

type AlertItem = {
  title: string;
  description: string;
  href: string;
  tone: 'green' | 'yellow' | 'red' | 'blue' | 'slate';
  icon: typeof AlertTriangle;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function getNestedValue(record: DashboardRecord, path: string[]) {
  let current: unknown = record;

  for (const key of path) {
    const obj = asRecord(current);
    if (!obj || !(key in obj)) return undefined;
    current = obj[key];
  }

  return current;
}

function getNestedBoolean(record: DashboardRecord, path: string[]) {
  return getNestedValue(record, path) === true;
}

function getText(record: DashboardRecord, fields: string[], fallback = '') {
  for (const field of fields) {
    const value = record[field];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number') return String(value);
  }
  return fallback;
}

function getStoreName(record: DashboardRecord) {
  const candidates = [record.storeName, record.name, record.businessName, record.displayName, record.merchantName, record.id];
  return String(candidates.find((item) => typeof item === 'string' && item.trim()) || 'Unnamed store');
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

function recordTime(record: DashboardRecord) {
  return (
    timestampToMillis(record.paymentUpdatedAt) ??
    timestampToMillis(record.updatedAt) ??
    timestampToMillis(record.updated_at) ??
    timestampToMillis(record.updateTime) ??
    timestampToMillis(record.createdAt) ??
    timestampToMillis(record.createTime)
  );
}

function isToday(record: DashboardRecord) {
  const millis = recordTime(record);
  if (millis === null) return false;
  const date = new Date(millis);
  const today = new Date();
  return date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth() && date.getDate() === today.getDate();
}

function isRecent(record: DashboardRecord, days = 7) {
  const millis = recordTime(record);
  return millis !== null && Date.now() - millis < days * 24 * 60 * 60 * 1000;
}

function moneyAmount(order: DashboardRecord) {
  const candidates = [order.finalTotal, order.final_total, order.amountPaid, order.amount, order.total, order.grandTotal];
  const value = candidates.find((item) => typeof item === 'number');
  if (typeof value === 'number') return value;
  if (typeof order.amountMinor === 'number') return order.amountMinor / 100;
  return 0;
}

function formatMoney(value: number) {
  return `GHS ${value.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function orderStatus(order: DashboardRecord) {
  return [order.paymentStatus, order.payment_status, order.orderStatus, order.order_status, order.fulfillmentStatus, order.deliveryStatus, order.status]
    .map((value) => (typeof value === 'string' ? value.trim().toLowerCase() : ''))
    .filter(Boolean)
    .join(' ');
}

function isPaidOrder(order: DashboardRecord) {
  return /paid|success|successful|confirmed/.test(orderStatus(order));
}

function isFailedOrder(order: DashboardRecord) {
  const status = orderStatus(order);
  return ['failed', 'error', 'cancelled', 'canceled', 'declined', 'abandoned'].some((word) => status.includes(word));
}

function orderBucket(order: DashboardRecord): 'new' | 'accepted' | 'preparing' | 'out_for_delivery' | 'delivered' | 'problem' | 'delayed' {
  const status = orderStatus(order).replace(/\s+/g, '_');
  if (/cancel|refund|failed|problem|dispute|delivery_failed/.test(status)) return 'problem';
  if (/delivered|completed/.test(status) || order.deliveredAt) return 'delivered';
  if (/out_for_delivery|in_transit/.test(status)) return 'out_for_delivery';
  if (/prepar|pack|processing/.test(status)) return 'preparing';
  if (/accepted|confirmed_by_store|ready_for_pickup/.test(status)) return 'accepted';
  if (/paid|success|successful|confirmed/.test(status)) return 'new';
  return 'new';
}

function isDelayedOrder(order: DashboardRecord) {
  const bucket = orderBucket(order);
  if (bucket === 'delivered' || bucket === 'problem') return false;
  const time = recordTime(order);
  if (!time) return false;
  const hours = (Date.now() - time) / 36e5;
  if (bucket === 'new') return hours >= 1;
  if (bucket === 'accepted' || bucket === 'preparing') return hours >= 6;
  if (bucket === 'out_for_delivery') return hours >= 12;
  return hours >= 24;
}

function ageLabel(record: DashboardRecord) {
  const time = recordTime(record);
  if (!time) return 'Unknown age';
  const minutes = Math.max(0, Math.round((Date.now() - time) / 60000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function hasImage(item: DashboardRecord) {
  const stringFields = ['image', 'imageUrl', 'imageURL', 'photo', 'photoUrl', 'thumbnail', 'coverImage', 'mainImage'];
  if (stringFields.some((field) => typeof item[field] === 'string' && String(item[field]).trim())) return true;
  const arrays = [item.images, item.gallery, item.photos, item.imageUrls];
  return arrays.some((value) => Array.isArray(value) && value.length > 0);
}

function hasPrice(item: DashboardRecord) {
  const fields = ['price', 'amount', 'salePrice', 'regularPrice', 'finalPrice', 'courseFee', 'servicePrice'];
  return fields.some((field) => {
    const value = item[field];
    if (typeof value === 'number') return value > 0;
    if (typeof value === 'string') return Number(value.replace(/[^0-9.]/g, '')) > 0;
    return false;
  });
}

function hasCategory(item: DashboardRecord) {
  return Boolean(getText(item, ['category', 'categoryName', 'categoryId', 'categoryKey', 'type', 'itemType', 'listingType', 'serviceCategory', 'courseCategory'], ''));
}

function marketVisible(item: DashboardRecord) {
  if (item.marketplaceVisible === true || item.showOnMarket === true || item.isPublished === true || item.active === true || item.isMarketplaceVisible === true) return true;
  const status = getText(item, ['status', 'visibility', 'state'], '').toLowerCase();
  return ['active', 'published', 'visible', 'live'].includes(status);
}

function checkoutLooksConfigured(store: DashboardRecord) {
  const directFields = ['merchantId', 'merchantToken', 'paystackSubaccount', 'paystackSubaccountCode', 'checkoutEnabled'];
  if (directFields.some((field) => Boolean(store[field]))) return true;
  const payment = asRecord(store.payment) || asRecord(store.payments) || asRecord(store.checkout) || asRecord(store.billing) || asRecord(store.paymentRouting);
  if (!payment) return false;
  return Object.values(payment).some((value) => value === true || (typeof value === 'string' && value.trim().length > 0));
}

async function readCollection(collectionPath: string, limit = 100): Promise<CollectionResult> {
  try {
    const result = await listFirestoreDocuments(collectionPath, limit);
    return { ok: true, error: null, documents: result.documents as DashboardRecord[] };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : `Unable to read ${collectionPath}.`,
      documents: [],
    };
  }
}

async function getDashboardData(): Promise<DashboardData> {
  const env = getFirebaseEnvStatus();

  if (!env.ready) {
    return {
      connected: false,
      error: 'Firebase environment variables are not ready in this deployment.',
      stores: [],
      orders: [],
      catalogItems: [],
      deliveries: [],
      collectionErrors: {},
    };
  }

  const [stores, storeSettings, orders, publicListings, publicProducts, products, services, courses, catalogItems, deliveries] = await Promise.all([
    readCollection('stores', 100),
    readCollection('storeSettings', 100),
    readCollection('integrationOrders', 100),
    readCollection('publicListings', 150),
    readCollection('publicProducts', 150),
    readCollection('products', 100),
    readCollection('services', 100),
    readCollection('courses', 100),
    readCollection('catalogItems', 100),
    readCollection('webhookDeliveries', 100),
  ]);

  const collectionErrors: Record<string, string> = {};
  Object.entries({ stores, storeSettings, integrationOrders: orders, publicListings, publicProducts, products, services, courses, catalogItems, webhookDeliveries: deliveries }).forEach(([key, result]) => {
    if (!result.ok && result.error) collectionErrors[key] = result.error;
  });

  const storeDocs = stores.documents.length > 0 ? stores.documents : storeSettings.documents;

  return {
    connected: stores.ok || storeSettings.ok,
    error: stores.error && storeSettings.error ? stores.error : null,
    stores: storeDocs,
    orders: orders.documents,
    catalogItems: [...publicListings.documents, ...publicProducts.documents, ...products.documents, ...services.documents, ...courses.documents, ...catalogItems.documents],
    deliveries: deliveries.documents,
    collectionErrors,
  };
}

const quickActions = [
  {
    title: 'Fix store setup',
    description: 'Open stores that need checkout, catalog, Google Shopping, or integration review.',
    href: '/admin/stores',
    icon: Store,
  },
  {
    title: 'Review catalog quality',
    description: 'Find products, services, and courses that are not ready for Sedifex Market.',
    href: '/admin/products',
    icon: PackageSearch,
  },
  {
    title: 'Monitor orders',
    description: 'Use admin buttons to mark orders received, preparing, out for delivery, or delivered.',
    href: '/admin/orders',
    icon: ShoppingBag,
  },
  {
    title: 'Check webhook deliveries',
    description: 'Inspect delivery results, retries, and recent sync status.',
    href: '/admin/deliveries',
    icon: Webhook,
  },
];

export default async function AdminDashboardPage() {
  const dashboard = await getDashboardData();
  const stores = dashboard.stores;
  const orders = dashboard.orders;
  const catalogItems = dashboard.catalogItems;
  const deliveries = dashboard.deliveries;

  const googleShoppingConnected = stores.filter((store) => getNestedBoolean(store, ['googleShopping', 'connection', 'connected'])).length;
  const autoSyncEnabled = stores.filter((store) => getNestedBoolean(store, ['googleShopping', 'catalogSync', 'autoSyncEnabled'])).length;
  const checkoutReviewCount = stores.filter((store) => !checkoutLooksConfigured(store)).length;
  const recentlyUpdatedStores = stores.filter((store) => isRecent(store, 7)).length;
  const ordersToday = orders.filter(isToday);
  const failedOrders = orders.filter(isFailedOrder);
  const paidOrders = orders.filter(isPaidOrder);
  const pendingDeliveryOrders = orders.filter((order) => !['delivered', 'problem'].includes(orderBucket(order)) && isPaidOrder(order));
  const delayedOrders = pendingDeliveryOrders.filter(isDelayedOrder);
  const revenueToday = ordersToday.reduce((sum, order) => sum + moneyAmount(order), 0);
  const catalogMissingImage = catalogItems.filter((item) => !hasImage(item)).length;
  const catalogMissingPrice = catalogItems.filter((item) => !hasPrice(item)).length;
  const catalogMissingCategory = catalogItems.filter((item) => !hasCategory(item)).length;
  const marketVisibleItems = catalogItems.filter(marketVisible).length;
  const failedDeliveries = deliveries.filter((delivery) => {
    const status = getText(delivery, ['status', 'deliveryStatus', 'state'], '').toLowerCase();
    return ['failed', 'error', 'retrying'].some((word) => status.includes(word));
  }).length;

  const followUpOrders = [...pendingDeliveryOrders]
    .sort((a, b) => {
      const delayedDiff = Number(isDelayedOrder(b)) - Number(isDelayedOrder(a));
      if (delayedDiff !== 0) return delayedDiff;
      return (recordTime(a) || 0) - (recordTime(b) || 0);
    })
    .slice(0, 6)
    .map((order) => {
      const bucket = isDelayedOrder(order) ? 'delayed' : orderBucket(order);
      const customer = asRecord(order.customer);
      return {
        id: String(order.id || ''),
        storeId: getText(order, ['storeId', 'store_id', 'merchantId', 'merchant_id'], ''),
        storeName: getText(order, ['storeName', 'merchantName'], 'Unknown store'),
        buyerName: getText(order, ['customerName'], customer ? getText(customer, ['name'], 'Unknown buyer') : 'Unknown buyer'),
        amount: formatMoney(moneyAmount(order)),
        status: orderStatus(order) || 'No status',
        bucket,
        age: ageLabel(order),
      };
    });

  const qualityProblems = [
    { label: 'Missing image', value: catalogMissingImage, description: 'Products without photos reduce trust and clicks.', href: '/admin/products' },
    { label: 'Missing price', value: catalogMissingPrice, description: 'Products without prices should not be promoted.', href: '/admin/products' },
    { label: 'Missing category', value: catalogMissingCategory, description: 'Categories help browsing, emails, and future ads.', href: '/admin/products' },
    { label: 'Not visible/live', value: Math.max(catalogItems.length - marketVisibleItems, 0), description: 'Items not visible cannot help the marketplace sell.', href: '/admin/products' },
  ];

  const metrics = [
    {
      label: 'Stores monitored',
      value: dashboard.connected ? String(stores.length) : 'Setup',
      delta: dashboard.connected ? `${recentlyUpdatedStores} updated recently` : 'Check Firebase envs',
    },
    {
      label: 'Orders today',
      value: dashboard.connected ? String(ordersToday.length) : '—',
      delta: dashboard.connected ? formatMoney(revenueToday) : 'Database not ready',
    },
    {
      label: 'Pending delivery',
      value: dashboard.connected ? String(pendingDeliveryOrders.length) : '—',
      delta: `${delayedOrders.length} delayed orders`,
    },
    {
      label: 'Market-ready catalog',
      value: dashboard.connected ? `${marketVisibleItems}/${catalogItems.length}` : '—',
      delta: 'Visible items / total items',
    },
  ];

  const alerts: AlertItem[] = [
    !dashboard.connected
      ? {
          title: 'Firebase is not connected',
          description: dashboard.error || 'The admin cannot read live Sedifex data until Firebase envs are configured.',
          href: '/admin/settings',
          tone: 'red',
          icon: Database,
        }
      : null,
    delayedOrders.length > 0
      ? {
          title: `${delayedOrders.length} delayed orders need follow-up`,
          description: 'Use the dashboard order buttons or open Orders to mark progress on behalf of lazy stores.',
          href: '/admin/orders',
          tone: 'red',
          icon: ShoppingBag,
        }
      : null,
    failedOrders.length > 0
      ? {
          title: `${failedOrders.length} failed or cancelled orders`,
          description: 'Review failed payments and checkout records before customers or stores complain.',
          href: '/admin/orders',
          tone: 'red',
          icon: CreditCard,
        }
      : null,
    checkoutReviewCount > 0
      ? {
          title: `${checkoutReviewCount} stores need checkout review`,
          description: 'Some stores may be missing payment or checkout configuration.',
          href: '/admin/stores',
          tone: 'yellow',
          icon: CircleAlert,
        }
      : null,
    catalogMissingImage + catalogMissingPrice + catalogMissingCategory > 0
      ? {
          title: 'Catalog quality needs attention',
          description: `${catalogMissingImage} missing images, ${catalogMissingPrice} missing prices, ${catalogMissingCategory} missing categories.`,
          href: '/admin/products',
          tone: 'yellow',
          icon: PackageSearch,
        }
      : null,
    failedDeliveries > 0
      ? {
          title: `${failedDeliveries} webhook deliveries need review`,
          description: 'Retry failed syncs for bookings, orders, and partner automations.',
          href: '/admin/deliveries',
          tone: 'red',
          icon: Webhook,
        }
      : null,
    dashboard.connected && stores.length > 0 && failedOrders.length === 0 && checkoutReviewCount === 0
      ? {
          title: 'Core operations look healthy',
          description: 'Stores loaded successfully and no urgent checkout failures were detected from the latest records.',
          href: '/admin/stores',
          tone: 'green',
          icon: CheckCircle2,
        }
      : null,
  ].filter(Boolean) as AlertItem[];

  const healthItems = [
    { label: 'Admin login', value: 'Ready', icon: ShieldCheck, tone: 'green' as const },
    {
      label: 'Database connection',
      value: dashboard.connected ? 'Connected' : 'Needs setup',
      icon: Database,
      tone: dashboard.connected ? ('green' as const) : ('yellow' as const),
    },
    { label: 'Google Shopping stores', value: dashboard.connected ? `${googleShoppingConnected}/${stores.length}` : '—', icon: PackageSearch, tone: googleShoppingConnected > 0 ? ('green' as const) : ('slate' as const) },
    { label: 'Catalog auto sync', value: dashboard.connected ? `${autoSyncEnabled}/${stores.length}` : '—', icon: RefreshCw, tone: autoSyncEnabled > 0 ? ('blue' as const) : ('slate' as const) },
    { label: 'Webhook failures', value: dashboard.connected ? String(failedDeliveries) : '—', icon: Server, tone: failedDeliveries > 0 ? ('red' as const) : ('green' as const) },
  ];

  const watchlist = [
    { label: 'Stores without Google Shopping', value: Math.max(stores.length - googleShoppingConnected, 0), href: '/admin/stores', tone: 'slate' as const },
    { label: 'Stores without auto sync', value: Math.max(stores.length - autoSyncEnabled, 0), href: '/admin/stores', tone: 'slate' as const },
    { label: 'Failed orders', value: failedOrders.length, href: '/admin/orders', tone: failedOrders.length > 0 ? ('red' as const) : ('green' as const) },
    { label: 'Pending delivery', value: pendingDeliveryOrders.length, href: '/admin/orders', tone: pendingDeliveryOrders.length > 0 ? ('yellow' as const) : ('green' as const) },
    { label: 'Catalog missing image', value: catalogMissingImage, href: '/admin/products', tone: catalogMissingImage > 0 ? ('yellow' as const) : ('green' as const) },
    { label: 'Catalog missing price', value: catalogMissingPrice, href: '/admin/products', tone: catalogMissingPrice > 0 ? ('yellow' as const) : ('green' as const) },
  ];

  const recentStores = [...stores]
    .sort((a, b) => (recordTime(b) || 0) - (recordTime(a) || 0))
    .slice(0, 5);

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-slate-950 p-6 text-white shadow-sm sm:p-8">
        <div className="grid gap-8 lg:grid-cols-[1.25fr_0.75fr] lg:items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-indigo-300/20 bg-indigo-400/10 px-3 py-1 text-xs font-semibold text-indigo-100">
              <Zap className="h-4 w-4" /> Sedifex Command Center
            </div>
            <h2 className="mt-5 max-w-3xl text-3xl font-bold tracking-tight sm:text-4xl">
              See what is wrong today, what is making money, and what needs fixing first.
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300">
              This admin overview now checks store setup, orders, catalog readiness, Google Shopping, auto sync, and webhook health from one place.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            <p className="text-sm font-semibold text-slate-200">Today&apos;s business health</p>
            <div className="mt-4 space-y-3 text-sm text-slate-300">
              <div className="flex items-center justify-between gap-3">
                <span>Orders today</span>
                <StatusBadge tone="blue">{dashboard.connected ? ordersToday.length : '—'}</StatusBadge>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>Revenue today</span>
                <StatusBadge tone="green">{dashboard.connected ? formatMoney(revenueToday) : '—'}</StatusBadge>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>Pending delivery</span>
                <StatusBadge tone={pendingDeliveryOrders.length > 0 ? 'yellow' : 'green'}>{pendingDeliveryOrders.length}</StatusBadge>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>Urgent alerts</span>
                <StatusBadge tone={alerts.some((alert) => alert.tone === 'red') ? 'red' : alerts.length > 0 ? 'yellow' : 'green'}>
                  {alerts.length}
                </StatusBadge>
              </div>
            </div>
          </div>
        </div>
      </section>

      {dashboard.error ? (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <strong className="font-semibold">Firestore notice:</strong> {dashboard.error}
        </section>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <StatCard key={metric.label} {...metric} />
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
        <div className="space-y-6">
          <SectionCard title="Order follow-up center">
            <DashboardOrderFollowUp orders={followUpOrders} />
          </SectionCard>

          <SectionCard title="Product quality checker">
            <div className="grid gap-4 md:grid-cols-2">
              {qualityProblems.map((problem) => (
                <Link key={problem.label} href={problem.href} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 transition hover:border-indigo-200 hover:bg-indigo-50/60">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-bold text-slate-950">{problem.label}</p>
                    <StatusBadge tone={problem.value > 0 ? 'yellow' : 'green'}>{problem.value}</StatusBadge>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{problem.description}</p>
                </Link>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="What needs attention first">
            <div className="grid gap-4 md:grid-cols-2">
              {alerts.map((alert) => {
                const Icon = alert.icon;
                return (
                  <Link key={alert.title} href={alert.href} className="group rounded-2xl border border-slate-200 bg-slate-50 p-4 transition hover:border-indigo-200 hover:bg-indigo-50/60">
                    <div className="flex items-start justify-between gap-4">
                      <span className="rounded-2xl bg-white p-3 text-indigo-600 shadow-sm ring-1 ring-slate-200 transition group-hover:ring-indigo-200">
                        <Icon className="h-5 w-5" />
                      </span>
                      <StatusBadge tone={alert.tone}>{alert.tone === 'red' ? 'Urgent' : alert.tone === 'yellow' ? 'Review' : alert.tone === 'green' ? 'Healthy' : 'Info'}</StatusBadge>
                    </div>
                    <h3 className="mt-4 text-sm font-semibold text-slate-950">{alert.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{alert.description}</p>
                  </Link>
                );
              })}
            </div>
          </SectionCard>

          <SectionCard title="Fast actions">
            <div className="grid gap-4 sm:grid-cols-2">
              {quickActions.map((action) => {
                const Icon = action.icon;
                return (
                  <Link
                    key={action.title}
                    href={action.href}
                    className="group rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-indigo-200 hover:bg-indigo-50/60"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <span className="rounded-2xl bg-slate-50 p-3 text-indigo-600 shadow-sm ring-1 ring-slate-200 transition group-hover:ring-indigo-200">
                        <Icon className="h-5 w-5" />
                      </span>
                      <ArrowUpRight className="h-4 w-4 text-slate-400 transition group-hover:text-indigo-500" />
                    </div>
                    <h3 className="mt-4 text-sm font-semibold text-slate-950">{action.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{action.description}</p>
                  </Link>
                );
              })}
            </div>
          </SectionCard>

          <SectionCard title="Recent store movement">
            {recentStores.length > 0 ? (
              <div className="overflow-hidden rounded-2xl border border-slate-200">
                <div className="grid grid-cols-[1.3fr_0.7fr_0.7fr] bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <span>Store</span>
                  <span>Shopping</span>
                  <span>Auto sync</span>
                </div>
                <div className="divide-y divide-slate-200">
                  {recentStores.map((store) => {
                    const storeId = String(store.id || '');
                    return (
                      <Link key={store.path || store.id} href={storeId ? `/admin/stores/${encodeURIComponent(storeId)}` : '/admin/stores'} className="grid grid-cols-[1.3fr_0.7fr_0.7fr] items-center px-4 py-3 text-sm transition hover:bg-indigo-50/60">
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-slate-950">{getStoreName(store)}</p>
                          <p className="truncate text-xs text-slate-500">{store.id}</p>
                        </div>
                        <StatusBadge tone={getNestedBoolean(store, ['googleShopping', 'connection', 'connected']) ? 'green' : 'slate'}>
                          {getNestedBoolean(store, ['googleShopping', 'connection', 'connected']) ? 'On' : 'Off'}
                        </StatusBadge>
                        <StatusBadge tone={getNestedBoolean(store, ['googleShopping', 'catalogSync', 'autoSyncEnabled']) ? 'green' : 'slate'}>
                          {getNestedBoolean(store, ['googleShopping', 'catalogSync', 'autoSyncEnabled']) ? 'On' : 'Off'}
                        </StatusBadge>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm leading-6 text-slate-600">
                No recent store records are loaded yet. After Firebase envs are added and storeSettings has documents, activity will appear here.
              </div>
            )}
          </SectionCard>
        </div>

        <div className="space-y-6">
          <SectionCard title="System readiness">
            <div className="space-y-4">
              {healthItems.map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.label} className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-3 text-sm font-medium text-slate-700">
                      <span className="rounded-xl bg-slate-100 p-2 text-slate-500">
                        <Icon className="h-4 w-4" />
                      </span>
                      {item.label}
                    </span>
                    <StatusBadge tone={item.tone}>{item.value}</StatusBadge>
                  </div>
                );
              })}
            </div>
          </SectionCard>

          <SectionCard title="Watchlist">
            <div className="space-y-3">
              {watchlist.map((item) => (
                <Link key={item.label} href={item.href} className="flex items-center justify-between rounded-2xl bg-slate-50 p-4 text-sm transition hover:bg-indigo-50/60">
                  <span className="font-medium text-slate-700">{item.label}</span>
                  <StatusBadge tone={item.tone}>{item.value}</StatusBadge>
                </Link>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Data coverage">
            <div className="space-y-3 text-sm text-slate-600">
              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="flex items-center gap-2 font-semibold text-slate-950">
                  <Store className="h-4 w-4 text-indigo-600" />
                  Stores
                </div>
                <p className="mt-2 leading-6">Reads stores or storeSettings for store health, Google Shopping, and auto sync checks.</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="flex items-center gap-2 font-semibold text-slate-950">
                  <ReceiptText className="h-4 w-4 text-indigo-600" />
                  Orders
                </div>
                <p className="mt-2 leading-6">Reads integrationOrders for today&apos;s orders, revenue, failed checkout signals, and admin delivery follow-up.</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="flex items-center gap-2 font-semibold text-slate-950">
                  <PackageSearch className="h-4 w-4 text-indigo-600" />
                  Catalog
                </div>
                <p className="mt-2 leading-6">Checks publicListings, publicProducts, products, services, courses, and catalogItems when those collections exist.</p>
              </div>
            </div>
          </SectionCard>

          {Object.keys(dashboard.collectionErrors).length > 0 ? (
            <SectionCard title="Optional collection notices">
              <div className="space-y-2 text-xs leading-5 text-slate-500">
                {Object.entries(dashboard.collectionErrors)
                  .filter(([key]) => key !== 'stores' && key !== 'storeSettings')
                  .slice(0, 6)
                  .map(([key, error]) => (
                    <p key={key} className="rounded-xl bg-slate-50 p-3">
                      <span className="font-semibold text-slate-700">{key}:</span> {error}
                    </p>
                  ))}
              </div>
            </SectionCard>
          ) : null}
        </div>
      </section>
    </div>
  );
}
