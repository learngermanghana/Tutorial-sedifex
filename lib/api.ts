import { NextResponse } from 'next/server';
import { authorize, parseAdminContext } from './auth';
import { writeAuditLog } from './audit';
import type { Role } from './types';

export async function handleAdmin(req: Request, roles: Role[], entitlement: string, data: unknown) {
  try { const ctx=parseAdminContext(req.headers); authorize(ctx,roles,entitlement);
    if(req.method!=='GET') await writeAuditLog(`admin.${entitlement}.${req.method.toLowerCase()}`,ctx.userId,{tenantId:ctx.tenantId,storeId:ctx.storeId});
    return NextResponse.json({ok:true,tenantId:ctx.tenantId,storeId:ctx.storeId,data});
  } catch (e) { return NextResponse.json({ok:false,error:(e as Error).message},{status:403}); }
}
