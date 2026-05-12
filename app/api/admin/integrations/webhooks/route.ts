import { NextResponse } from 'next/server';
import { parseAdminContext, authorize } from '@/lib/auth';
import { createWebhook, listClients, listWebhooks } from '@/lib/integrations-store';

export async function GET(req: Request) {
  const ctx = parseAdminContext(req.headers); authorize(ctx, ['super_admin', 'ops_admin', 'store_admin'], 'store.webhooks.read');
  const hooks = await listWebhooks();
  if (ctx.role !== 'store_admin') return NextResponse.json({ ok: true, data: hooks });
  const clients = await listClients();
  const ownIds = new Set(clients.filter(c => c.storeId === ctx.storeId).map(c => c.id));
  return NextResponse.json({ ok: true, data: hooks.filter(h => ownIds.has(h.clientId)) });
}

export async function POST(req: Request) {
  const ctx = parseAdminContext(req.headers); authorize(ctx, ['super_admin', 'ops_admin', 'store_admin'], 'store.webhooks.write');
  const body = await req.json();
  const webhook = await createWebhook({ clientId: body.clientId, targetUrl: body.targetUrl, events: body.events ?? [] });
  return NextResponse.json({ ok: true, data: { ...webhook.endpoint, secret: webhook.secret } });
}
