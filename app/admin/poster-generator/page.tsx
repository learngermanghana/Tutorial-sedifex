import { Megaphone } from 'lucide-react';
import PosterGeneratorClient, { type PosterProduct } from '../../../components/admin/PosterGeneratorClient';
import { SectionCard } from '../../../components/admin/ui';
import { getFirebaseEnvStatus, listFirestoreDocuments } from '../../../lib/firebase-admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type RawItem = Record<string, unknown> & { id?: string; path?: string };

type CollectionRead = {
  ok: boolean;
  error: string | null;
  documents: RawItem[];
};

function text(record: Record<string, unknown>, fields: string[], fallback = '') {
  for (const field of fields) {
    const value = record[field];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number') return String(value);
  }
  return fallback;
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
  return value
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'product';
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

function storeName(item: RawItem) {
  const direct = text(item, ['storeName', 'merchantName', 'businessName', 'sellerName'], '');
  if (direct) return direct;
  const store = item.store;
  if (store && typeof store === 'object' && !Array.isArray(store)) {
    return text(store as Record<string, unknown>, ['name', 'storeName', 'businessName'], 'Verified Ghana store');
  }
  return 'Verified Ghana store';
}

async function readCollection(collectionPath: string): Promise<CollectionRead> {
  try {
    const result = await listFirestoreDocuments(collectionPath, 120);
    return { ok: true, error: null, documents: result.documents as RawItem[] };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : `Unable to read ${collectionPath}.`, documents: [] };
  }
}

async function loadProducts() {
  const env = getFirebaseEnvStatus();
  if (!env.ready) return { ready: false, products: [] as PosterProduct[], error: 'Firebase environment variables are not ready in this deployment.' };

  const [products, publicProducts, catalogItems, services, courses] = await Promise.all([
    readCollection('products'),
    readCollection('publicProducts'),
    readCollection('catalogItems'),
    readCollection('services'),
    readCollection('courses'),
  ]);

  const errors = [products, publicProducts, catalogItems, services, courses].filter((result) => !result.ok && result.error).map((result) => result.error).filter(Boolean) as string[];
  const seen = new Set<string>();
  const combined = [...publicProducts.documents, ...products.documents, ...catalogItems.documents, ...services.documents, ...courses.documents];

  const mapped = combined
    .map((item): PosterProduct => {
      const name = text(item, ['name', 'title', 'productName', 'serviceName', 'courseName'], 'Untitled product');
      const id = text(item, ['id', 'productId', 'itemId', 'listingId'], name);
      return {
        id,
        name,
        price: productPrice(item),
        imageUrl: firstImage(item),
        productUrl: productUrl(item, name),
        storeName: storeName(item),
        category: text(item, ['category', 'categoryName', 'type', 'itemType'], 'Product'),
      };
    })
    .filter((item) => {
      const key = `${item.productUrl}-${item.name}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

  return { ready: true, products: mapped, error: errors[0] || null };
}

export default async function PosterGeneratorPage() {
  const data = await loadProducts();

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-slate-950 p-6 text-white shadow-sm sm:p-8">
        <div className="inline-flex items-center gap-2 rounded-full border border-orange-300/20 bg-orange-400/10 px-3 py-1 text-xs font-semibold text-orange-100">
          <Megaphone className="h-4 w-4" /> Sedifex Market Poster Generator
        </div>
        <h2 className="mt-5 max-w-3xl text-3xl font-bold tracking-tight sm:text-4xl">
          Create branded product posters with QR codes from inventory.
        </h2>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300">
          Pick a product, auto-fill the Sedifex Market link, generate a QR code, copy a caption, and download a ready-to-post SVG flyer.
        </p>
      </section>

      {data.error ? (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-800">
          {data.error}
        </section>
      ) : null}

      <SectionCard title="Poster builder">
        <PosterGeneratorClient products={data.products} />
      </SectionCard>
    </div>
  );
}
