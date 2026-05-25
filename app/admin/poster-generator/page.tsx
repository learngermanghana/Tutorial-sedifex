import { Megaphone } from 'lucide-react';
import PosterGeneratorClientV2 from '../../../components/admin/PosterGeneratorClientV2';
import type { PosterProduct } from '../../../components/admin/PosterGeneratorClient';
import { SectionCard } from '../../../components/admin/ui';
import { getFirebaseEnvStatus, listFirestoreDocuments } from '../../../lib/firebase-admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type RawItem = Record<string, unknown> & { id?: string; path?: string };
type StoreRecord = RawItem;
type CollectionRead = { ok: boolean; error: string | null; documents: RawItem[] };

function text(record: Record<string, unknown>, fields: string[], fallback = '') {
  for (const field of fields) {
    const value = record[field];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number') return String(value);
  }
  return fallback;
}

function boolValue(record: Record<string, unknown>, fields: string[]) {
  for (const field of fields) {
    const value = record[field];
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (['true', 'yes', 'verified', 'approved', 'active', 'live'].includes(normalized)) return true;
      if (['false', 'no', 'pending', 'rejected', 'blocked', 'draft'].includes(normalized)) return false;
    }
  }
  return false;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function firstImage(item: RawItem) {
  const direct = text(item, ['image', 'imageUrl', 'imageURL', 'photo', 'photoUrl', 'thumbnail', 'coverImage', 'mainImage'], '');
  if (direct) return direct;
  for (const field of ['images', 'gallery', 'photos', 'imageUrls']) {
    const value = item[field];
    if (Array.isArray(value)) {
      const url = value.find((entry) => typeof entry === 'string' && entry.trim());
      if (typeof url === 'string') return url;
    }
  }
  return '';
}

function slugify(value: string) {
  return value.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'product';
}

function productUrl(item: RawItem, name: string) {
  const direct = text(item, ['productUrl', 'marketUrl', 'marketplaceUrl', 'url', 'publicUrl'], '');
  if (direct) return direct;
  const id = text(item, ['id', 'productId', 'itemId', 'listingId'], '');
  return id ? `https://www.sedifexmarket.com/products/${slugify(name)}--${encodeURIComponent(id)}` : 'https://www.sedifexmarket.com/products';
}

function productPrice(item: RawItem) {
  const value = text(item, ['price', 'amount', 'salePrice', 'regularPrice', 'finalPrice', 'courseFee', 'servicePrice'], '');
  if (!value) return '';
  const numeric = Number(String(value).replace(/[^0-9.]/g, ''));
  if (Number.isFinite(numeric) && numeric > 0) return `GHS ${numeric.toLocaleString('en', { maximumFractionDigits: 2 })}`;
  return value;
}

function getStoreId(item: RawItem) {
  const direct = text(item, ['storeId', 'ownerStoreId', 'businessId', 'tenantStoreId', 'merchantId', 'merchant_id'], '');
  if (direct) return direct;
  const nestedStore = asRecord(item.store) || asRecord(item.merchant) || asRecord(item.business);
  return nestedStore ? text(nestedStore, ['id', 'storeId', 'merchantId', 'businessId'], '') : '';
}

function storeName(item: RawItem, verifiedStoreMap?: Map<string, StoreRecord>) {
  const storeId = getStoreId(item);
  const verifiedStore = storeId ? verifiedStoreMap?.get(storeId) : null;
  if (verifiedStore) return text(verifiedStore, ['storeName', 'name', 'businessName', 'displayName', 'merchantName', 'id'], 'Verified Ghana store');
  const direct = text(item, ['storeName', 'merchantName', 'businessName', 'sellerName'], '');
  if (direct) return direct;
  const store = asRecord(item.store);
  return store ? text(store, ['name', 'storeName', 'businessName'], 'Verified Ghana store') : 'Verified Ghana store';
}

function storeIsVerified(store: StoreRecord) {
  if (boolValue(store, ['isVerified', 'verified', 'storeVerified', 'marketplaceVerified', 'approved', 'isApproved'])) return true;
  const verification = asRecord(store.verification) || asRecord(store.marketplaceVerification) || asRecord(store.sedifexVerification);
  if (verification && boolValue(verification, ['verified', 'isVerified', 'approved', 'isApproved'])) return true;
  const status = text(store, ['verificationStatus', 'approvalStatus', 'marketplaceStatus', 'status', 'state'], '').toLowerCase();
  return ['verified', 'approved', 'active', 'live'].includes(status);
}

function buildVerifiedStoreMap(stores: RawItem[]): Map<string, StoreRecord> {
  const entries = stores
    .filter(storeIsVerified)
    .map((store): [string, StoreRecord] => [String(store.id || text(store, ['storeId', 'merchantId', 'businessId'], '')), store])
    .filter((entry): entry is [string, StoreRecord] => Boolean(entry[0]));
  return new Map<string, StoreRecord>(entries);
}

function isQualityProduct(item: RawItem) {
  const name = text(item, ['name', 'title', 'productName', 'serviceName', 'courseName'], '');
  const price = productPrice(item);
  const image = firstImage(item);
  const hiddenStatus = text(item, ['status', 'visibility', 'state'], '').toLowerCase();
  return Boolean(name && price && image && !['hidden', 'draft', 'inactive', 'blocked', 'rejected'].includes(hiddenStatus));
}

async function readCollection(collectionPath: string): Promise<CollectionRead> {
  try {
    const result = await listFirestoreDocuments(collectionPath, 1000);
    return { ok: true, error: null, documents: result.documents as RawItem[] };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : `Unable to read ${collectionPath}.`, documents: [] };
  }
}

async function loadProducts() {
  const env = getFirebaseEnvStatus();
  if (!env.ready) return { ready: false, products: [] as PosterProduct[], error: 'Firebase environment variables are not ready in this deployment.', verifiedStores: 0, scannedProducts: 0 };
  const [stores, storeSettings, products, publicProducts, catalogItems, services, courses] = await Promise.all([
    readCollection('stores'),
    readCollection('storeSettings'),
    readCollection('products'),
    readCollection('publicProducts'),
    readCollection('catalogItems'),
    readCollection('services'),
    readCollection('courses'),
  ]);
  const errors = [stores, storeSettings, products, publicProducts, catalogItems, services, courses].filter((result) => !result.ok && result.error).map((result) => result.error).filter(Boolean) as string[];
  const verifiedStoreMap = buildVerifiedStoreMap([...stores.documents, ...storeSettings.documents]);
  const seen = new Set<string>();
  const combined = [...publicProducts.documents, ...products.documents, ...catalogItems.documents, ...services.documents, ...courses.documents];
  const mapped = combined
    .filter((item) => {
      const storeId = getStoreId(item);
      return Boolean(storeId && verifiedStoreMap.has(storeId) && isQualityProduct(item));
    })
    .map((item): PosterProduct => {
      const name = text(item, ['name', 'title', 'productName', 'serviceName', 'courseName'], 'Untitled product');
      const id = text(item, ['id', 'productId', 'itemId', 'listingId'], name);
      return { id, name, price: productPrice(item), imageUrl: firstImage(item), productUrl: productUrl(item, name), storeName: storeName(item, verifiedStoreMap), category: text(item, ['category', 'categoryName', 'type', 'itemType'], 'Product') };
    })
    .filter((item) => {
      const key = `${item.productUrl}-${item.name}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  return {
    ready: true,
    products: mapped,
    error: verifiedStoreMap.size === 0 ? 'No verified stores were detected yet. Mark stores as verified/approved/active so their quality products appear here.' : errors[0] || null,
    verifiedStores: verifiedStoreMap.size,
    scannedProducts: combined.length,
  };
}

export default async function PosterGeneratorPage() {
  const data = await loadProducts();
  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-slate-950 p-6 text-white shadow-sm sm:p-8">
        <div className="inline-flex items-center gap-2 rounded-full border border-orange-300/20 bg-orange-400/10 px-3 py-1 text-xs font-semibold text-orange-100"><Megaphone className="h-4 w-4" /> Sedifex Market Poster Generator</div>
        <h2 className="mt-5 max-w-3xl text-3xl font-bold tracking-tight sm:text-4xl">Create branded product posters from verified store products.</h2>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300">Search verified, poster-ready marketplace products and generate PNG/JPEG posters with QR codes.</p>
        <div className="mt-5 flex flex-wrap gap-3 text-xs font-semibold text-slate-200">
          <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1">Verified stores: {data.verifiedStores}</span>
          <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1">Scanned items: {data.scannedProducts}</span>
          <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1">Poster-ready: {data.products.length}</span>
        </div>
      </section>
      {data.error ? <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-800">{data.error}</section> : null}
      <SectionCard title="Poster builder">
        <PosterGeneratorClientV2 products={data.products} />
      </SectionCard>
    </div>
  );
}
