import { FieldValue } from 'firebase-admin/firestore';
import { NextResponse } from 'next/server';
import { adminFirestore, normalizeFirestoreDocument } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type ReplyBody = {
  conversationId?: string;
  text?: string;
  authorName?: string;
  status?: string;
};

function clean(value: unknown, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const status = url.searchParams.get('status') || '';
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit') || 50), 1), 100);

  try {
    let query: FirebaseFirestore.Query = adminFirestore()
      .collection('marketLiveChats')
      .orderBy('lastMessageAt', 'desc')
      .limit(limit);

    if (status && status !== 'all') {
      query = adminFirestore()
        .collection('marketLiveChats')
        .where('status', '==', status)
        .orderBy('lastMessageAt', 'desc')
        .limit(limit);
    }

    const snapshot = await query.get();
    const conversations = await Promise.all(
      snapshot.docs.map(async (doc) => {
        const messagesSnap = await doc.ref.collection('messages').orderBy('createdAt', 'asc').limit(50).get();
        return {
          ...normalizeFirestoreDocument(doc),
          messages: messagesSnap.docs.map(normalizeFirestoreDocument),
        };
      }),
    );

    return NextResponse.json({ ok: true, conversations });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Unable to load live chat.' },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as ReplyBody;
    const conversationId = clean(body.conversationId);
    const text = clean(body.text);
    const authorName = clean(body.authorName, 'Sedifex Support');
    const nextStatus = clean(body.status, 'replied');

    if (!conversationId) return NextResponse.json({ ok: false, error: 'missing-conversation-id' }, { status: 400 });
    if (!text) return NextResponse.json({ ok: false, error: 'missing-message' }, { status: 400 });

    const db = adminFirestore();
    const ref = db.collection('marketLiveChats').doc(conversationId);
    const now = FieldValue.serverTimestamp();

    await ref.collection('messages').add({
      sender: 'admin',
      authorName,
      text,
      createdAt: now,
      source: 'sedifex_admin',
    });

    await ref.set(
      {
        status: nextStatus,
        lastMessage: text,
        lastMessageSender: 'admin',
        lastMessageAt: now,
        adminUnread: 0,
        customerUnread: FieldValue.increment(1),
        updatedAt: now,
      },
      { merge: true },
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Unable to send reply.' },
      { status: 500 },
    );
  }
}
