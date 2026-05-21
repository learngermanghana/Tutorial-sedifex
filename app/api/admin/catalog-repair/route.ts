import { NextResponse } from 'next/server';
import { repairPublicCatalogForStore } from '../../../../lib/public-catalog-repair';

function isAllowedRole(role?: string) {
  return role === 'super_admin' || role === 'ops_admin' || role === 'support';
}

export async function POST(req: Request) {
  const role = req.headers.get('cookie')?.split(';').map((part) => part.trim()).find((part) => part.startsWith('sedifex_admin_role='))?.split('=')[1];

  if (!isAllowedRole(role)) {
    return NextResponse.json({ ok: false, error: 'You do not have permission to repair public catalogs.' }, { status: 403 });
  }

  const body = await req.json().catch(() => null) as { storeId?: string } | null;
  const storeId = body?.storeId?.trim();

  if (!storeId) {
    return NextResponse.json({ ok: false, error: 'storeId is required.' }, { status: 400 });
  }

  try {
    const result = await repairPublicCatalogForStore(storeId);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Unable to repair catalog.' },
      { status: 500 },
    );
  }
}
