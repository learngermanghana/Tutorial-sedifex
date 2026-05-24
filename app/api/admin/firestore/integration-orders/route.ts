import { NextResponse } from 'next/server';
import { adminFirestore, listFirestoreDocuments } from '@/lib/firebase-admin';

type RawRecord = Record<string, unknown>;

function text(value: unknown, fallback = '') {
  if (typeof value === 'string') return value.trim() || fallback;
  if (typeof value === 'number') return String(value);
  return fallback;
}

function storeIdFromOrder(order: RawRecord) {
  return text(order.storeId || order.store_id || order.merchantId || order.merchant_id || order.businessId || order.business_id);
}

function storeNameFromRecord(store: RawRecord | undefined, fallback = '') {
  if (!store) return fallback;
  return text(store.displayName || store.storeName || store.name || store.businessName || store.merchantName || store.publicName, fallback);
}

async function loadStoresById(storeIds: string[]) {
  const uniqueStoreIds = Array.from(new Set(storeIds.filter(Boolean)));
  const db = adminFirestore();
  const storesById = new Map<string, RawRecord>();

  await Promise.all(uniqueStoreIds.map(async (storeId) => {
    try {
      const snapshot = await db.collection('stores').doc(storeId).get();
      if (snapshot.exists) storesById.set(storeId, snapshot.data() || {});
    } catch {
      // Keep order loading resilient even if one store lookup fails.
    }
  }));

  return storesById;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const limit = Number(url.searchParams.get('limit') || 50);

  try {
    const data = await listFirestoreDocuments('integrationOrders', limit);
    const orders = data.documents as RawRecord[];
    const storesById = await loadStoresById(orders.map(storeIdFromOrder));

    const enrichedOrders = orders.map((order) => {
      const storeId = storeIdFromOrder(order);
      const store = storesById.get(storeId);
      const storeName = storeNameFromRecord(store, text(order.storeName || order.merchantName));
      return {
        ...order,
        storeId: storeId || order.storeId,
        storeName,
        storeDisplayName: storeName || storeId || 'Unknown store',
      };
    });

    return NextResponse.json({
      ok: true,
      collection: 'integrationOrders',
      count: enrichedOrders.length,
      data: enrichedOrders,
      nextPageToken: data.nextPageToken,
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Unable to read integrationOrders from Firestore.' }, { status: 500 });
  }
}
