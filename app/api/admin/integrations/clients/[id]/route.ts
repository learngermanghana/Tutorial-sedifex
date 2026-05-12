import { NextResponse } from 'next/server';
import { parseAdminContext, authorize } from '@/lib/auth';
import { patchClient } from '@/lib/integrations-store';

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = parseAdminContext(req.headers); authorize(ctx, ['super_admin', 'ops_admin', 'store_admin'], 'store.clients.write');
  const body = await req.json(); const { id } = await params;
  const updated = await patchClient(id, { scopes: body.scopes, allowedOrigins: body.allowedOrigins });
  if (!updated) return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });
  if (ctx.role === 'store_admin' && updated.storeId !== ctx.storeId) return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
  return NextResponse.json({ ok: true, data: updated });
}
