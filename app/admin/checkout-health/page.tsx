import Link from 'next/link';
import {
  AlertTriangle,
  CheckCircle2,
  CircleAlert,
  Database,
  ReceiptText,
  Store,
  Webhook,
  Wrench,
} from 'lucide-react';
import { SectionCard, StatCard, StatusBadge } from '../../../components/admin/ui';
import { getFirebaseEnvStatus, listFirestoreDocuments } from '../../../lib/firebase-admin';
import { listDeliveries } from '../../../lib/integrations-store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type AnyRecord = Record<string, unknown> & {
  id?: string;
  path?: string;
  createTime?: string | null;
  updateTime?: string | null;
};

type HealthIssue = {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  area: 'Environment' | 'Store setup' | 'Billing' | 'Orders' | 'Webhooks';
  title: string;
  storeId?: string;
  cause: string;
  fix: string;
  href?: string;
};

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function nestedValue(record: AnyRecord | Record<string, unknown>, keys: string[]) {
  let current: unknown = record;

  for (const key of keys) {
    const object = asObject(current);
    if (!object || !(key in object)) return undefined;
    current = object[key];
  }

  return current;
}

function textValue(record: AnyRecord, fields: string[]) {
  for (const field of fields) {
    const value = record[field];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number') return String(value);
  }

  return '';
}

function storeName(store: AnyRecord) {
  return textValue(store, ['displayName', 'name', 'storeName', 'businessName', 'merchantName', 'id']) || 'Unnamed store';
}

function storeId(store: AnyRecord) {
  return typeof store.id === 'string' && store.id.trim() ? store.id.trim() : '';
}

function timestampToMillis(value: unknown): number | null {
  if (!value) return null;
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value.getTime() : null;

  if (typeof value === 'object') {
    const candidate = value as {
      toDate?: unknown;
      toMillis?: unknown;
      seconds?: unknown;
      _seconds?: unknown;
    };

    if (typeof candidate.toMillis === 'function') {
      const ms = candidate.toMillis();
      return typeof ms === 'number' && Number.isFinite(ms) ? ms : null;
    }

    if (typeof candidate.toDate === 'function') {
      const date = candidate.toDate();
      return date instanceof Date && Number.isFinite(date.getTime()) ? date.getTime() : null;
    }

    const seconds = typeof candidate.seconds === 'number' ? candidate.seconds : typeof candidate._seconds === 'number' ? candidate._seconds : null;
    return seconds !== null ? seconds * 1000 : null;
  }

  return null;
}

function moneyFieldsMissing(store: AnyRecord) {
  const currency = textValue(store, ['currency', 'defaultCurrency']);
  const billingCurrency = nestedValue(store, ['billing', 'currency']);
  return !currency && typeof billingCurrency !== 'string';
}

function checkoutDisabled(store: AnyRecord) {
  const candidates = [
    nestedValue(store, ['checkout', 'enabled']),
    nestedValue(store, ['checkoutSettings', 'enabled']),
    nestedValue(store, ['marketplace', 'checkoutEnabled']),
    store.checkoutEnabled,
    store.onlineCheckoutEnabled,
  ];

  return candidates.some((value) => value === false);
}

function billingExpired(store: AnyRecord) {
  const graceEndsAt = timestampToMillis(nestedValue(store, ['billing', 'graceEndsAt']));
  const currentPeriodEnd = timestampToMillis(nestedValue(store, ['billing', 'currentPeriodEnd']));
  const dueAt = graceEndsAt || currentPeriodEnd;

  return dueAt !== null && dueAt < Date.now();
}

function orderStatus(order: AnyRecord) {
  const candidates = [order.paymentStatus, order.orderStatus, order.status, order.checkoutStatus]
    .filter((value): value is string => typeof value === 'string')
    .map((value) => value.toLowerCase());

  return candidates.find(Boolean) || '';
}

function isFailedOrder(order: AnyRecord) {
  const status = orderStatus(order);
  return ['failed', 'error', 'cancelled', 'canceled', 'abandoned', 'checkout_failed', 'payment_failed'].some((word) => status.includes(word));
}

function issueTone(severity: HealthIssue['severity']) {
  if (severity === 'critical') return 'red' as const;
  if (severity === 'warning') return 'yellow' as const;
  return 'blue' as const;
}

function areaIcon(area: HealthIssue['area']) {
  if (area === 'Environment') return Database;
  if (area === 'Store setup') return Store;
  if (area === 'Billing') return ReceiptText;
  if (area === 'Orders') return CircleAlert;
  return Webhook;
}

async function safeList(collection: string, limit: number) {
  try {
    const result = await listFirestoreDocuments(collection, limit);
    return { ok: true, documents: result.documents as AnyRecord[], error: null as string | null };
  } catch (error) {
    return {
      ok: false,
      documents: [] as AnyRecord[],
      error: error instanceof Error ? error.message : `Unable to read ${collection}.`,
    };
  }
}

async function loadCheckoutHealth() {
  const env = getFirebaseEnvStatus();
  const issues: HealthIssue[] = [];

  if (!env.ready) {
    issues.push({
      id: 'firebase-env-missing',
      severity: 'critical',
      area: 'Environment',
      title: 'Firebase connection is not ready',
      cause: 'The admin cannot inspect stores, orders, or checkout setup because Firebase credentials are missing.',
      fix: 'Add FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY in Vercel.',
    });

    return {
      env,
      stores: [] as AnyRecord[],
      orders: [] as AnyRecord[],
      failedDeliveries: await listDeliveries({ status: 'failed' }).catch(() => []),
      collectionErrors: [] as string[],
      issues,
    };
  }

  const [storeSettingsResult, storesResult, ordersResult, failedDeliveries] = await Promise.all([
    safeList('storeSettings', 100),
    safeList('stores', 100),
    safeList('integrationOrders', 100),
    listDeliveries({ status: 'failed' }).catch(() => []),
  ]);

  const storesById = new Map<string, AnyRecord>();
  for (const store of [...storesResult.documents, ...storeSettingsResult.documents]) {
    const id = storeId(store);
    if (id && !storesById.has(id)) storesById.set(id, store);
  }

  const stores = Array.from(storesById.values());
  const collectionErrors = [storeSettingsResult, storesResult, ordersResult]
    .filter((result) => !result.ok && result.error)
    .map((result) => result.error as string);

  if (collectionErrors.length > 0) {
    collectionErrors.forEach((error, index) => {
      issues.push({
        id: `collection-error-${index}`,
        severity: 'warning',
        area: 'Environment',
        title: 'Some diagnostic data could not be loaded',
        cause: error,
        fix: 'Confirm the Firestore collection name exists and the service account has read permission.',
      });
    });
  }

  if (!process.env.SEDIFEX_INTEGRATION_API_BASE_URL) {
    issues.push({
      id: 'missing-integration-api-base-url',
      severity: 'critical',
      area: 'Environment',
      title: 'Integration API base URL is missing',
      cause: 'Checkout preview and partner integrations usually need SEDIFEX_INTEGRATION_API_BASE_URL.',
      fix: 'Add SEDIFEX_INTEGRATION_API_BASE_URL in Vercel and redeploy the admin/marketplace project.',
    });
  }

  if (!process.env.SEDIFEX_CHECKOUT_RETURN_URL) {
    issues.push({
      id: 'missing-checkout-return-url',
      severity: 'warning',
      area: 'Environment',
      title: 'Checkout return URL is not configured',
      cause: 'Customers may not return cleanly to the website after payment.',
      fix: 'Add SEDIFEX_CHECKOUT_RETURN_URL for the domain that receives successful checkout redirects.',
    });
  }

  if (!process.env.SEDIFEX_WEBHOOK_SECRET) {
    issues.push({
      id: 'missing-webhook-secret',
      severity: 'warning',
      area: 'Environment',
      title: 'Webhook shared secret is missing',
      cause: 'Webhook receivers may not be able to verify Sedifex delivery signatures.',
      fix: 'Add SEDIFEX_WEBHOOK_SECRET and use the same value on connected receivers.',
    });
  }

  for (const store of stores) {
    const id = storeId(store);
    const name = storeName(store);
    const href = id ? `/admin/stores/${encodeURIComponent(id)}` : '/admin/stores';

    if (!id) {
      issues.push({
        id: `store-no-id-${name}`,
        severity: 'critical',
        area: 'Store setup',
        title: `${name} has no store ID`,
        cause: 'Checkout preview requires a stable store or merchant ID to resolve items and payment setup.',
        fix: 'Repair the store document ID or recreate the store with a stable ID.',
        href: '/admin/stores',
      });
      continue;
    }

    if (checkoutDisabled(store)) {
      issues.push({
        id: `checkout-disabled-${id}`,
        severity: 'warning',
        area: 'Store setup',
        title: `${name} has checkout disabled`,
        storeId: id,
        cause: 'A checkout enabled flag is set to false on this store.',
        fix: 'Open the store profile, confirm billing/setup, then enable online checkout when the business is ready.',
        href,
      });
    }

    if (billingExpired(store)) {
      issues.push({
        id: `billing-expired-${id}`,
        severity: 'critical',
        area: 'Billing',
        title: `${name} billing period has expired`,
        storeId: id,
        cause: 'The billing current period or grace period is already past.',
        fix: 'Confirm payment, extend the billing period, or pause checkout intentionally.',
        href,
      });
    }

    if (moneyFieldsMissing(store)) {
      issues.push({
        id: `currency-missing-${id}`,
        severity: 'warning',
        area: 'Store setup',
        title: `${name} has no clear currency`,
        storeId: id,
        cause: 'The store does not expose a top-level currency/defaultCurrency or billing.currency.',
        fix: 'Set the store currency, normally GHS for Ghana stores, so checkout totals are clear.',
        href,
      });
    }
  }

  const failedOrders = ordersResult.documents.filter(isFailedOrder);
  failedOrders.slice(0, 12).forEach((order) => {
    const id = typeof order.id === 'string' ? order.id : 'unknown-order';
    const orderStoreId = textValue(order, ['storeId', 'merchantId', 'store_id']) || 'Unknown store';

    issues.push({
      id: `failed-order-${id}`,
      severity: 'critical',
      area: 'Orders',
      title: `Failed checkout/order: ${id}`,
      storeId: orderStoreId,
      cause: `Latest status: ${orderStatus(order) || 'unknown'}.`,
      fix: 'Open the order, check item IDs, store ID, merchant token, and payment provider response.',
      href: '/admin/orders',
    });
  });

  failedDeliveries.slice(0, 12).forEach((delivery) => {
    issues.push({
      id: `failed-delivery-${delivery.id}`,
      severity: delivery.nextRetryAt ? 'warning' : 'critical',
      area: 'Webhooks',
      title: `Failed webhook delivery: ${delivery.eventType}`,
      cause: `Endpoint ${delivery.endpointId} returned ${delivery.responseCode || 'no response'}: ${delivery.responseBodySnippet || 'No response body.'}`,
      fix: 'Open Webhook Deliveries, check the receiver URL, then replay after the receiver is fixed.',
      href: `/admin/deliveries?endpointId=${encodeURIComponent(delivery.endpointId)}&status=failed`,
    });
  });

  return {
    env,
    stores,
    orders: ordersResult.documents,
    failedDeliveries,
    collectionErrors,
    issues,
  };
}

export default async function CheckoutHealthPage() {
  const health = await loadCheckoutHealth();
  const critical = health.issues.filter((issue) => issue.severity === 'critical').length;
  const warnings = health.issues.filter((issue) => issue.severity === 'warning').length;
  const storeIssues = health.issues.filter((issue) => issue.area === 'Store setup' || issue.area === 'Billing').length;
  const orderIssues = health.issues.filter((issue) => issue.area === 'Orders').length;
  const webhookIssues = health.issues.filter((issue) => issue.area === 'Webhooks').length;

  const stats = [
    { label: 'Open issues', value: String(health.issues.length), delta: health.issues.length ? 'Needs review' : 'All clear' },
    { label: 'Critical', value: String(critical), delta: critical ? 'Fix first' : 'No critical issue' },
    { label: 'Store setup', value: String(storeIssues), delta: `${health.stores.length} stores checked` },
    { label: 'Failed orders', value: String(orderIssues), delta: `${health.orders.length} recent orders checked` },
    { label: 'Failed webhooks', value: String(webhookIssues), delta: `${health.failedDeliveries.length} failed deliveries found` },
  ];

  const environmentItems = [
    { label: 'Firebase credentials', ready: health.env.ready, note: health.env.ready ? 'Ready' : 'Missing' },
    { label: 'Integration API base URL', ready: Boolean(process.env.SEDIFEX_INTEGRATION_API_BASE_URL), note: process.env.SEDIFEX_INTEGRATION_API_BASE_URL ? 'Ready' : 'Missing' },
    { label: 'Checkout return URL', ready: Boolean(process.env.SEDIFEX_CHECKOUT_RETURN_URL), note: process.env.SEDIFEX_CHECKOUT_RETURN_URL ? 'Ready' : 'Recommended' },
    { label: 'Webhook shared secret', ready: Boolean(process.env.SEDIFEX_WEBHOOK_SECRET), note: process.env.SEDIFEX_WEBHOOK_SECRET ? 'Ready' : 'Recommended' },
  ];

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-slate-950 p-6 text-white shadow-sm sm:p-8">
        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-300/20 bg-amber-400/10 px-3 py-1 text-xs font-semibold text-amber-100">
              <Wrench className="h-4 w-4" />
              Checkout diagnostics
            </div>
            <h2 className="mt-5 max-w-2xl text-3xl font-bold tracking-tight sm:text-4xl">
              Find store setup, checkout, order, and webhook problems before customers complain.
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300">
              This page checks Firestore setup, recent integration orders, failed webhook deliveries, and the environment variables required for checkout.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            <p className="text-sm font-semibold text-slate-200">Current readiness</p>
            <div className="mt-4 space-y-3">
              {environmentItems.map((item) => (
                <div key={item.label} className="flex items-center justify-between gap-3 text-sm text-slate-300">
                  <span>{item.label}</span>
                  <StatusBadge tone={item.ready ? 'green' : item.note === 'Recommended' ? 'yellow' : 'red'}>{item.note}</StatusBadge>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {stats.map((stat) => <StatCard key={stat.label} {...stat} />)}
      </section>

      {health.issues.length === 0 ? (
        <SectionCard title="Checkout health result">
          <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-800">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="font-semibold">No checkout issues were detected from the available data.</p>
              <p className="mt-1 leading-6">Keep monitoring orders, failed payments, and webhook deliveries as more stores go live.</p>
            </div>
          </div>
        </SectionCard>
      ) : (
        <SectionCard title="Issues to fix first">
          <div className="space-y-3">
            {health.issues.map((issue) => {
              const Icon = areaIcon(issue.area);

              return (
                <div key={issue.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-600">
                        <Icon className="h-5 w-5" />
                      </span>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-sm font-semibold text-slate-950">{issue.title}</h3>
                          <StatusBadge tone={issueTone(issue.severity)}>{issue.severity}</StatusBadge>
                          <StatusBadge tone="slate">{issue.area}</StatusBadge>
                        </div>
                        {issue.storeId ? <p className="mt-1 text-xs text-slate-500">Store: {issue.storeId}</p> : null}
                      </div>
                    </div>
                    {issue.href ? (
                      <Link href={issue.href} className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-indigo-600 transition hover:bg-indigo-50">
                        Open fix
                      </Link>
                    ) : null}
                  </div>
                  <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                    <div className="rounded-2xl bg-slate-50 p-4">
                      <p className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        Cause
                      </p>
                      <p className="leading-6 text-slate-700">{issue.cause}</p>
                    </div>
                    <div className="rounded-2xl bg-indigo-50 p-4">
                      <p className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-indigo-700">
                        <Wrench className="h-3.5 w-3.5" />
                        Fix
                      </p>
                      <p className="leading-6 text-slate-700">{issue.fix}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </SectionCard>
      )}

      <section className="grid gap-6 xl:grid-cols-3">
        <SectionCard title="Fix playbook">
          <div className="space-y-3 text-sm text-slate-600">
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="font-semibold text-slate-950">1. Fix critical environment issues</p>
              <p className="mt-1 leading-6">Firebase and checkout API URLs must be ready before debugging individual stores.</p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="font-semibold text-slate-950">2. Fix store setup</p>
              <p className="mt-1 leading-6">Check store ID, billing, checkout status, currency, and item visibility.</p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="font-semibold text-slate-950">3. Replay failed webhooks</p>
              <p className="mt-1 leading-6">After the receiver is fixed, go to Webhook Deliveries and replay the failed delivery.</p>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Useful pages">
          <div className="space-y-3 text-sm">
            <Link href="/admin/stores" className="block rounded-2xl border border-slate-200 p-4 font-semibold text-slate-800 transition hover:bg-slate-50">
              Store directory
            </Link>
            <Link href="/admin/orders" className="block rounded-2xl border border-slate-200 p-4 font-semibold text-slate-800 transition hover:bg-slate-50">
              Orders and payments
            </Link>
            <Link href="/admin/deliveries" className="block rounded-2xl border border-slate-200 p-4 font-semibold text-slate-800 transition hover:bg-slate-50">
              Webhook deliveries
            </Link>
          </div>
        </SectionCard>

        <SectionCard title="What this page checks">
          <div className="space-y-3 text-sm text-slate-600">
            <div className="rounded-2xl bg-slate-50 p-4">Environment variables needed for checkout and sync.</div>
            <div className="rounded-2xl bg-slate-50 p-4">Store settings, billing dates, disabled checkout flags, and missing currency.</div>
            <div className="rounded-2xl bg-slate-50 p-4">Recent failed orders and failed webhook delivery records.</div>
          </div>
        </SectionCard>
      </section>
    </div>
  );
}
