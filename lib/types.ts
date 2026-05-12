export type Role = 'super_admin' | 'ops_admin' | 'store_admin' | 'support' | 'analyst' | 'moderator';
export type Scope = 'platform' | 'store';

export interface AdminContext { tenantId: string; storeId: string; role: Role; entitlements: string[]; userId: string; }
