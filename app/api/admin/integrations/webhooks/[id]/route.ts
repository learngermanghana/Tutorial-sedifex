import { NextResponse } from 'next/server';
import { parseAdminContext, authorize } from '@/lib/auth';
import { patchWebhook } from '@/lib/integrations-store';

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = parseAdminContext(req.headers); authorize(ctx, ['super_admin', 'ops_admin', 'store_admin'], 'store.webhooks.write');
  const body = await req.json(); const { id } = await params;
  const hook = await patchWebhook(id, { targetUrl: body.targetUrl, events: body.events, status: body.status });
  if (!hook) return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });
  return NextResponse.json({ ok: true, data: hook });
}
