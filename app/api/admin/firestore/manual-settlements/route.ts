import { NextResponse } from 'next/server';
import { listFirestoreDocuments } from '@/lib/firebase-admin';

type RawRecord = Record<string, unknown>;

function text(value: unknown, fallback = '') {
  if (typeof value === 'string') return value.trim() || fallback;
  if (typeof value === 'number') return String(value);
  return fallback;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const limit = Number(url.searchParams.get('limit') || 250);

  try {
    const data = await listFirestoreDocuments('manualSettlements', limit);
    const settlements = (data.documents as RawRecord[]).map((settlement) => {
      const settlementId = text(settlement.id || settlement.settlementId || settlement.orderId);
      const orderId = text(settlement.orderId || settlement.id);
      return {
        ...settlement,
        id: settlementId,
        settlementId,
        orderId,
        storeDisplayName: text(settlement.storeName || settlement.merchantName || settlement.storeId, 'Unknown store'),
        payoutStatus: text(settlement.payoutStatus || settlement.status, 'pending').toLowerCase(),
      };
    });

    return NextResponse.json({
      ok: true,
      collection: 'manualSettlements',
      count: settlements.length,
      data: settlements,
      nextPageToken: data.nextPageToken,
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Unable to read manualSettlements from Firestore.' }, { status: 500 });
  }
}
