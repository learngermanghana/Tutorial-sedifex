import { revalidatePath } from 'next/cache';
import Link from 'next/link';
import {
  Ban,
  CheckCircle2,
  ExternalLink,
  Filter,
  PackageCheck,
  Search,
  ShieldAlert,
  Store,
} from 'lucide-react';
import { SectionCard, StatCard, StatusBadge } from '../../../components/admin/ui';
import { adminFirestore, getFirebaseEnvStatus } from '../../../lib/firebase-admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type SearchParams = Record<string, string | string[] | undefined>;

type GoogleSyncProduct = Record<string, unknown> & {
  id: string;
  path: string;
  collectionPath: 'products' | 'publicListings' | 'publicProducts' | 'publicServices';
  sourceLabel: string;
};

type StoreRecord = Record<string, unknown> & { id: string; path: string };

type GoogleSyncData = {
  connected: boolean;
  error: string | null;
  stores: StoreRecord[];
  products: GoogleSyncProduct[];
  collectionErrors: Record<string, string>;
};

const PRODUCT_COLLECTIONS = [
  { path: 'products', label: 'Sedifex products' },
  { path: 'publicListings', label: 'Market public listings' },
  { path: 'publicProducts', label: 'Legacy public products' },
  { path: 'publicServices', label: 'Legacy public services' },
] as const;

const BLOCKED_CATEGORY_KEYWORDS = [
  'supplement',
  'supplements',
  'medicine',
  'medicines',
  'medication',
  'pharmacy',
  'pharmaceutical',
  'prescription',
  'otc',
  'over the counter',
  'vitamin',
  'vitamins',
  'health supplement',
  'wellness supplement',
];

const BLOCKED_TEXT_KEYWORDS = [
  'supplement',
  'dietary supplement',
  'herbal supplement',
  'medicine',
  'medication',
  'pharmacy',
  'pharmaceutical',
  'prescription',
  'over the counter',
  'otc',
  'vitamin',
  'multivitamin',
  'immune booster',
  'detox',
  'slimming',
  'slim',
  'weight loss',
  'fat burner',
  'flat tummy',
  'appetite suppressant',
  'sexual enhancement',
  'erectile dysfunction',
  'aphrodisiac',
  'libido',
  'fertility booster',
  'hormone',
  'steroid',
  'testosterone',
  'estrogen',
  'antibiotic',
  'antimalarial',
  'pain killer',
  'painkiller',
  'pain relief',
  'cough syrup',
  'tablet',
  'tablets',
  'capsule',
  'capsules',
  'pill',
  'pills',
  'injection',
  'injectable',
  'iv drip',
  'glutathione',
  'skin whitening',
  'whitening skin',
  'dark knuckle',
  'dark knuckla',
  'knuckle',
  'breast enlargement',
  'breast enhancer',
  'hip booster',
  'hip serum',
  'body curve',
  'collagen drink',
  'pimples',
  'anti pimples',
  'acne treatment',
  'stretch mark removal',
  'stretch marks removal',
  'removal oil',
  'diabetes',
  'hypertension',
  'blood pressure',
  'malaria',
  'typhoid',
  'infection',
  'asthma',
  'arthritis',
];

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function text(value: unknown, fallback = '') {
  if (typeof value === 'string') return value.trim() || fallback;
  if (typeof value === 'number') return String(value);
  return fallback;
}

function compact(value: unknown) {
  return text(value)
    .replace(/\*\*/g, '')
    .replace(/^(product\s*name|service\s*name|course\s*name|item\s*name|name|title)\s*:\s*/i, '')
    .replace(/^[-–—:\s]+/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizedPolicyText(value: unknown) {
  return compact(value)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function includesKeyword(value: string, keywords: string[]) {
  const padded = ` ${value} `;
  return keywords.some((keyword) => padded.includes(` ${normalizedPolicyText(keyword)} `));
}

function boolValue(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'approved', 'allowed', 'include', 'visible', 'published'].includes(normalized)) return true;
    if (['false', '0', 'no', 'blocked', 'excluded', 'exclude', 'hidden', 'draft'].includes(normalized)) return false;
  }
  return null;
}

function firstText(record: Record<string, unknown>, fields: string[], fallback = '') {
  for (const field of fields) {
    const value = compact(record[field]);
    if (value) return value;
  }
  return fallback;
}

function getName(product: GoogleSyncProduct) {
  return firstText(product, ['name', 'title', 'productName', 'serviceName', 'courseName'], 'Untitled product');
}

function getStoreId(product: GoogleSyncProduct) {
  const direct = firstText(product, ['storeId', 'ownerStoreId', 'businessId', 'tenantStoreId'], '');
  if (direct) return direct;
  const store = asRecord(product.store);
  return store ? firstText(store, ['id', 'storeId'], '') : '';
}

function getProductId(product: GoogleSyncProduct) {
  return firstText(product, ['productId', 'catalogItemId', 'itemId'], product.id);
}

function getCategory(product: GoogleSyncProduct) {
  return firstText(product, ['category', 'categoryName', 'categoryKey', 'categoryId'], '');
}

function getDescription(product: GoogleSyncProduct) {
  return firstText(product, ['description', 'summary', 'shortDescription'], '');
}

function getPrice(product: GoogleSyncProduct) {
  const value = product.price ?? product.amount ?? product.salePrice ?? product.regularPrice;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const parsed = Number(String(value ?? '').replace(/[^0-9.]/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
}

function isManualAllowed(product: GoogleSyncProduct) {
  const status = text(product.googleMerchantReviewStatus || product.googleMerchantManualDecision).toLowerCase();
  return boolValue(product.googleMerchantEligible) === true || status === 'approved' || status === 'include' || status === 'allowed';
}

function isManualBlocked(product: GoogleSyncProduct) {
  const status = text(product.googleMerchantReviewStatus || product.googleMerchantManualDecision).toLowerCase();
  return [
    product.excludeFromGoogleMerchant,
    product.googleMerchantExcluded,
    product.googleShoppingExcluded,
    product.merchantCenterExcluded,
    product.restrictedProduct,
    product.regulatedProduct,
    product.healthProduct,
    product.medicalProduct,
    product.pharmaceuticalProduct,
    product.pharmacyProduct,
    product.supplementProduct,
    product.requiresPrescription,
    product.ageRestricted,
  ].some((value) => boolValue(value) === true) || boolValue(product.googleMerchantEligible) === false || status === 'blocked' || status === 'exclude' || status === 'excluded';
}

function riskReasons(product: GoogleSyncProduct) {
  const reasons: string[] = [];
  const categoryText = normalizedPolicyText(getCategory(product));
  const itemText = normalizedPolicyText([
    getName(product),
    getDescription(product),
    getCategory(product),
    product.manufacturerName,
    product.tags,
  ].filter(Boolean).join(' '));

  if (includesKeyword(categoryText, BLOCKED_CATEGORY_KEYWORDS)) reasons.push('Restricted category');
  if (includesKeyword(itemText, BLOCKED_TEXT_KEYWORDS)) reasons.push('Medicine/supplement/health claim');
  if (!getStoreId(product)) reasons.push('Missing store ID');
  if (!getPrice(product) || Number(getPrice(product)) <= 0) reasons.push('Missing price');

  return Array.from(new Set(reasons));
}

function merchantStatus(product: GoogleSyncProduct) {
  if (isManualBlocked(product)) return 'blocked';
  if (isManualAllowed(product)) return 'approved';
  if (riskReasons(product).length > 0) return 'risky';
  return 'review';
}

function storeName(store: StoreRecord) {
  return firstText(store, ['storeName', 'name', 'businessName', 'displayName', 'merchantName', 'title'], store.id);
}

function buildStoreMap(stores: StoreRecord[]) {
  return new Map(stores.map((store) => [store.id, storeName(store)]));
}

function safeProductPath(path: string) {
  return /^(products|publicListings|publicProducts|publicServices)\/[^/]+$/.test(path);
}

function selectedParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? '' : value ?? '';
}

function itemMatchesSearch(product: GoogleSyncProduct, query: string) {
  if (!query) return true;
  const haystack = normalizedPolicyText([
    getName(product),
    getStoreId(product),
    getProductId(product),
    getCategory(product),
    getDescription(product),
    product.sourceLabel,
  ].filter(Boolean).join(' '));
  return haystack.includes(normalizedPolicyText(query));
}

function itemMatchesStatus(product: GoogleSyncProduct, status: string) {
  if (!status || status === 'all') return true;
  if (status === 'approved') return merchantStatus(product) === 'approved';
  if (status === 'blocked') return merchantStatus(product) === 'blocked';
  if (status === 'risky') return merchantStatus(product) === 'risky';
  if (status === 'review') return merchantStatus(product) === 'review';
  return true;
}

function itemMatchesStore(product: GoogleSyncProduct, storeId: string) {
  return !storeId || storeId === 'all' || getStoreId(product) === storeId;
}

async function readProductCollection(path: GoogleSyncProduct['collectionPath'], sourceLabel: string): Promise<{ documents: GoogleSyncProduct[]; error: string | null }> {
  try {
    const snapshot = await adminFirestore().collection(path).limit(300).get();
    return {
      error: null,
      documents: snapshot.docs.map((docSnap) => ({
        ...(docSnap.data() as Record<string, unknown>),
        id: docSnap.id,
        path: docSnap.ref.path,
        collectionPath: path,
        sourceLabel,
      })),
    };
  } catch (error) {
    return { documents: [], error: error instanceof Error ? error.message : `Unable to read ${path}.` };
  }
}

async function loadGoogleSyncData(): Promise<GoogleSyncData> {
  const env = getFirebaseEnvStatus();
  if (!env.ready) {
    return {
      connected: false,
      error: 'Firebase environment variables are not ready in this deployment.',
      stores: [],
      products: [],
      collectionErrors: {},
    };
  }

  try {
    const [storesSnapshot, ...collectionReads] = await Promise.all([
      adminFirestore().collection('stores').limit(300).get(),
      ...PRODUCT_COLLECTIONS.map((entry) => readProductCollection(entry.path, entry.label)),
    ]);

    const stores = storesSnapshot.docs.map((docSnap) => ({
      ...(docSnap.data() as Record<string, unknown>),
      id: docSnap.id,
      path: docSnap.ref.path,
    }));

    const collectionErrors: Record<string, string> = {};
    collectionReads.forEach((read, index) => {
      if (read.error) collectionErrors[PRODUCT_COLLECTIONS[index].path] = read.error;
    });

    return {
      connected: true,
      error: null,
      stores,
      products: collectionReads.flatMap((read) => read.documents),
      collectionErrors,
    };
  } catch (error) {
    return {
      connected: false,
      error: error instanceof Error ? error.message : 'Unable to load Google sync data from /stores.',
      stores: [],
      products: [],
      collectionErrors: {},
    };
  }
}

async function updateRelatedProductDocuments(params: {
  productPath: string;
  storeId: string;
  productId: string;
  update: Record<string, unknown>;
}) {
  const db = adminFirestore();
  const candidatePaths = Array.from(new Set([
    params.productPath,
    params.productId ? `products/${params.productId}` : '',
    params.productId ? `publicListings/${params.productId}` : '',
    params.productId ? `publicProducts/${params.productId}` : '',
    params.productId ? `publicServices/${params.productId}` : '',
    params.storeId && params.productId ? `publicListings/${params.storeId}_${params.productId}` : '',
    params.storeId && params.productId ? `publicProducts/${params.storeId}_${params.productId}` : '',
    params.storeId && params.productId ? `publicServices/${params.storeId}_${params.productId}` : '',
  ].filter(Boolean)));

  await Promise.all(candidatePaths.map(async (path) => {
    if (!safeProductPath(path)) return;
    const ref = db.doc(path);
    const snapshot = await ref.get();
    if (snapshot.exists || path === params.productPath) {
      await ref.set(params.update, { merge: true });
    }
  }));
}

async function bulkUpdateGoogleMerchantProducts(formData: FormData) {
  'use server';

  const action = text(formData.get('action'));
  const selectedPaths = formData.getAll('productPath').map((value) => text(value)).filter(Boolean);
  const now = new Date().toISOString();

  if (!['allow', 'block', 'review', 'block-risky'].includes(action)) {
    throw new Error('Unknown Google Merchant action.');
  }

  const pathsToUpdate = action === 'block-risky'
    ? formData.getAll('riskyProductPath').map((value) => text(value)).filter(Boolean)
    : selectedPaths;

  if (pathsToUpdate.length === 0) {
    revalidatePath('/admin/google-sync');
    return;
  }

  const updateByAction: Record<string, Record<string, unknown>> = {
    allow: {
      googleMerchantEligible: true,
      excludeFromGoogleMerchant: false,
      googleMerchantExcluded: false,
      googleShoppingExcluded: false,
      merchantCenterExcluded: false,
      googleMerchantReviewStatus: 'approved',
      googleMerchantManualDecision: 'include',
      googleMerchantReviewedAt: now,
      googleMerchantReviewedBy: 'sedifexadmin',
    },
    block: {
      googleMerchantEligible: false,
      excludeFromGoogleMerchant: true,
      googleMerchantExcluded: true,
      googleShoppingExcluded: true,
      merchantCenterExcluded: true,
      googleMerchantReviewStatus: 'blocked',
      googleMerchantManualDecision: 'exclude',
      googleMerchantReviewedAt: now,
      googleMerchantReviewedBy: 'sedifexadmin',
    },
    review: {
      googleMerchantEligible: false,
      excludeFromGoogleMerchant: true,
      googleMerchantExcluded: true,
      googleShoppingExcluded: true,
      merchantCenterExcluded: true,
      googleMerchantReviewStatus: 'manual_review',
      googleMerchantManualDecision: 'review',
      googleMerchantReviewedAt: now,
      googleMerchantReviewedBy: 'sedifexadmin',
    },
    'block-risky': {
      googleMerchantEligible: false,
      excludeFromGoogleMerchant: true,
      googleMerchantExcluded: true,
      googleShoppingExcluded: true,
      merchantCenterExcluded: true,
      googleMerchantReviewStatus: 'blocked',
      googleMerchantManualDecision: 'exclude',
      googleMerchantBlockedReason: 'auto_detected_policy_risk',
      googleMerchantReviewedAt: now,
      googleMerchantReviewedBy: 'sedifexadmin',
    },
  };

  const db = adminFirestore();
  const update = {
    ...updateByAction[action],
    googleMerchantAdminUpdatedAt: now,
    adminUpdatedAt: now,
    adminUpdatedFrom: 'sedifexadmin-google-sync',
  };

  await Promise.all(pathsToUpdate.map(async (path) => {
    if (!safeProductPath(path)) return;
    const snapshot = await db.doc(path).get();
    const product = { ...(snapshot.data() || {}), id: snapshot.id, path } as GoogleSyncProduct;
    await updateRelatedProductDocuments({
      productPath: path,
      productId: getProductId(product),
      storeId: getStoreId(product),
      update,
    });
  }));

  await db.collection('adminAuditLogs').add({
    action: `google_merchant_${action}`,
    actor: 'sedifexadmin',
    affectedCount: pathsToUpdate.length,
    productPaths: pathsToUpdate.slice(0, 100),
    createdAt: now,
  });

  revalidatePath('/admin/google-sync');
  revalidatePath('/admin/products');
}

function statusBadge(product: GoogleSyncProduct) {
  const status = merchantStatus(product);
  if (status === 'approved') return <StatusBadge tone="green">Allowed</StatusBadge>;
  if (status === 'blocked') return <StatusBadge tone="red">Blocked</StatusBadge>;
  if (status === 'risky') return <StatusBadge tone="yellow">Risk detected</StatusBadge>;
  return <StatusBadge tone="blue">Needs review</StatusBadge>;
}

export default async function GoogleSyncPage({ searchParams }: { searchParams?: Promise<SearchParams> }) {
  const params = (await searchParams) || {};
  const query = selectedParam(params.q);
  const selectedStore = selectedParam(params.store) || 'all';
  const selectedStatus = selectedParam(params.status) || 'all';
  const data = await loadGoogleSyncData();
  const storeMap = buildStoreMap(data.stores);

  const filteredProducts = data.products
    .filter((product) => itemMatchesSearch(product, query))
    .filter((product) => itemMatchesStore(product, selectedStore))
    .filter((product) => itemMatchesStatus(product, selectedStatus))
    .sort((a, b) => {
      const score = (merchantStatus(a) === 'risky' ? 0 : merchantStatus(a) === 'review' ? 1 : merchantStatus(a) === 'blocked' ? 2 : 3) -
        (merchantStatus(b) === 'risky' ? 0 : merchantStatus(b) === 'review' ? 1 : merchantStatus(b) === 'blocked' ? 2 : 3);
      if (score !== 0) return score;
      return getName(a).localeCompare(getName(b));
    });

  const visibleProducts = filteredProducts.slice(0, 120);
  const riskyProducts = data.products.filter((product) => riskReasons(product).length > 0 && !isManualBlocked(product));
  const blockedProducts = data.products.filter(isManualBlocked);
  const allowedProducts = data.products.filter(isManualAllowed);
  const storeLinkedProducts = data.products.filter((product) => getStoreId(product)).length;

  const stats = [
    { label: 'Loaded records', value: data.connected ? String(data.products.length) : 'Setup', delta: data.connected ? 'Across products and public listings' : 'Check Firebase envs' },
    { label: 'Stores from /stores', value: data.connected ? String(data.stores.length) : '—', delta: 'Store filter and names now use stores collection' },
    { label: 'Allowed for Google', value: data.connected ? String(allowedProducts.length) : '—', delta: 'Manually approved items' },
    { label: 'Risk detected', value: data.connected ? String(riskyProducts.length) : '—', delta: 'Medicine, supplement, whitening, health claims' },
  ];

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-slate-950 p-6 text-white shadow-sm sm:p-8">
        <div className="grid gap-8 lg:grid-cols-[1.25fr_0.75fr] lg:items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-100">
              <PackageCheck className="h-4 w-4" /> Google Merchant Control
            </div>
            <h2 className="mt-5 max-w-4xl text-3xl font-bold tracking-tight sm:text-4xl">
              Choose exactly which products Sedifex can send to Google.
            </h2>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300">
              Store names and filters now come from <strong>/stores</strong>. Product-level allow/block decisions are still written back to product and public listing records for the Google feed.
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            <p className="text-sm font-semibold text-slate-200">Feed links</p>
            <div className="mt-4 space-y-3 text-sm text-slate-300">
              <a className="flex items-center justify-between gap-3 rounded-xl bg-white/5 p-3 text-white transition hover:bg-white/10" href="https://www.sedifexmarket.com/api/google-merchant-feed.xml" target="_blank" rel="noreferrer">
                XML Merchant feed <ExternalLink className="h-4 w-4" />
              </a>
              <p className="text-xs leading-5 text-slate-400">Use the Store Settings page for /storeSettings connection data. This page is for store catalog and Google product selection.</p>
            </div>
          </div>
        </div>
      </section>

      {data.error ? (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <div className="flex gap-3"><ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" /><div><p className="font-semibold">Google sync data is not fully available.</p><p className="mt-1 leading-6">{data.error}</p></div></div>
        </section>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => <StatCard key={stat.label} {...stat} />)}
      </section>

      <SectionCard title="Filter products for review">
        <form className="grid gap-3 md:grid-cols-[1fr_220px_190px_auto] md:items-end">
          <label className="block">
            <span className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500"><Search className="h-4 w-4" /> Search</span>
            <input name="q" defaultValue={query} placeholder="Search name, store, category, supplement, whitening..." className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-indigo-300 focus:ring-4 focus:ring-indigo-500/10" />
          </label>
          <label className="block">
            <span className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500"><Store className="h-4 w-4" /> Store from /stores</span>
            <select name="store" defaultValue={selectedStore} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-indigo-300 focus:ring-4 focus:ring-indigo-500/10">
              <option value="all">All stores</option>
              {data.stores.map((store) => <option key={store.id} value={store.id}>{storeName(store)}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500"><Filter className="h-4 w-4" /> Status</span>
            <select name="status" defaultValue={selectedStatus} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-indigo-300 focus:ring-4 focus:ring-indigo-500/10">
              <option value="all">All statuses</option>
              <option value="risky">Risk detected</option>
              <option value="review">Needs review</option>
              <option value="approved">Allowed</option>
              <option value="blocked">Blocked</option>
            </select>
          </label>
          <button className="inline-flex items-center justify-center rounded-2xl bg-slate-950 px-5 py-3 text-sm font-bold text-white transition hover:bg-slate-800">Apply</button>
        </form>
      </SectionCard>

      <form action={bulkUpdateGoogleMerchantProducts} className="space-y-6">
        <SectionCard
          title={`Product selection (${visibleProducts.length} shown${filteredProducts.length > visibleProducts.length ? ` of ${filteredProducts.length}` : ''})`}
          action={
            <div className="flex flex-wrap gap-2">
              <button name="action" value="allow" className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-500"><CheckCircle2 className="h-4 w-4" /> Allow selected</button>
              <button name="action" value="block" className="inline-flex items-center gap-2 rounded-2xl bg-rose-600 px-3 py-2 text-xs font-bold text-white hover:bg-rose-500"><Ban className="h-4 w-4" /> Block selected</button>
              <button name="action" value="review" className="inline-flex items-center gap-2 rounded-2xl bg-amber-500 px-3 py-2 text-xs font-bold text-white hover:bg-amber-400"><ShieldAlert className="h-4 w-4" /> Manual review</button>
              <button name="action" value="block-risky" className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-3 py-2 text-xs font-bold text-white hover:bg-slate-800">Block risky shown</button>
            </div>
          }
        >
          {visibleProducts.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm leading-6 text-slate-600">
              No products matched this filter.
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-slate-200">
              <div className="hidden grid-cols-[44px_1.2fr_0.9fr_0.9fr_0.7fr] gap-4 border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-500 lg:grid">
                <span>Select</span><span>Product</span><span>Store / source</span><span>Risk</span><span>Status</span>
              </div>
              <div className="divide-y divide-slate-100">
                {visibleProducts.map((product) => {
                  const reasons = riskReasons(product);
                  const storeId = getStoreId(product);
                  const productPrice = getPrice(product);
                  const productId = getProductId(product);
                  return (
                    <div key={product.path} className="grid gap-4 px-4 py-4 lg:grid-cols-[44px_1.2fr_0.9fr_0.9fr_0.7fr] lg:items-start">
                      <div>
                        <input type="checkbox" name="productPath" value={product.path} className="mt-1 h-4 w-4 rounded border-slate-300 text-indigo-600" />
                        {reasons.length > 0 ? <input type="hidden" name="riskyProductPath" value={product.path} /> : null}
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-sm font-semibold text-slate-950">{getName(product)}</h3>
                          <StatusBadge tone="blue">{firstText(product, ['listingType', 'itemType', 'type'], 'product')}</StatusBadge>
                        </div>
                        <p className="mt-1 truncate text-xs text-slate-500">{productId} · {product.path}</p>
                        <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-600">{getDescription(product) || 'No description available.'}</p>
                        <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                          <span className="rounded-full bg-slate-100 px-2.5 py-1">{getCategory(product) || 'No category'}</span>
                          <span className="rounded-full bg-slate-100 px-2.5 py-1">{productPrice ? `GHS ${productPrice.toFixed(2)}` : 'No price'}</span>
                        </div>
                      </div>
                      <div className="text-sm text-slate-600">
                        <p className="font-semibold text-slate-900">{storeId ? storeMap.get(storeId) || storeId : 'No store linked'}</p>
                        <p className="mt-1 text-xs text-slate-500">{product.sourceLabel}</p>
                        {storeId ? <Link href={`/admin/stores/${encodeURIComponent(storeId)}`} className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-500">Open store <ExternalLink className="h-3.5 w-3.5" /></Link> : null}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {reasons.length > 0 ? reasons.map((reason) => <StatusBadge key={`${product.path}-${reason}`} tone={reason.includes('price') || reason.includes('store') ? 'red' : 'yellow'}>{reason}</StatusBadge>) : <StatusBadge tone="green">No risk keyword</StatusBadge>}
                      </div>
                      <div>{statusBadge(product)}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </SectionCard>
      </form>

      <SectionCard title="Store matching note">
        <div className="grid gap-4 text-sm leading-6 text-slate-600 md:grid-cols-3">
          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="font-semibold text-slate-950">Stores source</p>
            <p className="mt-1">This page now reads business/store names from <code>/stores</code>.</p>
          </div>
          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="font-semibold text-slate-950">Store settings</p>
            <p className="mt-1">Use <Link className="font-semibold text-indigo-600" href="/admin/store-settings">Store Settings</Link> for <code>/storeSettings</code> Google connection and integration details.</p>
          </div>
          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="font-semibold text-slate-950">Linked products</p>
            <p className="mt-1">{storeLinkedProducts} products currently have a storeId that can match a store document.</p>
          </div>
        </div>
      </SectionCard>

      {Object.keys(data.collectionErrors).length > 0 ? (
        <SectionCard title="Collection notices">
          <div className="space-y-2 text-xs leading-5 text-slate-500">
            {Object.entries(data.collectionErrors).map(([collection, error]) => <p key={collection} className="rounded-xl bg-slate-50 p-3"><span className="font-semibold text-slate-700">{collection}:</span> {error}</p>)}
          </div>
        </SectionCard>
      ) : null}
    </div>
  );
}
