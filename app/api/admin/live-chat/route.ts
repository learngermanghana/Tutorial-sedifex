import { FieldValue } from 'firebase-admin/firestore';
import { NextResponse } from 'next/server';
import { adminFirestore, normalizeFirestoreDocument } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type LiveChatBody = {
  conversationId?: string;
  text?: string;
  authorName?: string;
  status?: string;
  sender?: string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  storeId?: string;
  storeName?: string;
  productId?: string;
  productName?: string;
  pageUrl?: string;
  source?: string;
};

function clean(value: unknown, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function rateLimitKey(req: Request) {
  const forwarded = req.headers.get('x-forwarded-for') || '';
  return forwarded.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown';
}

const recentRequests = new Map<string, { count: number; resetAt: number }>();
function tooManyRequests(key: string) {
  const now = Date.now();
  const current = recentRequests.get(key);
  if (!current || now > current.resetAt) {
    recentRequests.set(key, { count: 1, resetAt: now + 60_000 });
    return false;
  }
  if (current.count >= 8) return true;
  current.count += 1;
  return false;
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
    const body = (await req.json()) as LiveChatBody;
    const conversationId = clean(body.conversationId);
    const text = clean(body.text);
    const sender = clean(body.sender, conversationId ? 'admin' : 'customer');
    const isCustomerMessage = sender === 'customer' || clean(body.source) === 'sedifex_market';

    if (!text) return NextResponse.json({ ok: false, error: 'missing-message' }, { status: 400 });

    if (isCustomerMessage && tooManyRequests(rateLimitKey(req))) {
      return NextResponse.json({ ok: false, error: 'too-many-requests' }, { status: 429 });
    }

    const db = adminFirestore();
    const now = FieldValue.serverTimestamp();

    if (isCustomerMessage && !conversationId) {
      const customerName = clean(body.customerName, 'Website visitor');
      const customerPhone = clean(body.customerPhone);
      const customerEmail = clean(body.customerEmail).toLowerCase();
      const pageUrl = clean(body.pageUrl);
      const storeId = clean(body.storeId, 'sedifex-market');
      const storeName = clean(body.storeName, 'Sedifex Market');
      const ref = db.collection('marketLiveChats').doc();

      await ref.set({
        id: ref.id,
        status: 'open',
        source: 'sedifex_market',
        customerName,
        customerPhone,
        customerEmail,
        storeId,
        storeName,
        productId: clean(body.productId),
        productName: clean(body.productName),
        pageUrl,
        lastMessage: text,
        lastMessageSender: 'customer',
        lastMessageAt: now,
        adminUnread: 1,
        customerUnread: 0,
        createdAt: now,
        updatedAt: now,
      });

      await ref.collection('messages').add({
        sender: 'customer',
        authorName: customerName,
        text,
        createdAt: now,
        source: 'sedifex_market',
        pageUrl,
      });

      return NextResponse.json({ ok: true, conversationId: ref.id });
    }

    if (!conversationId) return NextResponse.json({ ok: false, error: 'missing-conversation-id' }, { status: 400 });

    const authorName = clean(body.authorName, isCustomerMessage ? 'Website visitor' : 'Sedifex Support');
    const nextStatus = clean(body.status, isCustomerMessage ? 'open' : 'replied');
    const ref = db.collection('marketLiveChats').doc(conversationId);

    await ref.collection('messages').add({
      sender: isCustomerMessage ? 'customer' : 'admin',
      authorName,
      text,
      createdAt: now,
      source: isCustomerMessage ? 'sedifex_market' : 'sedifex_admin',
    });

    await ref.set(
      {
        status: nextStatus,
        lastMessage: text,
        lastMessageSender: isCustomerMessage ? 'customer' : 'admin',
        lastMessageAt: now,
        adminUnread: isCustomerMessage ? FieldValue.increment(1) : 0,
        customerUnread: isCustomerMessage ? 0 : FieldValue.increment(1),
        updatedAt: now,
      },
      { merge: true },
    );

    return NextResponse.json({ ok: true, conversationId });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Unable to send message.' },
      { status: 500 },
    );
  }
}
