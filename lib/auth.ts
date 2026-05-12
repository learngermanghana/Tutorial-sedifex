import { z } from 'zod';
import type { AdminContext, Role } from './types';

const headerSchema = z.object({
  'x-tenant-id': z.string().min(1),
  'x-store-id': z.string().min(1),
  'x-role': z.enum(['super_admin','ops_admin','store_admin','support','analyst','moderator']),
  'x-user-id': z.string().min(1),
  'x-entitlements': z.string().default('')
});

export function parseAdminContext(headers: Headers): AdminContext {
  const raw = Object.fromEntries(['x-tenant-id','x-store-id','x-role','x-user-id','x-entitlements'].map(k=>[k,headers.get(k) ?? '']));
  const parsed = headerSchema.parse(raw);
  return {tenantId:parsed['x-tenant-id'],storeId:parsed['x-store-id'],role:parsed['x-role'] as Role,userId:parsed['x-user-id'],entitlements:parsed['x-entitlements'].split(',').filter(Boolean)};
}

export function authorize(ctx: AdminContext, roles: Role[], entitlement: string) {
  if (!roles.includes(ctx.role)) throw new Error('Forbidden role');
  if (!ctx.entitlements.includes(entitlement)) throw new Error('Missing entitlement');
}
