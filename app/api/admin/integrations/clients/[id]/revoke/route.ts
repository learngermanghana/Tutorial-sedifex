import { NextResponse } from 'next/server';
import { parseAdminContext, authorize } from '@/lib/auth';
import { revokeClient } from '@/lib/integrations-store';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = parseAdminContext(req.headers); authorize(ctx, ['super_admin', 'ops_admin', 'store_admin'], 'store.clients.write');
  const { id } = await params; const revoked = await revokeClient(id);
  if (!revoked) return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });
  if (ctx.role === 'store_admin' && revoked.storeId !== ctx.storeId) return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
  return NextResponse.json({ ok: true, data: revoked });
}
