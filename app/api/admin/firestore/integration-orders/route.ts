import { NextResponse } from 'next/server';
import { listFirestoreDocuments } from '@/lib/firebase-admin';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const limit = Number(url.searchParams.get('limit') || 50);

  try {
    const data = await listFirestoreDocuments('integrationOrders', limit);

    return NextResponse.json({ ok: true, collection: 'integrationOrders', count: data.documents.length, data: data.documents, nextPageToken: data.nextPageToken });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Unable to read integrationOrders from Firestore.' }, { status: 500 });
  }
}
