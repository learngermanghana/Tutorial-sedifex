import { revalidatePath } from 'next/cache';
import Link from 'next/link';
import { CheckCircle2, ExternalLink, KeyRound, PlugZap, RotateCcw, Settings, ToggleLeft, ToggleRight } from 'lucide-react';
import { SectionCard, StatCard, StatusBadge } from '../../../../components/admin/ui';
import { adminFirestore, getFirebaseEnvStatus } from '../../../../lib/firebase-admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type StoreSettingsRecord = Record<string, unknown> & { id: string; path: string };
type StoreProfileRecord = Record<string, unknown> & { id: string };
type StoresById = Map<string, StoreProfileRecord>;
type StoreSettingsManageData = {
  error: string | null;
  settings: StoreSettingsRecord[];
  storesById: StoresById;
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

function settingName(record: StoreSettingsRecord, storesById: StoresById) {
  const store: StoreProfileRecord = storesById.get(record.id) ?? { id: record.id };
  return text(store.storeName || store.name || store.businessName || store.displayName || record.storeName || record.name || record.businessName, record.id);
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
  const integrations = asRecord(record.integrations);
  const merchant = asRecord(integrations.googleMerchant);
  return connection.connected === true || Boolean(text(connection.merchantId) || text(merchant.selectedMerchantId) || text(merchant.merchantId));
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

async function loadSettings(): Promise<StoreSettingsManageData> {
  const env = getFirebaseEnvStatus();
  if (!env.ready) return { error: 'Firebase environment variables are not ready.', settings: [], storesById: new Map<string, StoreProfileRecord>() };

  const db = adminFirestore();
  const [settingsSnap, storesSnap] = await Promise.all([
    db.collection('storeSettings').limit(400).get(),
    db.collection('stores').limit(400).get(),
  ]);

  const storesById: StoresById = new Map(storesSnap.docs.map((doc) => [doc.id, { ...(doc.data() as Record<string, unknown>), id: doc.id } as StoreProfileRecord]));
  const settings: StoreSettingsRecord[] = settingsSnap.docs.map((doc) => ({ ...(doc.data() as Record<string, unknown>), id: doc.id, path: doc.ref.path }));
  return { error: null, settings, storesById };
}

async function updateStoreSettings(formData: FormData) {
  'use server';

  const storeId = text(formData.get('storeId'));
  const action = text(formData.get('action'));
  if (!storeId || !['auto-sync-on', 'auto-sync-off', 'mark-api-ready', 'copy-store-basics', 'disable-booking-sync'].includes(action)) return;

  const db = adminFirestore();
  const now = new Date().toISOString();
  const settingsRef = db.collection('storeSettings').doc(storeId);

  if (action === 'auto-sync-on' || action === 'auto-sync-off') {
    await settingsRef.set({
      googleShopping: {
        catalogSync: {
          autoSyncEnabled: action === 'auto-sync-on',
          updatedAt: now,
        },
        updatedAt: now,
      },
      adminUpdatedAt: now,
      adminUpdatedFrom: 'store-settings-manage',
    }, { merge: true });
  }

  if (action === 'mark-api-ready') {
    await settingsRef.set({
      integrationApiEnabled: true,
      integrationApi: {
        enabled: true,
        baseUrl: 'https://us-central1-sedifex-web.cloudfunctions.net',
        checkoutCreateUrl: 'https://us-central1-sedifex-web.cloudfunctions.net/integrationCheckoutCreate',
        contractVersion: '2026-04-13',
        updatedAt: now,
      },
      adminUpdatedAt: now,
      adminUpdatedFrom: 'store-settings-manage',
    }, { merge: true });
  }

  if (action === 'copy-store-basics') {
    const storeSnap = await db.collection('stores').doc(storeId).get();
    const store = asRecord(storeSnap.data());
    await settingsRef.set({
      storeName: text(store.storeName || store.name || store.businessName || store.displayName),
      name: text(store.name || store.storeName || store.businessName),
      businessName: text(store.businessName || store.storeName || store.name),
      phone: text(store.phone || store.storePhone || store.whatsappNumber),
      storePhone: text(store.storePhone || store.phone || store.whatsappNumber),
      email: text(store.email || store.storeEmail || store.contactEmail),
      updatedAt: now,
      adminUpdatedAt: now,
      adminUpdatedFrom: 'store-settings-manage',
    }, { merge: true });
  }

  if (action === 'disable-booking-sync') {
    await settingsRef.set({
      bookingSyncEnabled: false,
      appScriptBookingSyncEnabled: false,
      bookingSync: { enabled: false, updatedAt: now },
      appsScriptBookingSync: { enabled: false, updatedAt: now },
      integrationBookingConfig: { enabled: false, updatedAt: now },
      adminUpdatedAt: now,
      adminUpdatedFrom: 'store-settings-manage',
    }, { merge: true });
  }

  await db.collection('adminAuditLogs').add({ action: `store_settings_${action}`, storeId, actor: 'sedifexadmin', createdAt: now });
  revalidatePath('/admin/store-settings');
  revalidatePath('/admin/store-settings/manage');
}

export default async function ManageStoreSettingsPage() {
  const data = await loadSettings();
  const settings = data.settings.sort((a, b) => settingName(a, data.storesById).localeCompare(settingName(b, data.storesById)));

  const googleConnected = settings.filter(hasGoogleMerchant).length;
  const autoSync = settings.filter(autoSyncEnabled).length;
  const apiReady = settings.filter(hasIntegrationApi).length;
  const bookingReady = settings.filter(hasBookingSync).length;

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-slate-950 p-6 text-white shadow-sm sm:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-indigo-300/20 bg-indigo-400/10 px-3 py-1 text-xs font-semibold text-indigo-100">
              <Settings className="h-4 w-4" /> Editable Store Settings
            </div>
            <h2 className="mt-5 max-w-4xl text-3xl font-bold tracking-tight sm:text-4xl">Manage /storeSettings without opening Firestore.</h2>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300">Turn Google auto-sync on/off, mark integration API config ready, copy basic store profile values into storeSettings, and disable booking sync when needed.</p>
          </div>
          <Link href="/admin/store-settings" className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-bold text-slate-950 hover:bg-slate-100">
            Back to Store Settings <ExternalLink className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {data.error ? <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">{data.error}</div> : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Settings docs" value={String(settings.length)} delta="Loaded from /storeSettings" />
        <StatCard label="Google connected" value={String(googleConnected)} delta="Merchant connection exists" />
        <StatCard label="Auto-sync on" value={String(autoSync)} delta="Google API sync enabled" />
        <StatCard label="API ready" value={String(apiReady)} delta="Integration API fields present" />
      </section>

      <SectionCard title="Editable store settings actions">
        <div className="divide-y divide-slate-100">
          {settings.map((record) => {
            const api = integrationApi(record);
            const sync = bookingSync(record);
            return (
              <div key={record.id} className="grid gap-4 py-5 lg:grid-cols-[1fr_280px_420px] lg:items-center">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-slate-950">{settingName(record, data.storesById)}</h3>
                    <StatusBadge tone={hasGoogleMerchant(record) ? 'green' : 'slate'}>{hasGoogleMerchant(record) ? 'Google connected' : 'No Google'}</StatusBadge>
                    <StatusBadge tone={autoSyncEnabled(record) ? 'green' : 'yellow'}>{autoSyncEnabled(record) ? 'Auto-sync on' : 'Auto-sync off'}</StatusBadge>
                  </div>
                  <p className="mt-1 break-all text-xs text-slate-500">{record.path}</p>
                </div>
                <div className="text-sm text-slate-600">
                  <p><KeyRound className="mr-1 inline h-3.5 w-3.5" /><strong>Key:</strong> {text(record.latestIntegrationApiKeyPreview || api.keyPreview, 'No key preview')}</p>
                  <p className="break-all"><strong>Base:</strong> {text(api.baseUrl, '—')}</p>
                  <p className="break-all"><PlugZap className="mr-1 inline h-3.5 w-3.5" /><strong>Booking:</strong> {text(sync.webAppUrl || sync.appsScriptUrl || sync.url, '—')}</p>
                </div>
                <div className="flex flex-wrap gap-2 lg:justify-end">
                  <form action={updateStoreSettings}><input type="hidden" name="storeId" value={record.id} /><button name="action" value="auto-sync-on" className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-500"><ToggleRight className="h-4 w-4" /> Auto-sync on</button></form>
                  <form action={updateStoreSettings}><input type="hidden" name="storeId" value={record.id} /><button name="action" value="auto-sync-off" className="inline-flex items-center gap-2 rounded-2xl bg-slate-700 px-3 py-2 text-xs font-bold text-white hover:bg-slate-600"><ToggleLeft className="h-4 w-4" /> Auto-sync off</button></form>
                  <form action={updateStoreSettings}><input type="hidden" name="storeId" value={record.id} /><button name="action" value="mark-api-ready" className="inline-flex items-center gap-2 rounded-2xl bg-indigo-600 px-3 py-2 text-xs font-bold text-white hover:bg-indigo-500"><CheckCircle2 className="h-4 w-4" /> Mark API ready</button></form>
                  <form action={updateStoreSettings}><input type="hidden" name="storeId" value={record.id} /><button name="action" value="copy-store-basics" className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-3 py-2 text-xs font-bold text-white hover:bg-blue-500"><RotateCcw className="h-4 w-4" /> Copy store basics</button></form>
                  <form action={updateStoreSettings}><input type="hidden" name="storeId" value={record.id} /><button name="action" value="disable-booking-sync" className="inline-flex items-center gap-2 rounded-2xl bg-rose-600 px-3 py-2 text-xs font-bold text-white hover:bg-rose-500">Disable booking sync</button></form>
                </div>
              </div>
            );
          })}
        </div>
      </SectionCard>
    </div>
  );
}
