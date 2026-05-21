import Link from 'next/link';
import { revalidatePath } from 'next/cache';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Database,
  Eye,
  History,
  PackageSearch,
  ReceiptText,
  Save,
  Settings,
  Store,
  Webhook,
} from 'lucide-react';
import { SectionCard, StatusBadge } from '../../../../components/admin/ui';
import { getFirebaseEnvStatus, getFirestoreDocument, listFirestoreDocuments, setFirestoreDocument } from '../../../../lib/firebase-admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Params = Promise<{ storeId: string }>;
type StoreRecord = Record<string, unknown> & { id?: string; path?: string; updateTime?: string | null; createTime?: string | null };
type CatalogItem = DashboardRecord & { collectionName?: string };
type DashboardRecord = Record<string, unknown> & { id?: string; path?: string; updateTime?: string | null; createTime?: string | null };

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
  return fieldText(store, ['displayName', 'name', 'storeName', 'businessName', 'merchantName', 'id'], 'Unnamed store');
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

function cleanText(value: FormDataEntryValue | null) {
  return typeof value === 'string' ? value.trim() : '';
}

function parsePrice(value: FormDataEntryValue | null) {
  const raw = cleanText(value).replace(/[^0-9.]/g, '');
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function safeCatalogPath(path: string) {
  return /^(products|services|courses|catalogItems)\/[^/]+$/.test(path);
}

function getItemName(item: CatalogItem) {
  return fieldText(item, ['name', 'title', 'productName', 'serviceName', 'courseName'], 'Untitled item');
}

function getItemType(item: CatalogItem) {
  return fieldText(item, ['itemType', 'type', 'kind'], item.collectionName || 'item').toLowerCase();
}

function getItemPrice(item: CatalogItem) {
  return fieldText(item, ['price', 'amount', 'salePrice', 'regularPrice', 'finalPrice', 'courseFee', 'servicePrice'], '');
}

function getItemCategory(item: CatalogItem) {
  return fieldText(item, ['category', 'categoryName', 'categoryId', 'serviceCategory', 'courseCategory'], '');
}

function getItemImage(item: CatalogItem) {
  return fieldText(item, ['image', 'imageUrl', 'imageURL', 'photo', 'photoUrl', 'thumbnail', 'coverImage', 'mainImage'], '');
}

function getItemStoreId(item: CatalogItem) {
  return fieldText(item, ['storeId', 'merchantId', 'businessId', 'ownerStoreId'], '');
}

function hasImage(item: CatalogItem) {
  if (getItemImage(item)) return true;
  return [item.images, item.gallery, item.photos].some((value) => Array.isArray(value) && value.length > 0);
}

function hasPrice(item: CatalogItem) {
  const price = getItemPrice(item);
  return price !== '' && Number(String(price).replace(/[^0-9.]/g, '')) > 0;
}

function hasCategory(item: CatalogItem) {
  return Boolean(getItemCategory(item));
}

function marketVisible(item: CatalogItem) {
  if (item.marketplaceVisible === true || item.showOnMarket === true || item.isPublished === true || item.active === true) return true;
  const status = fieldText(item, ['status', 'visibility', 'state'], '').toLowerCase();
  return ['active', 'published', 'visible', 'live'].includes(status);
}

function catalogIssues(item: CatalogItem) {
  return [
    !getItemName(item) || getItemName(item) === 'Untitled item' ? 'Missing name' : null,
    !getItemStoreId(item) ? 'Missing store ID' : null,
    !hasImage(item) ? 'Missing image' : null,
    !hasPrice(item) ? 'Missing price' : null,
    !hasCategory(item) ? 'Missing category' : null,
    !marketVisible(item) ? 'Hidden from market' : null,
  ].filter(Boolean) as string[];
}

function belongsToStore(item: CatalogItem, storeId: string) {
  const directStoreId = getItemStoreId(item);
  if (directStoreId === storeId) return true;
  const nestedStore = nestedValue(item, ['store', 'id']) || nestedValue(item, ['merchant', 'id']) || nestedValue(item, ['business', 'id']);
  return nestedStore === storeId;
}

function timestampToMillis(value: unknown): number | null {
  if (!value) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
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
  return timestampToMillis(record.paymentUpdatedAt) ?? timestampToMillis(record.updatedAt) ?? timestampToMillis(record.updateTime) ?? timestampToMillis(record.createdAt) ?? timestampToMillis(record.createTime);
}

async function updateGoogleShoppingSettings(storeId: string, formData: FormData) {
  'use server';

  const current = (await getFirestoreDocument(`storeSettings/${storeId}`)) as StoreRecord;
  const data = stripDocumentMeta(current);
  const googleShopping = asObject(data.googleShopping) || {};
  const catalogSync = asObject(googleShopping.catalogSync) || {};
  const now = new Date().toISOString();
  const rawBaseUrl = cleanText(formData.get('integrationBaseUrl'));
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

async function updateStoreSettings(storeId: string, formData: FormData) {
  'use server';

  const now = new Date().toISOString();
  const displayName = cleanText(formData.get('displayName'));
  const email = cleanText(formData.get('email'));
  const phone = cleanText(formData.get('phone'));
  const whatsapp = cleanText(formData.get('whatsapp'));
  const addressLine1 = cleanText(formData.get('addressLine1'));
  const city = cleanText(formData.get('city'));
  const country = cleanText(formData.get('country'));
  const marketVisibleValue = formData.get('marketVisible') === 'on';
  const checkoutEnabledValue = formData.get('checkoutEnabled') === 'on';

  const profileUpdate: Record<string, unknown> = {
    adminUpdatedAt: now,
    adminUpdatedFrom: 'sedifexadmin',
    marketVisible: marketVisibleValue,
    checkoutEnabled: checkoutEnabledValue,
  };

  if (displayName) {
    profileUpdate.displayName = displayName;
    profileUpdate.businessName = displayName;
    profileUpdate.storeName = displayName;
  }
  if (email) profileUpdate.email = email;
  if (phone) profileUpdate.phone = phone;
  if (whatsapp) profileUpdate.whatsapp = whatsapp;
  if (addressLine1) profileUpdate.addressLine1 = addressLine1;
  if (city) profileUpdate.city = city;
  if (country) profileUpdate.country = country;

  await setFirestoreDocument(`stores/${storeId}`, profileUpdate);
  await setFirestoreDocument(`storeSettings/${storeId}`, {
    displayName: displayName || undefined,
    businessName: displayName || undefined,
    email: email || undefined,
    phone: phone || undefined,
    whatsapp: whatsapp || undefined,
    addressLine1: addressLine1 || undefined,
    city: city || undefined,
    country: country || undefined,
    marketVisible: marketVisibleValue,
    checkoutEnabled: checkoutEnabledValue,
    adminUpdatedAt: now,
    adminUpdatedFrom: 'sedifexadmin',
  });
  await setFirestoreDocument(`storeSettings/${storeId}/adminAudit/${Date.now()}`, {
    action: 'store_settings_updated',
    actor: 'sedifexadmin',
    createdAt: now,
    changedFields: ['displayName', 'email', 'phone', 'whatsapp', 'addressLine1', 'city', 'country', 'marketVisible', 'checkoutEnabled'],
  });

  revalidatePath('/admin');
  revalidatePath('/admin/stores');
  revalidatePath(`/admin/stores/${encodeURIComponent(storeId)}`);
}

async function updateCatalogItem(itemPath: string, storeId: string, formData: FormData) {
  'use server';

  if (!safeCatalogPath(itemPath)) {
    throw new Error('Unsafe catalog path. Only products, services, courses, and catalogItems can be edited here.');
  }

  const now = new Date().toISOString();
  const name = cleanText(formData.get('name'));
  const category = cleanText(formData.get('category'));
  const imageUrl = cleanText(formData.get('imageUrl'));
  const itemType = cleanText(formData.get('itemType')) || 'product';
  const ownerStoreId = cleanText(formData.get('storeId')) || storeId;
  const price = parsePrice(formData.get('price'));
  const marketVisibleValue = formData.get('marketplaceVisible') === 'on';

  const update: Record<string, unknown> = {
    storeId: ownerStoreId,
    itemType,
    type: itemType,
    category,
    marketplaceVisible: marketVisibleValue,
    showOnMarket: marketVisibleValue,
    active: marketVisibleValue,
    status: marketVisibleValue ? 'active' : 'draft',
    adminUpdatedAt: now,
    adminUpdatedFrom: 'sedifexadmin',
  };

  if (name) {
    update.name = name;
    update.title = name;
  }
  if (imageUrl) {
    update.imageUrl = imageUrl;
    update.image = imageUrl;
  }
  if (price !== null) {
    update.price = price;
  }

  await setFirestoreDocument(itemPath, update);
  await setFirestoreDocument(`storeSettings/${storeId}/adminAudit/${Date.now()}`, {
    action: 'catalog_item_fixed',
    actor: 'sedifexadmin',
    createdAt: now,
    itemPath,
    changedFields: Object.keys(update),
  });

  revalidatePath('/admin');
  revalidatePath('/admin/products');
  revalidatePath(`/admin/stores/${encodeURIComponent(storeId)}`);
}

async function readCollection(collectionPath: string, collectionName: string) {
  try {
    const result = await listFirestoreDocuments(collectionPath, 100);
    return result.documents.map((document) => ({ ...(document as CatalogItem), collectionName }));
  } catch {
    return [] as CatalogItem[];
  }
}

async function loadStore(storeId: string) {
  const env = getFirebaseEnvStatus();
  if (!env.ready) {
    return {
      ok: false,
      error: 'Firebase envs are not ready in Vercel.',
      store: null as StoreRecord | null,
      catalogItems: [] as CatalogItem[],
      orders: [] as DashboardRecord[],
    };
  }

  try {
    const [storeProfileRaw, storeSettingsRaw, products, services, courses, catalogItems, ordersResult] = await Promise.all([
      getFirestoreDocument(`stores/${storeId}`).catch(() => null),
      getFirestoreDocument(`storeSettings/${storeId}`).catch(() => null),
      readCollection('products', 'product'),
      readCollection('services', 'service'),
      readCollection('courses', 'course'),
      readCollection('catalogItems', 'catalog'),
      listFirestoreDocuments('integrationOrders', 100).catch(() => ({ documents: [] })),
    ]);
    const storeProfile = storeProfileRaw as StoreRecord | null;
    const storeSettings = storeSettingsRaw as StoreRecord | null;
    if (!storeProfile && !storeSettings) {
      return { ok: false, error: 'Store not available.', store: null as StoreRecord | null, catalogItems: [] as CatalogItem[], orders: [] as DashboardRecord[] };
    }
    const combinedCatalog = [...products, ...services, ...courses, ...catalogItems].filter((item) => belongsToStore(item, storeId));
    const orders = ((ordersResult.documents || []) as DashboardRecord[]).filter((order) => fieldText(order, ['storeId', 'merchantId', 'businessId'], '') === storeId);
    return { ok: true, error: null, store: { profile: storeProfile, settings: storeSettings } as unknown as StoreRecord, catalogItems: combinedCatalog, orders };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Unable to load this store.',
      store: null as StoreRecord | null,
      catalogItems: [] as CatalogItem[],
      orders: [] as DashboardRecord[],
    };
  }
}

function buildLocation(store: StoreRecord) {
  const parts = ['addressLine1', 'addressLine2', 'city', 'region', 'country', 'postalCode']
    .map((key) => store[key])
    .filter((value): value is string | number => (typeof value === 'string' && value.trim().length > 0) || typeof value === 'number')
    .map((value) => String(value).trim());
  if (parts.length > 0) return parts.join(', ');
  return fieldText(store, ['location', 'address', 'businessAddress'], 'Not set');
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 break-words text-sm font-semibold text-slate-950">{value}</p>
    </div>
  );
}

function TextInput({ label, name, defaultValue, placeholder, type = 'text' }: { label: string; name: string; defaultValue?: string; placeholder?: string; type?: string }) {
  return (
    <div>
      <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor={name}>{label}</label>
      <input id={name} name={name} type={type} defaultValue={defaultValue} placeholder={placeholder} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-indigo-300 focus:ring-4 focus:ring-indigo-500/10" />
    </div>
  );
}

export default async function StoreDetailPage({ params }: { params: Params }) {
  const { storeId } = await params;
  const decodedStoreId = decodeURIComponent(storeId);
  const result = await loadStore(decodedStoreId);
  const docs = result.store ? (result.store as unknown as { profile: StoreRecord | null; settings: StoreRecord | null }) : null;
  const profile = docs?.profile || null;
  const settings = docs?.settings || null;
  const identityStore = profile || settings;

  if (!identityStore) {
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

  const shopping = boolStatus(nestedValue(settings || {}, ['googleShopping', 'connection', 'connected']));
  const autoSync = boolStatus(nestedValue(settings || {}, ['googleShopping', 'catalogSync', 'autoSyncEnabled']));
  const integrationBaseUrl = nestedText(settings || {}, ['googleShopping', 'catalogSync', 'integrationBaseUrl'], '');
  const googleUpdateAction = updateGoogleShoppingSettings.bind(null, decodedStoreId);
  const settingsUpdateAction = updateStoreSettings.bind(null, decodedStoreId);
  const catalogIssuesCount = result.catalogItems.reduce((sum, item) => sum + catalogIssues(item).length, 0);
  const recentOrders = [...result.orders].sort((a, b) => (recordTime(b) || 0) - (recordTime(a) || 0)).slice(0, 5);

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
            <h2 className="mt-5 text-3xl font-bold tracking-tight sm:text-4xl">{storeName((profile || settings || { id: decodedStoreId }) as StoreRecord)}</h2>
            <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-300">Store ID: {identityStore.id || decodedStoreId}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <StatusBadge tone={shopping.tone}>Shopping {shopping.label}</StatusBadge>
            <StatusBadge tone={autoSync.tone}>Auto sync {autoSync.label}</StatusBadge>
            <StatusBadge tone={catalogIssuesCount > 0 ? 'yellow' : 'green'}>{catalogIssuesCount} catalog issues</StatusBadge>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-4">
        <InfoRow label="Products/services/courses" value={String(result.catalogItems.length)} />
        <InfoRow label="Catalog issues" value={String(catalogIssuesCount)} />
        <InfoRow label="Orders found" value={String(result.orders.length)} />
        <InfoRow label="Last updated" value={formatDate((profile || settings || {})?.updateTime)} />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-6">
          <SectionCard title="Store basics">
            <div className="grid gap-3 sm:grid-cols-2">
              <InfoRow label="Contact" value={fieldText((profile || settings || {}) as StoreRecord, ['email', 'ownerEmail', 'contact', 'adminEmail', 'supportEmail'])} />
              <InfoRow label="Phone" value={fieldText((profile || settings || {}) as StoreRecord, ['phone', 'contactPhone', 'businessPhone', 'whatsappNumber', 'whatsapp'])} />
              <InfoRow label="Location" value={buildLocation((profile || settings || {}) as StoreRecord)} />
              <InfoRow label="Firestore path" value={`stores/${decodedStoreId} + storeSettings/${decodedStoreId}`} />
            </div>
          </SectionCard>

          <SectionCard title="Edit store settings from admin">
            <form action={settingsUpdateAction} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <TextInput label="Business name" name="displayName" defaultValue={storeName((profile || settings || {}) as StoreRecord)} placeholder="Store name" />
                <TextInput label="Email" name="email" type="email" defaultValue={fieldText((profile || settings || {}) as StoreRecord, ['email', 'ownerEmail', 'adminEmail', 'supportEmail'], '')} placeholder="store@email.com" />
                <TextInput label="Phone" name="phone" defaultValue={fieldText((profile || settings || {}) as StoreRecord, ['phone', 'contactPhone', 'businessPhone'], '')} placeholder="020 000 0000" />
                <TextInput label="WhatsApp" name="whatsapp" defaultValue={fieldText((profile || settings || {}) as StoreRecord, ['whatsapp', 'whatsappNumber'], '')} placeholder="020 000 0000" />
                <TextInput label="Address" name="addressLine1" defaultValue={fieldText((profile || settings || {}) as StoreRecord, ['addressLine1', 'address', 'businessAddress'], '')} placeholder="Street / area" />
                <TextInput label="City" name="city" defaultValue={fieldText((profile || settings || {}) as StoreRecord, ['city'], '')} placeholder="Accra" />
                <TextInput label="Country" name="country" defaultValue={fieldText((profile || settings || {}) as StoreRecord, ['country'], '')} placeholder="Ghana" />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm">
                  <input type="checkbox" name="marketVisible" defaultChecked={(profile?.marketVisible ?? settings?.marketVisible) === true} className="mt-1 h-4 w-4 rounded border-slate-300 text-indigo-600" />
                  <span><span className="block font-semibold text-slate-950">Show store on market</span><span className="mt-1 block leading-6 text-slate-600">Controls admin marketVisible flag for this store.</span></span>
                </label>
                <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm">
                  <input type="checkbox" name="checkoutEnabled" defaultChecked={(profile?.checkoutEnabled ?? settings?.checkoutEnabled) === true} className="mt-1 h-4 w-4 rounded border-slate-300 text-indigo-600" />
                  <span><span className="block font-semibold text-slate-950">Checkout enabled</span><span className="mt-1 block leading-6 text-slate-600">Marks this store as ready for checkout review.</span></span>
                </label>
              </div>

              <button className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-indigo-500 px-4 py-3 text-sm font-bold text-white transition hover:bg-indigo-400">
                <Save className="h-4 w-4" /> Save store settings
              </button>
            </form>
          </SectionCard>

          <SectionCard title="Google Shopping setup">
            <div className="grid gap-3 sm:grid-cols-2">
              <InfoRow label="Connection" value={nestedText((settings || {}) as StoreRecord, ['googleShopping', 'connection', 'connected'])} />
              <InfoRow label="Merchant ID" value={nestedText((settings || {}) as StoreRecord, ['googleShopping', 'connection', 'merchantId'])} />
              <InfoRow label="Auto sync" value={nestedText((settings || {}) as StoreRecord, ['googleShopping', 'catalogSync', 'autoSyncEnabled'])} />
              <InfoRow label="Integration API key" value={nestedText((settings || {}) as StoreRecord, ['googleShopping', 'catalogSync', 'integrationApiKey'])} />
              <InfoRow label="Integration base URL" value={nestedText((settings || {}) as StoreRecord, ['googleShopping', 'catalogSync', 'integrationBaseUrl'])} />
              <InfoRow label="Sync status" value={nestedText((settings || {}) as StoreRecord, ['googleShopping', 'catalogSync', 'status'])} />
            </div>
          </SectionCard>

          <SectionCard title="Safe Google Shopping edit">
            <form action={googleUpdateAction} className="space-y-4">
              <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm">
                <input type="checkbox" name="autoSyncEnabled" defaultChecked={nestedValue((settings || {}) as StoreRecord, ['googleShopping', 'catalogSync', 'autoSyncEnabled']) === true} className="mt-1 h-4 w-4 rounded border-slate-300 text-indigo-600" />
                <span>
                  <span className="block font-semibold text-slate-950">Enable catalog auto sync</span>
                  <span className="mt-1 block leading-6 text-slate-600">This only changes googleShopping.catalogSync.autoSyncEnabled for this store.</span>
                </span>
              </label>

              <TextInput label="Integration base URL" name="integrationBaseUrl" type="url" defaultValue={integrationBaseUrl} placeholder="https://us-central1-project.cloudfunctions.net" />

              <button className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-indigo-500 px-4 py-3 text-sm font-bold text-white transition hover:bg-indigo-400">
                <Save className="h-4 w-4" /> Save Google Shopping update
              </button>
            </form>
          </SectionCard>

          <SectionCard title="Fix product, service, and course errors">
            {result.catalogItems.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm leading-6 text-slate-600">
                No catalog records were found for this store in products, services, courses, or catalogItems.
              </div>
            ) : (
              <div className="space-y-4">
                {result.catalogItems.map((item) => {
                  const issues = catalogIssues(item);
                  const itemPath = String(item.path || '');
                  const itemUpdateAction = updateCatalogItem.bind(null, itemPath, decodedStoreId);
                  return (
                    <form key={itemPath || item.id} action={itemUpdateAction} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h3 className="text-sm font-semibold text-slate-950">{getItemName(item)}</h3>
                          <p className="mt-1 text-xs text-slate-500">{itemPath || item.id}</p>
                        </div>
                        <StatusBadge tone={issues.length > 0 ? 'yellow' : 'green'}>{issues.length > 0 ? `${issues.length} issues` : 'Ready'}</StatusBadge>
                      </div>

                      {issues.length > 0 ? (
                        <div className="mb-4 flex flex-wrap gap-2">
                          {issues.map((issue) => <StatusBadge key={issue} tone="yellow">{issue}</StatusBadge>)}
                        </div>
                      ) : null}

                      <div className="grid gap-3 md:grid-cols-3">
                        <TextInput label="Name" name="name" defaultValue={getItemName(item) === 'Untitled item' ? '' : getItemName(item)} placeholder="Item name" />
                        <TextInput label="Store ID" name="storeId" defaultValue={getItemStoreId(item) || decodedStoreId} placeholder={decodedStoreId} />
                        <TextInput label="Type" name="itemType" defaultValue={getItemType(item)} placeholder="product, service, course" />
                        <TextInput label="Category" name="category" defaultValue={getItemCategory(item)} placeholder="Category" />
                        <TextInput label="Price" name="price" defaultValue={getItemPrice(item)} placeholder="0.00" />
                        <TextInput label="Image URL" name="imageUrl" type="url" defaultValue={getItemImage(item)} placeholder="https://..." />
                      </div>

                      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <label className="flex items-center gap-2 text-sm text-slate-700">
                          <input type="checkbox" name="marketplaceVisible" defaultChecked={marketVisible(item)} className="h-4 w-4 rounded border-slate-300 text-indigo-600" />
                          Show on Sedifex Market
                        </label>
                        <button className="inline-flex items-center justify-center gap-2 rounded-2xl bg-indigo-500 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-indigo-400">
                          <Save className="h-4 w-4" /> Save fix
                        </button>
                      </div>
                    </form>
                  );
                })}
              </div>
            )}
          </SectionCard>
        </div>

        <div className="space-y-6">
          <SectionCard title="Store operations">
            <div className="space-y-3 text-sm text-slate-600">
              <div className="rounded-2xl bg-slate-50 p-4"><div className="flex items-center gap-2 font-semibold text-slate-950"><PackageSearch className="h-4 w-4 text-indigo-600" /> Products, services, and courses</div><p className="mt-2 leading-6">This page now loads this store&apos;s catalog records and lets you fix missing fields safely.</p></div>
              <div className="rounded-2xl bg-slate-50 p-4"><div className="flex items-center gap-2 font-semibold text-slate-950"><ReceiptText className="h-4 w-4 text-indigo-600" /> Bookings and orders</div><p className="mt-2 leading-6">Latest orders are shown below when integrationOrders has this store ID.</p></div>
              <div className="rounded-2xl bg-slate-50 p-4"><div className="flex items-center gap-2 font-semibold text-slate-950"><Webhook className="h-4 w-4 text-indigo-600" /> Integrations</div><p className="mt-2 leading-6">Use Google Shopping and webhook settings to keep marketplace data synced.</p></div>
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
                      <p className="font-semibold text-slate-950">{fieldText(order, ['customerName', 'customerEmail', 'sourceLabel', 'id'], 'Order')}</p>
                      <StatusBadge tone={fieldText(order, ['paymentStatus', 'orderStatus', 'status'], '').toLowerCase().includes('paid') ? 'green' : 'slate'}>{fieldText(order, ['paymentStatus', 'orderStatus', 'status'], 'Unknown')}</StatusBadge>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">{formatDate(String(order.paymentUpdatedAt || order.updatedAt || order.updateTime || order.createdAt || ''))}</p>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard title="Write safety">
            <div className="space-y-3 text-sm leading-6 text-slate-600">
              <div className="rounded-2xl bg-slate-50 p-4"><div className="mb-2 flex items-center gap-2 font-semibold text-slate-950"><Settings className="h-4 w-4 text-indigo-600" /> Controlled fields only</div>Store settings and catalog fixes update selected public/admin fields only.</div>
              <div className="rounded-2xl bg-slate-50 p-4"><div className="mb-2 flex items-center gap-2 font-semibold text-slate-950"><History className="h-4 w-4 text-indigo-600" /> Audit trail</div>Each save creates an adminAudit record under storeSettings/{decodedStoreId}.</div>
              <div className="rounded-2xl bg-slate-50 p-4"><div className="mb-2 flex items-center gap-2 font-semibold text-slate-950"><Eye className="h-4 w-4 text-indigo-600" /> Market readiness</div>Fixing image, price, category, store ID, and visibility helps Sedifex Market pull items correctly.</div>
              <div className="rounded-2xl bg-slate-50 p-4"><div className="mb-2 flex items-center gap-2 font-semibold text-slate-950"><CheckCircle2 className="h-4 w-4 text-indigo-600" /> Safe paths</div>Catalog edits are restricted to products, services, courses, and catalogItems.</div>
            </div>
          </SectionCard>

          {result.error ? (
            <SectionCard title="Notice">
              <div className="flex gap-3 rounded-2xl bg-amber-50 p-4 text-sm text-amber-800">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
                <p>{result.error}</p>
              </div>
            </SectionCard>
          ) : null}

          <SectionCard title="Raw data">
            <Link href="/api/admin/firestore/store-settings" className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
              <Database className="h-4 w-4" /> Open store settings API
            </Link>
          </SectionCard>
        </div>
      </section>
    </div>
  );
}
