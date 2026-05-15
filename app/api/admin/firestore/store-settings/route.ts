import { NextResponse } from 'next/server';
import { listFirestoreDocuments } from '@/lib/firebase-admin';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const limit = Number(url.searchParams.get('limit') || 25);

  try {
    const data = await listFirestoreDocuments('storeSettings', limit);

    return NextResponse.json({
      ok: true,
      collection: 'storeSettings',
      count: data.documents.length,
      data: data.documents,
      nextPageToken: data.nextPageToken,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Unable to read storeSettings from Firestore.',
      },
      { status: 500 },
    );
  }
}
