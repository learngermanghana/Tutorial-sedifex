import Link from 'next/link';
import { revalidatePath } from 'next/cache';
import { ArrowLeft, Database, History, PackageSearch, ReceiptText, Save, Settings, Store, Webhook } from 'lucide-react';
import { SectionCard, StatusBadge } from '../../../../components/admin/ui';
import { getFirebaseEnvStatus, getFirestoreDocument, setFirestoreDocument } from '../../../../lib/firebase-admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Params = Promise<{ storeId: string }>;
type StoreRecord = Record<string, unknown> & { id?: string; path?: string; updateTime?: string | null; createTime?: string | null };

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function nestedValue(store: StoreRecord, keys: string[]) {
  let current: unknown = store;
  for (const key of keys) {
    const currentObject = asObject(current);
    if (!currentObject) return undefined;
    current = currentObject[key];
  }
  return current;
}

function fieldText(store: StoreRecord, fields: string[], fallback = 'Not set') {
  for (const field of fields) {
    const value = store[field];
    if (typeof value === 'string' && value.trim()) return value;
    if (typeof value === 'number') return String(value);
  }
  return fallback;
}

function nestedText(store: StoreRecord, keys: string[], fallback = 'Not set') {
  const value = nestedValue(store, keys);
  if (typeof value === 'string' && value.trim()) return value;
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return fallback;
}

function storeName(store: StoreRecord) {
  return fieldText(store, ['storeName', 'name', 'businessName', 'displayName', 'merchantName', 'id'], 'Unnamed store');
}

function boolStatus(value: unknown) {
  return value === true ? { label: 'On', tone: 'green' as const } : { label: 'Off', tone: 'slate' as const };
}

function formatDate(value: unknown) {
  if (typeof value !== 'string') return 'Not available';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'Not available';
  return new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function stripDocumentMeta(store: StoreRecord) {
  const copy: Record<string, unknown> = { ...store };
  delete copy.id;
  delete copy.path;
  delete copy.createTime;
  delete copy.updateTime;
  return copy;
}

async function updateGoogleShoppingSettings(storeId: string, formData: FormData) {
  'use server';

  const current = (await getFirestoreDocument(`storeSettings/${storeId}`)) as StoreRecord;
  const data = stripDocumentMeta(current);
  const googleShopping = asObject(data.googleShopping) || {};
  const catalogSync = asObject(googleShopping.catalogSync) || {};
  const now = new Date().toISOString();
  const rawBaseUrl = String(formData.get('integrationBaseUrl') || '').trim();
  const previousAutoSync = catalogSync.autoSyncEnabled === true;
  const nextAutoSync = formData.get('autoSyncEnabled') === 'on';
  const previousBaseUrl = typeof catalogSync.integrationBaseUrl === 'string' ? catalogSync.integrationBaseUrl : '';
  const nextBaseUrl = rawBaseUrl || previousBaseUrl;
  const changedFields = [
    previousAutoSync !== nextAutoSync ? 'googleShopping.catalogSync.autoSyncEnabled' : null,
    previousBaseUrl !== nextBaseUrl ? 'googleShopping.catalogSync.integrationBaseUrl' : null,
  ].filter(Boolean);

  data.googleShopping = {
    ...googleShopping,
    catalogSync: {
      ...catalogSync,
      autoSyncEnabled: nextAutoSync,
      integrationBaseUrl: nextBaseUrl,
      status: 'admin_updated',
      updatedAt: now,
    },
  };
  data.adminUpdatedAt = now;
  data.adminUpdatedFrom = 'sedifexadmin';

  await setFirestoreDocument(`storeSettings/${storeId}`, data);
  await setFirestoreDocument(`storeSettings/${storeId}/adminAudit/${Date.now()}`, {
    action: 'google_shopping_settings_updated',
    actor: 'sedifexadmin',
    createdAt: now,
    changedFields,
    before: {
      autoSyncEnabled: previousAutoSync,
      integrationBaseUrl: previousBaseUrl || null,
    },
    after: {
      autoSyncEnabled: nextAutoSync,
      integrationBaseUrl: nextBaseUrl || null,
    },
  });

  revalidatePath('/admin');
  revalidatePath('/admin/stores');
  revalidatePath(`/admin/stores/${encodeURIComponent(storeId)}`);
}

async function loadStore(storeId: string) {
  const env = getFirebaseEnvStatus();
  if (!env.ready) return { ok: false, error: 'Firebase envs are not ready in Vercel.', store: null as StoreRecord | null };

  try {
    const store = await getFirestoreDocument(`storeSettings/${storeId}`);
    return { ok: true, error: null, store: store as StoreRecord };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Unable to load this store.',
      store: null as StoreRecord | null,
    };
  }
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 break-words text-sm font-semibold text-slate-950">{value}</p>
    </div>
  );
}

export default async function StoreDetailPage({ params }: { params: Params }) {
  const { storeId } = await params;
  const decodedStoreId = decodeURIComponent(storeId);
  const result = await loadStore(decodedStoreId);
  const store = result.store;

  if (!store) {
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

  const shopping = boolStatus(nestedValue(store, ['googleShopping', 'connection', 'connected']));
  const autoSync = boolStatus(nestedValue(store, ['googleShopping', 'catalogSync', 'autoSyncEnabled']));
  const integrationBaseUrl = nestedText(store, ['googleShopping', 'catalogSync', 'integrationBaseUrl'], '');
  const updateAction = updateGoogleShoppingSettings.bind(null, decodedStoreId);

  return (
    <div className="space-y-6">
      <Link href="/admin/stores" className="inline-flex items-center gap-2 text-sm font-semibold text-indigo-600 hover:text-indigo-500">
        <ArrowLeft className="h-4 w-4" /> Back to stores
      </Link>

      <section className="rounded-3xl border border-slate-200 bg-slate-950 p-6 text-white shadow-sm sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-indigo-300/20 bg-indigo-400/10 px-3 py-1 text-xs font-semibold text-indigo-100">
              <Store className="h-4 w-4" /> Store profile
            </div>
            <h2 className="mt-5 text-3xl font-bold tracking-tight sm:text-4xl">{storeName(store)}</h2>
            <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-300">Store ID: {store.id || decodedStoreId}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <StatusBadge tone={shopping.tone}>Shopping {shopping.label}</StatusBadge>
            <StatusBadge tone={autoSync.tone}>Auto sync {autoSync.label}</StatusBadge>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-6">
          <SectionCard title="Store basics">
            <div className="grid gap-3 sm:grid-cols-2">
              <InfoRow label="Contact" value={fieldText(store, ['owner', 'ownerName', 'adminName', 'email', 'ownerEmail'])} />
              <InfoRow label="Phone" value={fieldText(store, ['phone', 'contactPhone', 'businessPhone', 'whatsapp', 'whatsappNumber'])} />
              <InfoRow label="Location" value={fieldText(store, ['location', 'address', 'businessAddress', 'city', 'country'])} />
              <InfoRow label="Last updated" value={formatDate(store.updateTime)} />
            </div>
          </SectionCard>

          <SectionCard title="Google Shopping setup">
            <div className="grid gap-3 sm:grid-cols-2">
              <InfoRow label="Connection" value={nestedText(store, ['googleShopping', 'connection', 'connected'])} />
              <InfoRow label="Merchant ID" value={nestedText(store, ['googleShopping', 'connection', 'merchantId'])} />
              <InfoRow label="Auto sync" value={nestedText(store, ['googleShopping', 'catalogSync', 'autoSyncEnabled'])} />
              <InfoRow label="Integration API key" value={nestedText(store, ['googleShopping', 'catalogSync', 'integrationApiKey'])} />
              <InfoRow label="Integration base URL" value={nestedText(store, ['googleShopping', 'catalogSync', 'integrationBaseUrl'])} />
              <InfoRow label="Sync status" value={nestedText(store, ['googleShopping', 'catalogSync', 'status'])} />
            </div>
          </SectionCard>

          <SectionCard title="Safe Google Shopping edit">
            <form action={updateAction} className="space-y-4">
              <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm">
                <input type="checkbox" name="autoSyncEnabled" defaultChecked={nestedValue(store, ['googleShopping', 'catalogSync', 'autoSyncEnabled']) === true} className="mt-1 h-4 w-4 rounded border-slate-300 text-indigo-600" />
                <span>
                  <span className="block font-semibold text-slate-950">Enable catalog auto sync</span>
                  <span className="mt-1 block leading-6 text-slate-600">This only changes googleShopping.catalogSync.autoSyncEnabled for this store.</span>
                </span>
              </label>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-800" htmlFor="integrationBaseUrl">Integration base URL</label>
                <input id="integrationBaseUrl" name="integrationBaseUrl" type="url" defaultValue={integrationBaseUrl} placeholder="https://us-central1-project.cloudfunctions.net" className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-indigo-300 focus:ring-4 focus:ring-indigo-500/10" />
                <p className="mt-2 text-xs leading-5 text-slate-500">Every save also writes an audit record under this store.</p>
              </div>

              <button className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-indigo-500 px-4 py-3 text-sm font-bold text-white transition hover:bg-indigo-400">
                <Save className="h-4 w-4" /> Save safe update
              </button>
            </form>
          </SectionCard>
        </div>

        <div className="space-y-6">
          <SectionCard title="Store operations">
            <div className="space-y-3 text-sm text-slate-600">
              <div className="rounded-2xl bg-slate-50 p-4"><div className="flex items-center gap-2 font-semibold text-slate-950"><PackageSearch className="h-4 w-4 text-indigo-600" /> Products</div><p className="mt-2 leading-6">Next we can connect this card to the products collection for this store.</p></div>
              <div className="rounded-2xl bg-slate-50 p-4"><div className="flex items-center gap-2 font-semibold text-slate-950"><ReceiptText className="h-4 w-4 text-indigo-600" /> Bookings and orders</div><p className="mt-2 leading-6">Next we can show bookings, checkout status, and failed syncs for this store.</p></div>
              <div className="rounded-2xl bg-slate-50 p-4"><div className="flex items-center gap-2 font-semibold text-slate-950"><Webhook className="h-4 w-4 text-indigo-600" /> Integrations</div><p className="mt-2 leading-6">Review webhook clients, API access, and marketplace sync status here.</p></div>
            </div>
          </SectionCard>

          <SectionCard title="Write safety">
            <div className="space-y-3 text-sm leading-6 text-slate-600">
              <div className="rounded-2xl bg-slate-50 p-4"><div className="mb-2 flex items-center gap-2 font-semibold text-slate-950"><Settings className="h-4 w-4 text-indigo-600" /> Controlled fields only</div>The form only updates catalog auto sync, integration base URL, and admin update metadata.</div>
              <div className="rounded-2xl bg-slate-50 p-4"><div className="mb-2 flex items-center gap-2 font-semibold text-slate-950"><History className="h-4 w-4 text-indigo-600" /> Audit trail</div>Each save creates a record at storeSettings/{decodedStoreId}/adminAudit with before and after values.</div>
              <div className="rounded-2xl bg-slate-50 p-4"><div className="mb-2 flex items-center gap-2 font-semibold text-slate-950"><Database className="h-4 w-4 text-indigo-600" /> Firestore path</div>storeSettings/{decodedStoreId}</div>
            </div>
          </SectionCard>
        </div>
      </section>
    </div>
  );
}
