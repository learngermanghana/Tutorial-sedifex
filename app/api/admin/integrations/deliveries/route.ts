import { NextResponse } from 'next/server';
import { parseAdminContext, authorize } from '@/lib/auth';
import { listDeliveries } from '@/lib/integrations-store';

export async function GET(req: Request) {
  const ctx = parseAdminContext(req.headers); authorize(ctx, ['super_admin', 'ops_admin', 'store_admin', 'support', 'analyst'], 'store.deliveries.read');
  const { searchParams } = new URL(req.url);
  const data = await listDeliveries({ endpointId: searchParams.get('endpointId'), status: searchParams.get('status') as 'success' | 'failed' | null, eventType: searchParams.get('eventType'), from: searchParams.get('from'), to: searchParams.get('to') });
  return NextResponse.json({ ok: true, data });
}
