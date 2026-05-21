import Link from 'next/link';
import { ExternalLink, KeyRound, PlugZap, Search, Settings, ShieldCheck, Store } from 'lucide-react';
import { SectionCard, StatCard, StatusBadge } from '../../../components/admin/ui';
import { adminFirestore, getFirebaseEnvStatus } from '../../../lib/firebase-admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type SearchParams = Record<string, string | string[] | undefined>;
type StoreSettingsRecord = Record<string, unknown> & { id: string; path: string };

type StoreSettingsData = {
  connected: boolean;
  error: string | null;
  settings: StoreSettingsRecord[];
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function text(value: unknown, fallback = '') {
  if (typeof value === 'string') return value.trim() || fallback;
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return fallback;
}

function selectedParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? '' : value ?? '';
}

function normalized(value: unknown) {
  return text(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function firstText(record: Record<string, unknown>, fields: string[], fallback = '') {
  for (const field of fields) {
    const value = text(record[field]);
    if (value) return value;
  }
  return fallback;
}

function settingName(record: StoreSettingsRecord) {
  return firstText(record, ['storeName', 'name', 'businessName', 'displayName', 'merchantName', 'fromName'], record.id);
}

function nested(record: Record<string, unknown>, path: string[]) {
  let current: unknown = record;
  for (const key of path) {
    const currentRecord = asRecord(current);
    if (!currentRecord) return undefined;
    current = currentRecord[key];
  }
  return current;
}

function googleShopping(record: StoreSettingsRecord) {
  return asRecord(record.googleShopping);
}

function googleConnection(record: StoreSettingsRecord) {
  return asRecord(googleShopping(record).connection);
}

function googleCatalogSync(record: StoreSettingsRecord) {
  return asRecord(googleShopping(record).catalogSync);
}

function googleStatus(record: StoreSettingsRecord) {
  return asRecord(googleShopping(record).status);
}

function integrationApi(record: StoreSettingsRecord) {
  return asRecord(record.integrationApi);
}

function bookingSync(record: StoreSettingsRecord) {
  return {
    ...asRecord(record.bookingSync),
    ...asRecord(record.appsScriptBookingSync),
    ...asRecord(record.integrationBookingConfig),
  };
}

function hasGoogleMerchant(record: StoreSettingsRecord) {
  const connection = googleConnection(record);
  const merchantId = text(connection.merchantId) || text(nested(record, ['integrations', 'googleMerchant', 'selectedMerchantId'])) || text(nested(record, ['integrations', 'googleMerchant', 'merchantId']));
  return connection.connected === true || Boolean(merchantId);
}

function autoSyncEnabled(record: StoreSettingsRecord) {
  return googleCatalogSync(record).autoSyncEnabled === true;
}

function hasIntegrationApi(record: StoreSettingsRecord) {
  const api = integrationApi(record);
  return record.integrationApiEnabled === true || api.enabled === true || Boolean(text(api.baseUrl) || text(api.checkoutCreateUrl) || text(record.latestIntegrationApiKeyPreview));
}

function hasBookingSync(record: StoreSettingsRecord) {
  const sync = bookingSync(record);
  return record.bookingSyncEnabled === true || record.appScriptBookingSyncEnabled === true || sync.enabled === true || Boolean(text(sync.webAppUrl) || text(sync.appsScriptUrl) || text(sync.url));
}

function matchesSearch(record: StoreSettingsRecord, query: string) {
  if (!query) return true;
  const haystack = normalized([
    record.id,
    settingName(record),
    text(googleConnection(record).merchantId),
    text(nested(record, ['integrations', 'googleMerchant', 'selectedMerchantId'])),
    text(integrationApi(record).baseUrl),
    text(bookingSync(record).webAppUrl),
    text(bookingSync(record).appsScriptUrl),
  ].join(' '));
  return haystack.includes(normalized(query));
}

function matchesStatus(record: StoreSettingsRecord, status: string) {
  if (!status || status === 'all') return true;
  if (status === 'google-connected') return hasGoogleMerchant(record);
  if (status === 'auto-sync') return autoSyncEnabled(record);
  if (status === 'api-ready') return hasIntegrationApi(record);
  if (status === 'booking-ready') return hasBookingSync(record);
  if (status === 'needs-review') return !hasGoogleMerchant(record) || !hasIntegrationApi(record);
  return true;
}

async function loadStoreSettings(): Promise<StoreSettingsData> {
  const env = getFirebaseEnvStatus();
  if (!env.ready) {
    return { connected: false, error: 'Firebase environment variables are not ready in this deployment.', settings: [] };
  }

  try {
    const snapshot = await adminFirestore().collection('storeSettings').limit(300).get();
    return {
      connected: true,
      error: null,
      settings: snapshot.docs.map((docSnap) => ({
        ...(docSnap.data() as Record<string, unknown>),
        id: docSnap.id,
        path: docSnap.ref.path,
      })),
    };
  } catch (error) {
    return {
      connected: false,
      error: error instanceof Error ? error.message : 'Unable to load /storeSettings.',
      settings: [],
    };
  }
}

function connectionTone(record: StoreSettingsRecord) {
  if (hasGoogleMerchant(record) && hasIntegrationApi(record)) return 'green' as const;
  if (hasGoogleMerchant(record) || hasIntegrationApi(record) || hasBookingSync(record)) return 'yellow' as const;
  return 'red' as const;
}

function safeUrl(value: unknown) {
  const raw = text(value);
  if (!raw) return '';
  try {
    const parsed = new URL(raw);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.toString() : '';
  } catch {
    return '';
  }
}

export default async function StoreSettingsPage({ searchParams }: { searchParams?: Promise<SearchParams> }) {
  const params = (await searchParams) || {};
  const q = selectedParam(params.q);
  const status = selectedParam(params.status) || 'all';
  const data = await loadStoreSettings();
  const settings = data.settings
    .filter((record) => matchesSearch(record, q))
    .filter((record) => matchesStatus(record, status))
    .sort((a, b) => settingName(a).localeCompare(settingName(b)));

  const googleConnected = data.settings.filter(hasGoogleMerchant).length;
  const autoSync = data.settings.filter(autoSyncEnabled).length;
  const apiReady = data.settings.filter(hasIntegrationApi).length;
  const bookingReady = data.settings.filter(hasBookingSync).length;

  const stats = [
    { label: 'Store settings', value: data.connected ? String(data.settings.length) : 'Setup', delta: '/storeSettings documents loaded' },
    { label: 'Google connected', value: data.connected ? String(googleConnected) : '—', delta: 'Merchant connection found' },
    { label: 'Integration API ready', value: data.connected ? String(apiReady) : '—', delta: 'API config or key preview present' },
    { label: 'Booking sync ready', value: data.connected ? String(bookingReady) : '—', delta: 'Apps Script/booking config present' },
  ];

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-slate-950 p-6 text-white shadow-sm sm:p-8">
        <div className="grid gap-8 lg:grid-cols-[1.25fr_0.75fr] lg:items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-indigo-300/20 bg-indigo-400/10 px-3 py-1 text-xs font-semibold text-indigo-100">
              <Settings className="h-4 w-4" /> Store Settings
            </div>
            <h2 className="mt-5 max-w-4xl text-3xl font-bold tracking-tight sm:text-4xl">
              Inspect the /storeSettings records separately from /stores.
            </h2>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300">
              Use this page for Google Merchant connection data, API setup, booking sync, Apps Script URLs, and integration readiness. The Google Sync product selector now uses /stores for business names.
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 text-sm text-slate-300">
            <p className="font-semibold text-white">Quick links</p>
            <div className="mt-4 space-y-3">
              <Link className="flex items-center justify-between gap-3 rounded-xl bg-white/5 p-3 text-white transition hover:bg-white/10" href="/admin/google-sync">
                Google product selector <ExternalLink className="h-4 w-4" />
              </Link>
              <Link className="flex items-center justify-between gap-3 rounded-xl bg-white/5 p-3 text-white transition hover:bg-white/10" href="/admin/stores">
                Stores collection <ExternalLink className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {data.error ? (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <div className="flex gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" /><div><p className="font-semibold">Store settings are not fully available.</p><p className="mt-1 leading-6">{data.error}</p></div></div>
        </section>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => <StatCard key={stat.label} {...stat} />)}
      </section>

      <SectionCard title="Filter /storeSettings">
        <form className="grid gap-3 md:grid-cols-[1fr_240px_auto] md:items-end">
          <label className="block">
            <span className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500"><Search className="h-4 w-4" /> Search</span>
            <input name="q" defaultValue={q} placeholder="Search store name, ID, merchant ID, URL..." className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-indigo-300 focus:ring-4 focus:ring-indigo-500/10" />
          </label>
          <label className="block">
            <span className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Status</span>
            <select name="status" defaultValue={status} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-indigo-300 focus:ring-4 focus:ring-indigo-500/10">
              <option value="all">All settings</option>
              <option value="google-connected">Google connected</option>
              <option value="auto-sync">Auto-sync enabled</option>
              <option value="api-ready">Integration API ready</option>
              <option value="booking-ready">Booking sync ready</option>
              <option value="needs-review">Needs review</option>
            </select>
          </label>
          <button className="inline-flex items-center justify-center rounded-2xl bg-slate-950 px-5 py-3 text-sm font-bold text-white transition hover:bg-slate-800">Apply</button>
        </form>
      </SectionCard>

      <SectionCard title={`Store settings records (${settings.length} shown)`}>
        {settings.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm leading-6 text-slate-600">
            No /storeSettings documents matched this filter.
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-200">
            <div className="hidden grid-cols-[1.1fr_0.9fr_0.9fr_0.9fr] gap-4 border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-500 lg:grid">
              <span>Store setting</span><span>Google Merchant</span><span>Integration / booking</span><span>Status</span>
            </div>
            <div className="divide-y divide-slate-100">
              {settings.slice(0, 140).map((record) => {
                const connection = googleConnection(record);
                const sync = googleCatalogSync(record);
                const statusData = googleStatus(record);
                const api = integrationApi(record);
                const booking = bookingSync(record);
                const merchantId = text(connection.merchantId) || text(nested(record, ['integrations', 'googleMerchant', 'selectedMerchantId'])) || text(nested(record, ['integrations', 'googleMerchant', 'merchantId']));
                const apiBase = text(api.baseUrl);
                const checkoutCreate = text(api.checkoutCreateUrl);
                const bookingUrl = safeUrl(booking.webAppUrl) || safeUrl(booking.appsScriptUrl) || safeUrl(booking.url);

                return (
                  <div key={record.id} className="grid gap-4 px-4 py-4 lg:grid-cols-[1.1fr_0.9fr_0.9fr_0.9fr] lg:items-start">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Store className="h-4 w-4 text-indigo-600" />
                        <h3 className="text-sm font-semibold text-slate-950">{settingName(record)}</h3>
                      </div>
                      <p className="mt-1 break-all text-xs text-slate-500">{record.path}</p>
                      <Link href={`/admin/stores/${encodeURIComponent(record.id)}`} className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-500">
                        Open matching store <ExternalLink className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                    <div className="space-y-2 text-sm text-slate-600">
                      <div className="flex flex-wrap gap-2">
                        <StatusBadge tone={hasGoogleMerchant(record) ? 'green' : 'red'}>{hasGoogleMerchant(record) ? 'Connected' : 'Not connected'}</StatusBadge>
                        <StatusBadge tone={autoSyncEnabled(record) ? 'green' : 'slate'}>{autoSyncEnabled(record) ? 'Auto-sync on' : 'Auto-sync off'}</StatusBadge>
                      </div>
                      <p><span className="font-semibold text-slate-900">Merchant:</span> {merchantId || '—'}</p>
                      <p><span className="font-semibold text-slate-900">Sync state:</span> {text(statusData.state, '—')}</p>
                      <p className="line-clamp-2"><span className="font-semibold text-slate-900">Message:</span> {text(statusData.message, '—')}</p>
                    </div>
                    <div className="space-y-2 text-sm text-slate-600">
                      <div className="flex flex-wrap gap-2">
                        <StatusBadge tone={hasIntegrationApi(record) ? 'green' : 'yellow'}>{hasIntegrationApi(record) ? 'API ready' : 'API missing'}</StatusBadge>
                        <StatusBadge tone={hasBookingSync(record) ? 'green' : 'slate'}>{hasBookingSync(record) ? 'Booking ready' : 'No booking sync'}</StatusBadge>
                      </div>
                      <p className="break-all"><KeyRound className="mr-1 inline h-3.5 w-3.5" />{text(record.latestIntegrationApiKeyPreview) || text(api.keyPreview) || 'No key preview'}</p>
                      <p className="break-all"><span className="font-semibold text-slate-900">Base:</span> {apiBase || '—'}</p>
                      <p className="break-all"><span className="font-semibold text-slate-900">Checkout:</span> {checkoutCreate || '—'}</p>
                      {bookingUrl ? <a className="inline-flex items-center gap-1 break-all text-xs font-semibold text-indigo-600" href={bookingUrl} target="_blank" rel="noreferrer"><PlugZap className="h-3.5 w-3.5" /> Booking Apps Script <ExternalLink className="h-3.5 w-3.5" /></a> : null}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <StatusBadge tone={connectionTone(record)}>{connectionTone(record) === 'green' ? 'Ready' : connectionTone(record) === 'yellow' ? 'Partial' : 'Needs setup'}</StatusBadge>
                      {record.bookingSyncEnabled === true || record.appScriptBookingSyncEnabled === true ? <StatusBadge tone="green">bookingSyncEnabled</StatusBadge> : null}
                      {record.integrationApiEnabled === true ? <StatusBadge tone="green">integrationApiEnabled</StatusBadge> : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
