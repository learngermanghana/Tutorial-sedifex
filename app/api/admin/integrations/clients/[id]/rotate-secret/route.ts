import { NextResponse } from 'next/server';
import { parseAdminContext, authorize } from '@/lib/auth';
import { rotateClientSecret } from '@/lib/integrations-store';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = parseAdminContext(req.headers); authorize(ctx, ['super_admin', 'ops_admin', 'store_admin'], 'store.clients.write');
  const { id } = await params; const rotated = await rotateClientSecret(id);
  if (!rotated) return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });
  if (ctx.role === 'store_admin' && rotated.client.storeId !== ctx.storeId) return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
  return NextResponse.json({ ok: true, data: { id: rotated.client.id, clientId: rotated.client.clientId, clientSecret: rotated.clientSecret } });
}
