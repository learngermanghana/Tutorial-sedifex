import Link from 'next/link';
import { AlertTriangle, ArrowUpRight, Boxes, ImageOff, PackageSearch, Search, Store, Tags } from 'lucide-react';
import { SectionCard, StatCard, StatusBadge } from '../../../components/admin/ui';
import { getFirebaseEnvStatus, listFirestoreDocuments } from '../../../lib/firebase-admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type ProductRecord = Record<string, unknown> & {
  id?: string;
  path?: string;
  storeId?: string;
  name?: string;
  productName?: string;
  category?: string;
  description?: string;
  price?: number;
  stockCount?: number;
  itemType?: string;
  imageUrl?: string;
  imageUrls?: unknown;
  updatedAt?: string | null;
};

type PublicProductRecord = Record<string, unknown> & {
  id?: string;
  storeId?: string;
  productId?: string;
  isVisible?: boolean;
};

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function numberValue(value: unknown) {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function productName(product: ProductRecord) {
  return cleanText(product.name) || cleanText(product.productName) || cleanText(product.id) || 'Untitled product';
}

function storeId(product: ProductRecord) {
  return cleanText(product.storeId) || 'No store ID';
}

function itemType(product: ProductRecord) {
  const value = cleanText(product.itemType).toLowerCase();
  if (value === 'service') return 'service';
  if (value === 'made_to_order') return 'made_to_order';
  return 'product';
}

function hasImage(product: ProductRecord) {
  const direct = cleanText(product.imageUrl);
  const imageUrls = Array.isArray(product.imageUrls) ? product.imageUrls : [];
  return Boolean(direct || imageUrls.some((item) => cleanText(item)));
}

function hasPrice(product: ProductRecord) {
  const price = numberValue(product.price);
  return price !== null && price > 0;
}

function hasDescription(product: ProductRecord) {
  return Boolean(cleanText(product.description));
}

function hasCategory(product: ProductRecord) {
  return Boolean(cleanText(product.category));
}

function stockCount(product: ProductRecord) {
  return numberValue(product.stockCount);
}

function formatPrice(value: unknown) {
  const amount = numberValue(value);
  if (amount === null) return 'No price';
  return new Intl.NumberFormat('en', { style: 'currency', currency: 'GHS', maximumFractionDigits: 2 }).format(amount);
}

function formatDate(value: unknown) {
  if (typeof value !== 'string') return '—';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
}

function productKey(product: ProductRecord) {
  const sid = cleanText(product.storeId);
  const pid = cleanText(product.id);
  return sid && pid ? `${sid}_${pid}` : '';
}

function publicProductKeys(publicProducts: PublicProductRecord[]) {
  const keys = new Set<string>();

  for (const product of publicProducts) {
    const id = cleanText(product.id);
    const sid = cleanText(product.storeId);
    const pid = cleanText(product.productId);
    if (id) keys.add(id);
    if (sid && pid) keys.add(`${sid}_${pid}`);
  }

  return keys;
}

function issueList(product: ProductRecord, publicKeys: Set<string>) {
  const issues: string[] = [];
  if (!cleanText(product.storeId)) issues.push('missing storeId');
  if (!hasImage(product)) issues.push('missing image');
  if (!hasPrice(product)) issues.push('missing price');
  if (!hasDescription(product)) issues.push('missing description');
  if (!hasCategory(product)) issues.push('missing category');
  if (stockCount(product) !== null && Number(stockCount(product)) <= 0 && itemType(product) === 'product') issues.push('zero stock');
  const key = productKey(product);
  if (key && !publicKeys.has(key)) issues.push('not in publicProducts');
  return issues;
}

async function loadProductData() {
  const env = getFirebaseEnvStatus();

  if (!env.ready) {
    return {
      ok: false,
      error: 'Firebase envs are not ready in Vercel.',
      products: [] as ProductRecord[],
      publicProducts: [] as PublicProductRecord[],
    };
  }

  try {
    const [productsResult, publicProductsResult] = await Promise.all([
      listFirestoreDocuments('products', 100),
      listFirestoreDocuments('publicProducts', 100),
    ]);

    return {
      ok: true,
      error: null,
      products: productsResult.documents as ProductRecord[],
      publicProducts: publicProductsResult.documents as PublicProductRecord[],
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Unable to load products from Firestore.',
      products: [] as ProductRecord[],
      publicProducts: [] as PublicProductRecord[],
    };
  }
}

export default async function ProductsPage() {
  const result = await loadProductData();
  const products = result.products;
  const publicProducts = result.publicProducts;
  const publicKeys = publicProductKeys(publicProducts);
  const missingImage = products.filter((product) => !hasImage(product));
  const missingPrice = products.filter((product) => !hasPrice(product));
  const missingDescription = products.filter((product) => !hasDescription(product));
  const missingCategory = products.filter((product) => !hasCategory(product));
  const zeroStock = products.filter((product) => stockCount(product) !== null && Number(stockCount(product)) <= 0 && itemType(product) === 'product');
  const services = products.filter((product) => itemType(product) === 'service');
  const physicalProducts = products.filter((product) => itemType(product) === 'product');
  const notPublic = products.filter((product) => {
    const key = productKey(product);
    return key && !publicKeys.has(key);
  });
  const visiblePublic = publicProducts.filter((product) => product.isVisible === true);
  const reviewRows = products
    .map((product) => ({ product, issues: issueList(product, publicKeys) }))
    .filter((row) => row.issues.length > 0)
    .sort((a, b) => b.issues.length - a.issues.length)
    .slice(0, 15);

  const stats = [
    { label: 'Products loaded', value: result.ok ? String(products.length) : 'Setup', delta: result.ok ? 'From products collection' : 'Database not ready' },
    { label: 'Public records', value: result.ok ? String(publicProducts.length) : '—', delta: 'From publicProducts' },
    { label: 'Visible public', value: result.ok ? String(visiblePublic.length) : '—', delta: 'isVisible=true' },
    { label: 'Need review', value: result.ok ? String(reviewRows.length) : '—', delta: 'Top issues in loaded sample' },
  ];

  const qualityStats = [
    { label: 'Missing image', value: String(missingImage.length), icon: ImageOff, tone: missingImage.length ? ('yellow' as const) : ('green' as const) },
    { label: 'Missing price', value: String(missingPrice.length), icon: Tags, tone: missingPrice.length ? ('yellow' as const) : ('green' as const) },
    { label: 'Missing description', value: String(missingDescription.length), icon: Search, tone: missingDescription.length ? ('yellow' as const) : ('green' as const) },
    { label: 'Missing category', value: String(missingCategory.length), icon: Boxes, tone: missingCategory.length ? ('yellow' as const) : ('green' as const) },
    { label: 'Zero stock', value: String(zeroStock.length), icon: PackageSearch, tone: zeroStock.length ? ('yellow' as const) : ('green' as const) },
    { label: 'Not public', value: String(notPublic.length), icon: Store, tone: notPublic.length ? ('red' as const) : ('green' as const) },
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
              <p className="font-semibold">Product data is not available yet.</p>
              <p className="mt-1 leading-6">{result.error}</p>
            </div>
          </div>
        </section>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[1.45fr_0.9fr]">
        <div className="space-y-6">
          <SectionCard
            title="Product quality review"
            action={<Link href="/admin/marketplace" className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-500">Marketplace <ArrowUpRight className="h-3.5 w-3.5" /></Link>}
          >
            <div className="overflow-hidden rounded-2xl border border-slate-200">
              <div className="grid grid-cols-[1.2fr_0.75fr_0.75fr_1.2fr_auto] bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 max-lg:hidden">
                <span>Product</span><span>Store</span><span>Price</span><span>Issues</span><span>Type</span>
              </div>
              <div className="divide-y divide-slate-200">
                {reviewRows.length === 0 ? (
                  <div className="p-8 text-center text-sm text-slate-500">No product issues found in the loaded sample.</div>
                ) : reviewRows.map(({ product, issues }) => (
                  <div key={product.path || product.id} className="grid gap-3 px-4 py-4 text-sm lg:grid-cols-[1.2fr_0.75fr_0.75fr_1.2fr_auto] lg:items-center">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-slate-950">{productName(product)}</p>
                      <p className="truncate text-xs text-slate-500">{product.id || 'No product ID'}</p>
                    </div>
                    <p className="truncate text-slate-600">{storeId(product)}</p>
                    <p className="truncate text-slate-600">{formatPrice(product.price)}</p>
                    <p className="truncate text-xs text-slate-500">{issues.join(', ')}</p>
                    <StatusBadge tone={itemType(product) === 'service' ? 'blue' : 'slate'}>{itemType(product)}</StatusBadge>
                  </div>
                ))}
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Recently loaded products">
            <div className="overflow-hidden rounded-2xl border border-slate-200">
              <div className="grid grid-cols-[1.3fr_0.8fr_0.7fr_0.7fr_auto] bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 max-lg:hidden">
                <span>Product</span><span>Category</span><span>Stock</span><span>Updated</span><span>Public</span>
              </div>
              <div className="divide-y divide-slate-200">
                {products.slice(0, 12).map((product) => {
                  const key = productKey(product);
                  const isPublic = Boolean(key && publicKeys.has(key));
                  return (
                    <div key={`recent-${product.path || product.id}`} className="grid gap-3 px-4 py-4 text-sm lg:grid-cols-[1.3fr_0.8fr_0.7fr_0.7fr_auto] lg:items-center">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-slate-950">{productName(product)}</p>
                        <p className="truncate text-xs text-slate-500">{storeId(product)}</p>
                      </div>
                      <p className="truncate text-slate-600">{cleanText(product.category) || 'No category'}</p>
                      <p className="truncate text-slate-600">{stockCount(product) ?? '—'}</p>
                      <p className="truncate text-slate-600">{formatDate(product.updatedAt)}</p>
                      <StatusBadge tone={isPublic ? 'green' : 'yellow'}>{isPublic ? 'Public' : 'Missing'}</StatusBadge>
                    </div>
                  );
                })}
              </div>
            </div>
          </SectionCard>
        </div>

        <div className="space-y-6">
          <SectionCard title="Quality checks">
            <div className="space-y-3">
              {qualityStats.map((item) => {
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

          <SectionCard title="Product type split">
            <div className="grid gap-3">
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-950">Physical products</p>
                <p className="mt-2 text-2xl font-bold text-slate-950">{physicalProducts.length}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-950">Services</p>
                <p className="mt-2 text-2xl font-bold text-slate-950">{services.length}</p>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Next product upgrade">
            <div className="space-y-3 text-sm leading-6 text-slate-600">
              <div className="rounded-2xl bg-slate-50 p-4">
                Add store/product filters, pagination, and a repair action to backfill missing publicProducts records.
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                Add Google Shopping validation: title, description, image, price, brand, and GTIN/MPN/SKU readiness.
              </div>
            </div>
          </SectionCard>
        </div>
      </section>
    </div>
  );
}
