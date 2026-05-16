import Link from 'next/link';
import { AlertTriangle, ArrowUpRight, BadgeCheck, Eye, EyeOff, ImageOff, PackageSearch, Search, Store, Tags } from 'lucide-react';
import { SectionCard, StatCard, StatusBadge } from '../../../components/admin/ui';
import { getFirebaseEnvStatus, listFirestoreDocuments } from '../../../lib/firebase-admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type PublicProduct = Record<string, unknown> & {
  id?: string;
  path?: string;
  storeId?: string;
  productId?: string;
  productName?: string;
  storeName?: string;
  storeSlug?: string;
  isVisible?: boolean;
  verified?: boolean;
  itemType?: string;
  price?: number;
  imageUrl?: string;
  imageUrls?: unknown;
  description?: string;
  category?: string;
  updatedAt?: string | null;
};

function text(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function productKey(product: PublicProduct) {
  return text(product.path) || text(product.id) || text(product.productId) || `${text(product.storeId)}-${productName(product)}`;
}

function numberValue(value: unknown) {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function hasImage(product: PublicProduct) {
  const direct = text(product.imageUrl);
  const imageUrls = Array.isArray(product.imageUrls) ? product.imageUrls : [];
  return Boolean(direct || imageUrls.some((item) => text(item)));
}

function hasPrice(product: PublicProduct) {
  const price = numberValue(product.price);
  return price !== null && price > 0;
}

function hasDescription(product: PublicProduct) {
  return Boolean(text(product.description));
}

function productName(product: PublicProduct) {
  return text(product.productName) || text(product.name) || text(product.id) || 'Untitled product';
}

function storeName(product: PublicProduct) {
  return text(product.storeName) || text(product.storeSlug) || text(product.storeId) || 'Unknown store';
}

function productIssueCount(product: PublicProduct) {
  return [!hasImage(product), !hasPrice(product), !hasDescription(product), !text(product.storeId)].filter(Boolean).length;
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

async function loadMarketplaceProducts() {
  const env = getFirebaseEnvStatus();

  if (!env.ready) {
    return {
      ok: false,
      error: 'Firebase envs are not ready in Vercel.',
      products: [] as PublicProduct[],
    };
  }

  try {
    const result = await listFirestoreDocuments('publicProducts', 100);
    return {
      ok: true,
      error: null,
      products: result.documents as PublicProduct[],
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Unable to load publicProducts.',
      products: [] as PublicProduct[],
    };
  }
}

export default async function MarketplacePage() {
  const result = await loadMarketplaceProducts();
  const products = result.products;
  const visibleProducts = products.filter((product) => product.isVisible === true);
  const hiddenProducts = products.filter((product) => product.isVisible !== true);
  const verifiedStoreIds = new Set(products.filter((product) => product.verified === true && text(product.storeId)).map((product) => text(product.storeId)));
  const missingImage = products.filter((product) => !hasImage(product));
  const missingPrice = products.filter((product) => !hasPrice(product));
  const missingDescription = products.filter((product) => !hasDescription(product));
  const missingStoreId = products.filter((product) => !text(product.storeId));
  const services = products.filter((product) => text(product.itemType).toLowerCase() === 'service');
  const productsOnly = products.filter((product) => text(product.itemType).toLowerCase() !== 'service');
  const needsReview = products
    .map((product) => ({ product, issues: productIssueCount(product) }))
    .filter((entry) => entry.issues > 0)
    .sort((a, b) => b.issues - a.issues)
    .slice(0, 12);

  const stats = [
    { label: 'Public products', value: result.ok ? String(products.length) : 'Setup', delta: result.ok ? 'Sample loaded from publicProducts' : 'Database not ready' },
    { label: 'Visible on market', value: result.ok ? String(visibleProducts.length) : '—', delta: 'isVisible=true' },
    { label: 'Hidden / blocked', value: result.ok ? String(hiddenProducts.length) : '—', delta: 'Needs visibility review' },
    { label: 'Verified stores', value: result.ok ? String(verifiedStoreIds.size) : '—', delta: 'From publicProducts records' },
  ];

  const qualityStats = [
    { label: 'Missing image', value: String(missingImage.length), icon: ImageOff, tone: missingImage.length ? ('yellow' as const) : ('green' as const) },
    { label: 'Missing price', value: String(missingPrice.length), icon: Tags, tone: missingPrice.length ? ('yellow' as const) : ('green' as const) },
    { label: 'Missing description', value: String(missingDescription.length), icon: Search, tone: missingDescription.length ? ('yellow' as const) : ('green' as const) },
    { label: 'Missing storeId', value: String(missingStoreId.length), icon: Store, tone: missingStoreId.length ? ('red' as const) : ('green' as const) },
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
              <p className="font-semibold">Marketplace data is not available yet.</p>
              <p className="mt-1 leading-6">{result.error}</p>
            </div>
          </div>
        </section>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[1.4fr_0.9fr]">
        <div className="space-y-6">
          <SectionCard
            title="Marketplace visibility"
            action={
              <Link href="/admin/products" className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-500">
                Products <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            }
          >
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-950"><Eye className="h-4 w-4 text-emerald-600" /> Visible</div>
                <p className="mt-3 text-2xl font-bold text-slate-950">{visibleProducts.length}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-950"><EyeOff className="h-4 w-4 text-amber-600" /> Hidden</div>
                <p className="mt-3 text-2xl font-bold text-slate-950">{hiddenProducts.length}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-950"><PackageSearch className="h-4 w-4 text-indigo-600" /> Products</div>
                <p className="mt-3 text-2xl font-bold text-slate-950">{productsOnly.length}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-950"><BadgeCheck className="h-4 w-4 text-indigo-600" /> Services</div>
                <p className="mt-3 text-2xl font-bold text-slate-950">{services.length}</p>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Products needing market review">
            <div className="overflow-hidden rounded-2xl border border-slate-200">
              <div className="grid grid-cols-[1.2fr_0.9fr_0.7fr_0.7fr_auto] bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 max-lg:hidden">
                <span>Product</span><span>Store</span><span>Price</span><span>Updated</span><span>Status</span>
              </div>
              <div className="divide-y divide-slate-200">
                {needsReview.length === 0 ? (
                  <div className="p-8 text-center text-sm text-slate-500">No marketplace product issues found in the loaded sample.</div>
                ) : needsReview.map(({ product }) => (
                  <div key={productKey(product)} className="grid gap-3 px-4 py-4 text-sm lg:grid-cols-[1.2fr_0.9fr_0.7fr_0.7fr_auto] lg:items-center">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-slate-950">{productName(product)}</p>
                      <p className="truncate text-xs text-slate-500">{text(product.productId) || text(product.id) || 'No product ID'}</p>
                    </div>
                    <p className="truncate text-slate-600">{storeName(product)}</p>
                    <p className="truncate text-slate-600">{formatPrice(product.price)}</p>
                    <p className="truncate text-slate-600">{formatDate(product.updatedAt)}</p>
                    <StatusBadge tone={product.isVisible === true ? 'green' : 'yellow'}>{product.isVisible === true ? 'Visible' : 'Hidden'}</StatusBadge>
                  </div>
                ))}
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

          <SectionCard title="Why this page matters">
            <div className="space-y-3 text-sm leading-6 text-slate-600">
              <div className="rounded-2xl bg-slate-50 p-4">
                SedifexMarket depends on the public read model. If a product is missing here, the homepage, category pages, and public store pages may not show it correctly.
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                This page checks the first 100 publicProducts records. Next we can add pagination, search, and repair actions.
              </div>
            </div>
          </SectionCard>
        </div>
      </section>
    </div>
  );
}
