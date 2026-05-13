export type AdminRole = 'super_admin' | 'ops_admin' | 'store_admin' | 'support' | 'analyst' | 'moderator';
export type StoreStatus = 'active' | 'provisioning' | 'at_risk' | 'suspended';

export const roleLabels: Record<AdminRole, string> = {
  super_admin: 'Super Admin',
  ops_admin: 'Ops Admin',
  store_admin: 'Store Admin',
  support: 'Support',
  analyst: 'Analyst',
  moderator: 'Moderator',
};

export const stores = [
  { id: 'st_gha_accra_01', name: 'Makola Market Hub', plan: 'Enterprise', status: 'active' as StoreStatus, country: 'Ghana', city: 'Accra', owner: 'Ama Boateng', mrr: 12840, orders30d: 4451 },
  { id: 'st_nga_lagos_02', name: 'Lagos Luxe Fashion', plan: 'Growth', status: 'provisioning' as StoreStatus, country: 'Nigeria', city: 'Lagos', owner: 'Tunde Akin', mrr: 6210, orders30d: 1740 },
  { id: 'st_ken_nairobi_03', name: 'Nairobi Fresh Foods', plan: 'Starter', status: 'at_risk' as StoreStatus, country: 'Kenya', city: 'Nairobi', owner: 'Wanjiku Njeri', mrr: 1910, orders30d: 512 },
  { id: 'st_gha_kumasi_04', name: 'Kumasi Home Essentials', plan: 'Growth', status: 'active' as StoreStatus, country: 'Ghana', city: 'Kumasi', owner: 'Kwesi Manu', mrr: 5050, orders30d: 1399 },
];

export const adminUsers = [
  { id: 'usr_01', name: 'Nana Owusu', email: 'nana.owusu@sedifex.com', role: 'super_admin' as AdminRole, status: 'active' },
  { id: 'usr_02', name: 'Efua Asante', email: 'efua.asante@sedifex.com', role: 'ops_admin' as AdminRole, status: 'active' },
  { id: 'usr_03', name: 'Kojo Mensimah', email: 'kojo.mensimah@sedifex.com', role: 'support' as AdminRole, status: 'pending_invite' },
  { id: 'usr_04', name: 'Aisha Bello', email: 'aisha.bello@sedifex.com', role: 'analyst' as AdminRole, status: 'suspended' },
];

export const apiClients = [
  { id: 'cli_live_ops', name: 'Sedifex Ops Automation', scope: 'platform', status: 'active', lastRotatedAt: '2026-04-01', requests24h: 12440 },
  { id: 'cli_store_makola', name: 'Makola ERP Connector', scope: 'store', status: 'active', lastRotatedAt: '2026-02-12', requests24h: 1842 },
];

export const webhookEndpoints = [
  { id: 'wh_01', store: 'Makola Market Hub', url: 'https://ops.makola-hub.com/webhooks/sedifex', events: ['order.created', 'inventory.updated'], status: 'healthy', secretAgeDays: 47 },
  { id: 'wh_02', store: 'Nairobi Fresh Foods', url: 'https://hooks.nairobi-fresh.africa/sedifex/events', events: ['delivery.failed'], status: 'degraded', secretAgeDays: 122 },
];

export const deliveries = [
  { id: 'dlv_7721', endpoint: 'wh_01', event: 'order.created', store: 'Makola Market Hub', status: 'delivered', attempts: 1, at: '2026-05-13T08:15:20Z' },
  { id: 'dlv_7720', endpoint: 'wh_02', event: 'delivery.failed', store: 'Nairobi Fresh Foods', status: 'failed', attempts: 3, at: '2026-05-13T07:59:03Z' },
  { id: 'dlv_7719', endpoint: 'wh_02', event: 'inventory.updated', store: 'Nairobi Fresh Foods', status: 'retrying', attempts: 2, at: '2026-05-13T07:40:11Z' },
];

export const auditLogs = [
  { id: 'aud_2001', actor: 'efua.asante@sedifex.com', action: 'store.plan_updated', resource: 'store/st_gha_accra_01', time: '2026-05-13T06:40:00Z', details: 'Plan changed from Growth to Enterprise' },
  { id: 'aud_2002', actor: 'system:webhook-worker', action: 'webhook.delivery_retried', resource: 'delivery/dlv_7720', time: '2026-05-13T08:01:14Z', details: 'Retry attempt 3 queued after HTTP 503' },
  { id: 'aud_2003', actor: 'nana.owusu@sedifex.com', action: 'admin.invited', resource: 'user/usr_05', time: '2026-05-12T19:21:54Z', details: 'Invited ama.admin@sedifex.com as moderator' },
];
