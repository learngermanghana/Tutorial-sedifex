import { NextResponse } from 'next/server';
import { parseAdminContext, authorize } from '@/lib/auth';
import { replayDelivery } from '@/lib/integrations-store';

export async function POST(req: Request, { params }: { params: Promise<{ id: string; deliveryId: string }> }) {
  const ctx = parseAdminContext(req.headers); authorize(ctx, ['super_admin', 'ops_admin', 'store_admin'], 'store.webhooks.write');
  const { id, deliveryId } = await params;
  const replayed = await replayDelivery(id, deliveryId);
  if (!replayed) return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });
  return NextResponse.json({ ok: true, data: replayed });
}
