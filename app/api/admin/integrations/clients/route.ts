import { NextResponse } from 'next/server';
import { parseAdminContext, authorize } from '@/lib/auth';
import { createClient, listClients } from '@/lib/integrations-store';

export async function GET(req: Request) {
  const ctx = parseAdminContext(req.headers); authorize(ctx, ['super_admin', 'ops_admin', 'store_admin'], 'store.clients.read');
  const clients = await listClients();
  return NextResponse.json({ ok: true, data: clients.filter(c => ctx.role === 'store_admin' ? c.storeId === ctx.storeId : true) });
}

export async function POST(req: Request) {
  const ctx = parseAdminContext(req.headers); authorize(ctx, ['super_admin', 'ops_admin', 'store_admin'], 'store.clients.write');
  const body = await req.json();
  if (ctx.role === 'store_admin' && !body.storeId) return NextResponse.json({ ok: false, error: 'Store admin cannot create platform-level client' }, { status: 403 });
  const created = await createClient({ name: body.name, platformType: body.platformType, storeId: body.storeId ?? null, scopes: body.scopes ?? [], allowedOrigins: body.allowedOrigins ?? [], createdBy: ctx.userId });
  return NextResponse.json({ ok: true, data: { ...created.client, clientSecret: created.clientSecret } });
}
