import Link from 'next/link';
import { AlertTriangle, ArrowUpRight, CheckCircle2, Clock, Database, KeyRound, PackageCheck, RefreshCw, Store, TriangleAlert } from 'lucide-react';
import { SectionCard, StatCard, StatusBadge } from '../../../components/admin/ui';
import { getFirebaseEnvStatus, listFirestoreDocuments } from '../../../lib/firebase-admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type StoreSettings = Record<string, unknown> & {
  id?: string;
  path?: string;
  updateTime?: string | null;
};

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function valueAt(record: Record<string, unknown>, path: string[]) {
  let current: unknown = record;
  for (const key of path) current = asObject(current)[key];
  return current;
}

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function boolValue(value: unknown) {
  return value === true;
}

function storeName(settings: StoreSettings) {
  return cleanText(settings.storeName) || cleanText(settings.name) || cleanText(settings.businessName) || cleanText(settings.displayName) || cleanText(settings.id) || 'Unnamed store';
}

function merchantId(settings: StoreSettings) {
  return cleanText(valueAt(settings, ['googleShopping', 'connection', 'merchantId'])) || cleanText(valueAt(settings, ['integrations', 'googleMerchant', 'selectedMerchantId']));
}

function isConnected(settings: StoreSettings) {
  return boolValue(valueAt(settings, ['googleShopping', 'connection', 'connected'])) || Boolean(merchantId(settings));
}

function autoSyncEnabled(settings: StoreSettings) {
  return valueAt(settings, ['googleShopping', 'catalogSync', 'autoSyncEnabled']) !== false && isConnected(settings);
}

function refreshToken(settings: StoreSettings) {
  return cleanText(valueAt(settings, ['integrations', 'googleMerchant', 'refreshToken'])) || cleanText(valueAt(settings, ['googleShopping', 'catalogSync', 'refreshToken']));
}

function accessToken(settings: StoreSettings) {
  return cleanText(valueAt(settings, ['integrations', 'googleMerchant', 'accessToken'])) || cleanText(valueAt(settings, ['googleShopping', 'catalogSync', 'accessToken']));
}

function tokenExpiry(settings: StoreSettings) {
  return valueAt(settings, ['integrations', 'googleMerchant', 'expiresAt']) || valueAt(settings, ['googleShopping', 'catalogSync', 'tokenExpiry']);
}

function syncStatus(settings: StoreSettings) {
  return cleanText(valueAt(settings, ['googleShopping', 'status', 'state'])) || cleanText(valueAt(settings, ['googleShopping', 'catalogSync', 'status'])) || 'unknown';
}

function syncMessage(settings: StoreSettings) {
  return cleanText(valueAt(settings, ['googleShopping', 'status', 'message'])) || 'No sync message yet';
}

function validationSummary(settings: StoreSettings) {
  return asObject(valueAt(settings, ['googleShopping', 'status', 'validationSummary']));
}

function numberValue(value: unknown) {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function blockingCount(settings: StoreSettings) {
  return numberValue(validationSummary(settings).blockingCount);
}

function lastRun(settings: StoreSettings) {
  return valueAt(settings, ['googleShopping', 'status', 'lastRunAt']) || valueAt(settings, ['googleShopping', 'catalogSync', 'updatedAt']) || settings.updateTime;
}

function formatDate(value: unknown) {
  if (!value) return '—';
  if (typeof value === 'string') {
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return '—';
    return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
  }
  if (typeof value === 'object' && value !== null) {
    const seconds = (value as { seconds?: unknown; _seconds?: unknown }).seconds ?? (value as { _seconds?: unknown })._seconds;
    if (typeof seconds === 'number') return formatDate(new Date(seconds * 1000).toISOString());
  }
  return '—';
}

function tokenTone(settings: StoreSettings) {
  if (!accessToken(settings)) return 'red' as const;
  if (!refreshToken(settings)) return 'yellow' as const;
  return 'green' as const;
}

function statusTone(status: string) {
  const value = status.toLowerCase();
  if (value.includes('success') || value.includes('idle') || value.includes('ready')) return 'green' as const;
  if (value.includes('error') || value.includes('failed')) return 'red' as const;
  if (value.includes('sync') || value.includes('pending') || value.includes('admin')) return 'yellow' as const;
  return 'slate' as const;
}

async function loadGoogleShoppingData() {
  const env = getFirebaseEnvStatus();

  if (!env.ready) {
    return {
      ok: false,
      error: 'Firebase envs are not ready in Vercel.',
      settings: [] as StoreSettings[],
    };
  }

  try {
    const result = await listFirestoreDocuments('storeSettings', 100);
    return { ok: true, error: null, settings: result.documents as StoreSettings[] };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Unable to load Google Shopping settings.',
      settings: [] as StoreSettings[],
    };
  }
}

export default async function GoogleShoppingPage() {
  const result = await loadGoogleShoppingData();
  const settings = result.settings;
  const connected = settings.filter(isConnected);
  const autoSync = settings.filter(autoSyncEnabled);
  const missingRefreshToken = connected.filter((item) => !refreshToken(item));
  const missingAccessToken = connected.filter((item) => !accessToken(item));
  const syncErrors = connected.filter((item) => statusTone(syncStatus(item)) === 'red');
  const validationIssues = connected.filter((item) => blockingCount(item) > 0);
  const needsReview = [...missingRefreshToken, ...missingAccessToken, ...syncErrors, ...validationIssues]
    .filter((item, index, array) => array.findIndex((entry) => entry.id === item.id) === index)
    .slice(0, 15);

  const stats = [
    { label: 'Store settings', value: result.ok ? String(settings.length) : 'Setup', delta: result.ok ? 'Loaded from storeSettings' : 'Database not ready' },
    { label: 'Merchant connected', value: result.ok ? String(connected.length) : '—', delta: 'Google Merchant connection found' },
    { label: 'Auto sync enabled', value: result.ok ? String(autoSync.length) : '—', delta: 'Catalog sync active' },
    { label: 'Need review', value: result.ok ? String(needsReview.length) : '—', delta: 'Token, sync, or validation issue' },
  ];

  const healthCards = [
    { label: 'Missing refresh token', value: String(missingRefreshToken.length), icon: KeyRound, tone: missingRefreshToken.length ? ('yellow' as const) : ('green' as const) },
    { label: 'Missing access token', value: String(missingAccessToken.length), icon: TriangleAlert, tone: missingAccessToken.length ? ('red' as const) : ('green' as const) },
    { label: 'Sync errors', value: String(syncErrors.length), icon: AlertTriangle, tone: syncErrors.length ? ('red' as const) : ('green' as const) },
    { label: 'Validation blockers', value: String(validationIssues.length), icon: PackageCheck, tone: validationIssues.length ? ('yellow' as const) : ('green' as const) },
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
              <p className="font-semibold">Google Shopping data is not available yet.</p>
              <p className="mt-1 leading-6">{result.error}</p>
            </div>
          </div>
        </section>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[1.45fr_0.9fr]">
        <div className="space-y-6">
          <SectionCard
            title="Google Shopping store review"
            action={<Link href="/admin/products" className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-500">Products <ArrowUpRight className="h-3.5 w-3.5" /></Link>}
          >
            <div className="overflow-hidden rounded-2xl border border-slate-200">
              <div className="grid grid-cols-[1.1fr_0.8fr_0.65fr_0.65fr_0.8fr_auto] bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 max-lg:hidden">
                <span>Store</span><span>Merchant</span><span>Auto sync</span><span>Token</span><span>Last run</span><span>Status</span>
              </div>
              <div className="divide-y divide-slate-200">
                {settings.length === 0 ? (
                  <div className="p-8 text-center text-sm text-slate-500">No storeSettings records found.</div>
                ) : settings.map((item) => (
                  <Link key={item.path || item.id} href={item.id ? `/admin/stores/${encodeURIComponent(String(item.id))}` : '/admin/stores'} className="grid gap-3 px-4 py-4 text-sm transition hover:bg-indigo-50/60 lg:grid-cols-[1.1fr_0.8fr_0.65fr_0.65fr_0.8fr_auto] lg:items-center">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-slate-950">{storeName(item)}</p>
                      <p className="truncate text-xs text-slate-500">{item.id || 'No store ID'}</p>
                    </div>
                    <p className="truncate text-slate-600">{merchantId(item) || 'Not connected'}</p>
                    <StatusBadge tone={autoSyncEnabled(item) ? 'green' : 'slate'}>{autoSyncEnabled(item) ? 'On' : 'Off'}</StatusBadge>
                    <StatusBadge tone={tokenTone(item)}>{refreshToken(item) ? 'Refresh OK' : accessToken(item) ? 'No refresh' : 'Missing'}</StatusBadge>
                    <p className="truncate text-slate-600">{formatDate(lastRun(item))}</p>
                    <StatusBadge tone={statusTone(syncStatus(item))}>{syncStatus(item)}</StatusBadge>
                  </Link>
                ))}
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Stores needing Google Shopping attention">
            <div className="overflow-hidden rounded-2xl border border-slate-200">
              <div className="grid grid-cols-[1.2fr_0.8fr_1fr_auto] bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 max-lg:hidden">
                <span>Store</span><span>Issue count</span><span>Message</span><span>Open</span>
              </div>
              <div className="divide-y divide-slate-200">
                {needsReview.length === 0 ? (
                  <div className="p-8 text-center text-sm text-slate-500">No Google Shopping issues found in the loaded sample.</div>
                ) : needsReview.map((item) => {
                  const issues = [
                    !refreshToken(item) ? 'missing refresh token' : null,
                    !accessToken(item) ? 'missing access token' : null,
                    statusTone(syncStatus(item)) === 'red' ? 'sync error' : null,
                    blockingCount(item) > 0 ? `${blockingCount(item)} validation blockers` : null,
                  ].filter(Boolean);

                  return (
                    <Link key={`review-${item.path || item.id}`} href={item.id ? `/admin/stores/${encodeURIComponent(String(item.id))}` : '/admin/stores'} className="grid gap-3 px-4 py-4 text-sm transition hover:bg-indigo-50/60 lg:grid-cols-[1.2fr_0.8fr_1fr_auto] lg:items-center">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-slate-950">{storeName(item)}</p>
                        <p className="truncate text-xs text-slate-500">{item.id}</p>
                      </div>
                      <StatusBadge tone={issues.length ? 'yellow' : 'green'}>{issues.length}</StatusBadge>
                      <p className="truncate text-slate-600">{issues.join(', ') || syncMessage(item)}</p>
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600">Open <ArrowUpRight className="h-3.5 w-3.5" /></span>
                    </Link>
                  );
                })}
              </div>
            </div>
          </SectionCard>
        </div>

        <div className="space-y-6">
          <SectionCard title="Connection health">
            <div className="space-y-3">
              {healthCards.map((item) => {
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

          <SectionCard title="Sync readiness rules">
            <div className="space-y-3 text-sm leading-6 text-slate-600">
              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="mb-2 flex items-center gap-2 font-semibold text-slate-950"><CheckCircle2 className="h-4 w-4 text-emerald-600" /> Merchant connected</div>
                Store should have googleShopping.connection.connected and a Merchant ID.
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="mb-2 flex items-center gap-2 font-semibold text-slate-950"><KeyRound className="h-4 w-4 text-indigo-600" /> Tokens available</div>
                Refresh token is important so the sync can continue after the access token expires.
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="mb-2 flex items-center gap-2 font-semibold text-slate-950"><RefreshCw className="h-4 w-4 text-amber-600" /> Auto sync</div>
                Auto sync should be enabled only when the integration base URL and API key are correct.
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="mb-2 flex items-center gap-2 font-semibold text-slate-950"><Database className="h-4 w-4 text-indigo-600" /> Data source</div>
                This page reads storeSettings.googleShopping and integrations.googleMerchant.
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Next Google Shopping upgrade">
            <div className="rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">
              Add a per-store sync history table and product validation breakdown for missing title, description, image, price, brand, and GTIN/MPN/SKU.
            </div>
          </SectionCard>
        </div>
      </section>
    </div>
  );
}
