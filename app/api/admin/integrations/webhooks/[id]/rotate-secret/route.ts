import { NextResponse } from 'next/server';
import { parseAdminContext, authorize } from '@/lib/auth';
import { rotateWebhookSecret } from '@/lib/integrations-store';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = parseAdminContext(req.headers); authorize(ctx, ['super_admin', 'ops_admin', 'store_admin'], 'store.webhooks.write');
  const { id } = await params;
  const rotated = await rotateWebhookSecret(id);
  if (!rotated) return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });
  return NextResponse.json({ ok: true, data: { id: rotated.endpoint.id, secret: rotated.secret } });
}
