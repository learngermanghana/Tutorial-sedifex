import Link from 'next/link';
import { Ban, CheckCircle2, ExternalLink, PackageX, ShieldAlert, Store } from 'lucide-react';
import { SectionCard, StatCard, StatusBadge } from '../../../../components/admin/ui';
import { adminFirestore, getFirebaseEnvStatus } from '../../../../lib/firebase-admin';
import { googleMerchantRiskReasons } from '../../../../lib/google-merchant-policy';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type StoreRecord = Record<string, unknown> & { id: string; path: string };
type ProductRecord = Record<string, unknown> & { id: string; path: string };
type StoreRiskData = {
  error: string | null;
  stores: StoreRecord[];
  riskCounts: Map<string, number>;
  productCounts: Map<string, number>;
};

function text(value: unknown, fallback = '') {
  if (typeof value === 'string') return value.trim() || fallback;
  if (typeof value === 'number') return String(value);
  return fallback;
}

function boolValue(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'approved', 'verified', 'active'].includes(normalized)) return true;
    if (['false', '0', 'no', 'blocked', 'rejected', 'inactive'].includes(normalized)) return false;
  }
  return null;
}

function storeName(store: StoreRecord) {
  return text(store.storeName || store.name || store.businessName || store.displayName || store.title, store.id);
}

function approvalStatus(store: StoreRecord) {
  if (boolValue(store.googleMerchantApproved) === true) return 'google-approved';
  if (boolValue(store.marketplaceApproved) === true || boolValue(store.approvedForMarketplace) === true || boolValue(store.verified) === true) return 'market-approved';
  const status = text(store.marketplaceApprovalStatus || store.googleMerchantApprovalStatus || store.approvalStatus || store.verificationStatus).toLowerCase();
  if (status.includes('review') || status.includes('pending')) return 'review';
  if (status.includes('block') || status.includes('reject')) return 'blocked';
  return 'new';
}

function statusBadge(store: StoreRecord) {
  const status = approvalStatus(store);
  if (status === 'google-approved') return <StatusBadge tone="green">Google approved</StatusBadge>;
  if (status === 'market-approved') return <StatusBadge tone="blue">Marketplace approved</StatusBadge>;
  if (status === 'blocked') return <StatusBadge tone="red">Blocked</StatusBadge>;
  if (status === 'review') return <StatusBadge tone="yellow">Manual review</StatusBadge>;
  return <StatusBadge tone="slate">Not reviewed</StatusBadge>;
}

function productStoreId(product: ProductRecord) {
  return text(product.storeId || product.ownerStoreId || product.businessId || product.tenantStoreId);
}

async function loadStoresAndRiskCounts(): Promise<StoreRiskData> {
  const env = getFirebaseEnvStatus();
  if (!env.ready) {
    return {
      error: 'Firebase environment variables are not ready.',
      stores: [],
      riskCounts: new Map<string, number>(),
      productCounts: new Map<string, number>(),
    };
  }

  const db = adminFirestore();
  const [storesSnap, productsSnap, listingsSnap, publicProductsSnap, publicServicesSnap] = await Promise.all([
    db.collection('stores').limit(400).get(),
    db.collection('products').limit(600).get(),
    db.collection('publicListings').limit(600).get(),
    db.collection('publicProducts').limit(600).get(),
    db.collection('publicServices').limit(600).get(),
  ]);

  const stores: StoreRecord[] = storesSnap.docs.map((doc) => ({ ...(doc.data() as Record<string, unknown>), id: doc.id, path: doc.ref.path }));
  const products: ProductRecord[] = [productsSnap, listingsSnap, publicProductsSnap, publicServicesSnap].flatMap((snap) =>
    snap.docs.map((doc) => ({ ...(doc.data() as Record<string, unknown>), id: doc.id, path: doc.ref.path } as ProductRecord)),
  );

  const riskCounts = new Map<string, number>();
  const productCounts = new Map<string, number>();
  for (const product of products) {
    const storeId = productStoreId(product);
    if (!storeId) continue;
    productCounts.set(storeId, (productCounts.get(storeId) || 0) + 1);
    if (googleMerchantRiskReasons(product).length > 0) riskCounts.set(storeId, (riskCounts.get(storeId) || 0) + 1);
  }

  return { error: null, stores, riskCounts, productCounts };
}

async function updateStoreApproval(formData: FormData) {
  'use server';

  const storeId = text(formData.get('storeId'));
  const action = text(formData.get('action'));
  if (!storeId || !['approve-market', 'approve-google', 'block-google', 'review'].includes(action)) return;

  const now = new Date().toISOString();
  const updates: Record<string, Record<string, unknown>> = {
    'approve-market': {
      storeStatus: 'active',
      eligibleForBuy: true,
      buyOptOut: false,
      marketplaceApproved: true,
      approvedForMarketplace: true,
      marketplaceApprovalStatus: 'approved',
      verificationStatus: 'verified',
      verified: true,
    },
    'approve-google': {
      storeStatus: 'active',
      eligibleForBuy: true,
      buyOptOut: false,
      marketplaceApproved: true,
      approvedForMarketplace: true,
      marketplaceApprovalStatus: 'approved',
      googleMerchantApproved: true,
      googleMerchantApprovalStatus: 'approved',
      verificationStatus: 'verified',
      verified: true,
    },
    'block-google': {
      googleMerchantApproved: false,
      googleMerchantApprovalStatus: 'blocked',
      marketplaceApprovalStatus: 'manual_review',
      googleMerchantBlockedAt: now,
      googleMerchantBlockedBy: 'sedifexadmin',
    },
    review: {
      marketplaceApprovalStatus: 'manual_review',
      googleMerchantApprovalStatus: 'manual_review',
      googleMerchantApproved: false,
    },
  };

  const db = adminFirestore();
  await Promise.all([
    db.collection('stores').doc(storeId).set({ ...updates[action], adminUpdatedAt: now, adminUpdatedFrom: 'google-sync-store-controls' }, { merge: true }),
    db.collection('adminAuditLogs').add({ action: `store_${action}`, storeId, actor: 'sedifexadmin', createdAt: now }),
  ]);

}

async function blockRiskyProductsForStore(formData: FormData) {
  'use server';

  const storeId = text(formData.get('storeId'));
  if (!storeId) return;
  const now = new Date().toISOString();
  const db = adminFirestore();
  const collectionNames = ['products', 'publicListings', 'publicProducts', 'publicServices'];
  let affectedCount = 0;

  await Promise.all(collectionNames.map(async (collectionName) => {
    const snapshot = await db.collection(collectionName).where('storeId', '==', storeId).limit(500).get();
    await Promise.all(snapshot.docs.map(async (doc) => {
      const product = { ...(doc.data() as Record<string, unknown>), id: doc.id, path: doc.ref.path };
      if (googleMerchantRiskReasons(product).length === 0) return;
      affectedCount += 1;
      await doc.ref.set({
        googleMerchantEligible: false,
        excludeFromGoogleMerchant: true,
        googleMerchantExcluded: true,
        googleShoppingExcluded: true,
        merchantCenterExcluded: true,
        googleMerchantReviewStatus: 'blocked',
        googleMerchantManualDecision: 'exclude',
        googleMerchantBlockedReason: 'store_bulk_risk_block',
        googleMerchantReviewedAt: now,
        googleMerchantReviewedBy: 'sedifexadmin',
        adminUpdatedAt: now,
        adminUpdatedFrom: 'google-sync-store-controls',
      }, { merge: true });
    }));
  }));

  await db.collection('adminAuditLogs').add({
    action: 'google_merchant_block_risky_store_products',
    storeId,
    actor: 'sedifexadmin',
    affectedCount,
    createdAt: now,
  });

}

export default async function GoogleSyncStoresPage() {
  const data = await loadStoresAndRiskCounts();
  const stores = data.stores.sort((a, b) => storeName(a).localeCompare(storeName(b)));
  const googleApproved = stores.filter((store) => boolValue(store.googleMerchantApproved) === true).length;
  const marketApproved = stores.filter((store) => boolValue(store.marketplaceApproved) === true || boolValue(store.approvedForMarketplace) === true || boolValue(store.verified) === true).length;
  const riskyStores = stores.filter((store) => (data.riskCounts.get(store.id) || 0) > 0).length;

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-slate-950 p-6 text-white shadow-sm sm:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-100">
              <Store className="h-4 w-4" /> Store approvals
            </div>
            <h2 className="mt-5 max-w-4xl text-3xl font-bold tracking-tight sm:text-4xl">Approve stores before Google receives their products.</h2>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300">Approve stores for Sedifex Market, approve them for Google Merchant, block a store from Google, or bulk-block risky products in that store.</p>
          </div>
          <Link href="/admin/google-sync" className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-bold text-slate-950 hover:bg-slate-100">
            Back to Google Sync <ExternalLink className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {data.error ? <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">{data.error}</div> : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Stores" value={String(stores.length)} delta="Loaded from /stores" />
        <StatCard label="Marketplace approved" value={String(marketApproved)} delta="Allowed on Sedifex Market" />
        <StatCard label="Google approved" value={String(googleApproved)} delta="Allowed for Merchant feed" />
        <StatCard label="Stores with risk" value={String(riskyStores)} delta="Have risky product keywords" />
      </section>

      <SectionCard title="Store approval controls">
        <div className="divide-y divide-slate-100">
          {stores.map((store) => {
            const riskCount = data.riskCounts.get(store.id) || 0;
            const productCount = data.productCounts.get(store.id) || 0;
            return (
              <div key={store.id} className="grid gap-4 py-5 lg:grid-cols-[1fr_240px_380px] lg:items-center">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-slate-950">{storeName(store)}</h3>
                    {statusBadge(store)}
                    {riskCount > 0 ? <StatusBadge tone="yellow">{riskCount} risky</StatusBadge> : <StatusBadge tone="green">No risk</StatusBadge>}
                  </div>
                  <p className="mt-1 break-all text-xs text-slate-500">{store.id} · {productCount} products/listings detected</p>
                </div>
                <div className="text-sm text-slate-600">
                  <p><strong>Status:</strong> {text(store.storeStatus || store.status, '—')}</p>
                  <p><strong>Approval:</strong> {text(store.marketplaceApprovalStatus || store.approvalStatus || store.verificationStatus, '—')}</p>
                </div>
                <div className="flex flex-wrap gap-2 lg:justify-end">
                  <form action={updateStoreApproval}><input type="hidden" name="storeId" value={store.id} /><button name="action" value="approve-market" className="inline-flex items-center gap-2 rounded-2xl bg-indigo-600 px-3 py-2 text-xs font-bold text-white hover:bg-indigo-500"><CheckCircle2 className="h-4 w-4" /> Approve Market</button></form>
                  <form action={updateStoreApproval}><input type="hidden" name="storeId" value={store.id} /><button name="action" value="approve-google" className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-500"><CheckCircle2 className="h-4 w-4" /> Approve Google</button></form>
                  <form action={updateStoreApproval}><input type="hidden" name="storeId" value={store.id} /><button name="action" value="block-google" className="inline-flex items-center gap-2 rounded-2xl bg-rose-600 px-3 py-2 text-xs font-bold text-white hover:bg-rose-500"><Ban className="h-4 w-4" /> Block Google</button></form>
                  <form action={updateStoreApproval}><input type="hidden" name="storeId" value={store.id} /><button name="action" value="review" className="inline-flex items-center gap-2 rounded-2xl bg-amber-500 px-3 py-2 text-xs font-bold text-white hover:bg-amber-400"><ShieldAlert className="h-4 w-4" /> Review</button></form>
                  <form action={blockRiskyProductsForStore}><input type="hidden" name="storeId" value={store.id} /><button disabled={riskCount === 0} className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-3 py-2 text-xs font-bold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"><PackageX className="h-4 w-4" /> Block risky</button></form>
                </div>
              </div>
            );
          })}
        </div>
      </SectionCard>
    </div>
  );
}
