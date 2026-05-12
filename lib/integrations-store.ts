import { promises as fs } from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

export type PlatformType = 'sedifexmarket' | 'merchant_website' | 'internal';
export type ClientStatus = 'active' | 'revoked';
export type WebhookStatus = 'active' | 'disabled';
export type DeliveryStatus = 'success' | 'failed';

export type IntegrationScope = 'engagement:read' | 'engagement:write' | 'products:resolve';

export interface IntegrationClient {
  id: string;
  name: string;
  platformType: PlatformType;
  clientId: string;
  clientSecretHash: string;
  scopes: IntegrationScope[];
  allowedOrigins: string[];
  storeId: string | null;
  status: ClientStatus;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface WebhookEndpoint {
  id: string;
  clientId: string;
  targetUrl: string;
  secretHash: string;
  events: string[];
  status: WebhookStatus;
  createdAt: string;
  updatedAt: string;
}

export interface WebhookDelivery {
  id: string;
  endpointId: string;
  eventType: string;
  payloadRef: string;
  attempt: number;
  status: DeliveryStatus;
  responseCode: number;
  responseBodySnippet: string;
  nextRetryAt: string | null;
  createdAt: string;
}

export interface AuditLog {
  actorId: string;
  action: string;
  entityType: string;
  entityId: string;
  before: unknown;
  after: unknown;
  ip: string;
  createdAt: string;
}

type Db = { integration_clients: IntegrationClient[]; webhook_endpoints: WebhookEndpoint[]; webhook_deliveries: WebhookDelivery[]; audit_logs: AuditLog[] };

const DATA_FILE = process.env.INTEGRATIONS_DB_FILE ? path.resolve(process.cwd(), process.env.INTEGRATIONS_DB_FILE) : path.join(process.cwd(), 'data', 'integrations-db.json');
const initialDb: Db = { integration_clients: [], webhook_endpoints: [], webhook_deliveries: [], audit_logs: [] };

async function ensureFile() {
  await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
  try { await fs.access(DATA_FILE); } catch { await fs.writeFile(DATA_FILE, JSON.stringify(initialDb, null, 2)); }
}
async function readDb(): Promise<Db> { await ensureFile(); return JSON.parse(await fs.readFile(DATA_FILE, 'utf8')); }
async function writeDb(db: Db) { await fs.writeFile(DATA_FILE, JSON.stringify(db, null, 2)); }

const now = () => new Date().toISOString();
const uid = (prefix: string) => `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
const hash = (s: string) => crypto.createHash('sha256').update(s).digest('hex');
const secret = () => crypto.randomBytes(18).toString('base64url');

export async function createClient(input: { name: string; platformType: PlatformType; storeId: string | null; scopes: IntegrationScope[]; allowedOrigins: string[]; createdBy: string }) {
  const db = await readDb();
  const clientSecret = secret();
  const row: IntegrationClient = { id: uid('ic'), name: input.name, platformType: input.platformType, clientId: `sc_${uid('client')}`, clientSecretHash: hash(clientSecret), scopes: input.scopes, allowedOrigins: input.allowedOrigins, storeId: input.storeId, status: 'active', createdBy: input.createdBy, createdAt: now(), updatedAt: now() };
  db.integration_clients.push(row); await writeDb(db);
  return { client: row, clientSecret };
}
export async function listClients() { return (await readDb()).integration_clients; }
export async function patchClient(id: string, patch: Partial<Pick<IntegrationClient, 'scopes'|'allowedOrigins'>>) {
  const db = await readDb(); const row = db.integration_clients.find(c=>c.id===id); if(!row) return null;
  if (patch.scopes) row.scopes = patch.scopes; if (patch.allowedOrigins) row.allowedOrigins = patch.allowedOrigins; row.updatedAt = now(); await writeDb(db); return row;
}
export async function rotateClientSecret(id: string) { const db = await readDb(); const row = db.integration_clients.find(c=>c.id===id); if(!row) return null; const s=secret(); row.clientSecretHash=hash(s); row.updatedAt=now(); await writeDb(db); return {client:row, clientSecret:s}; }
export async function revokeClient(id: string) { const db=await readDb(); const row=db.integration_clients.find(c=>c.id===id); if(!row) return null; row.status='revoked'; row.updatedAt=now(); await writeDb(db); return row; }

export async function createWebhook(input:{clientId:string;targetUrl:string;events:string[]}){ const db=await readDb(); const s=secret(); const row:WebhookEndpoint={id:uid('wh'),clientId:input.clientId,targetUrl:input.targetUrl,events:input.events,secretHash:hash(s),status:'active',createdAt:now(),updatedAt:now()}; db.webhook_endpoints.push(row); await writeDb(db); return {endpoint:row, secret:s}; }
export async function listWebhooks(){ return (await readDb()).webhook_endpoints; }
export async function patchWebhook(id:string, patch:Partial<Pick<WebhookEndpoint,'events'|'status'|'targetUrl'>>){ const db=await readDb(); const row=db.webhook_endpoints.find(x=>x.id===id); if(!row) return null; Object.assign(row,patch); row.updatedAt=now(); await writeDb(db); return row; }
export async function rotateWebhookSecret(id:string){ const db=await readDb(); const row=db.webhook_endpoints.find(x=>x.id===id); if(!row) return null; const s=secret(); row.secretHash=hash(s); row.updatedAt=now(); await writeDb(db); return {endpoint:row, secret:s}; }

export async function listDeliveries(filters:{endpointId?:string|null;status?:DeliveryStatus|null;eventType?:string|null;from?:string|null;to?:string|null}){ const db=await readDb(); return db.webhook_deliveries.filter(d=>(!filters.endpointId||d.endpointId===filters.endpointId)&&(!filters.status||d.status===filters.status)&&(!filters.eventType||d.eventType===filters.eventType)&&(!filters.from||d.createdAt>=filters.from)&&(!filters.to||d.createdAt<=filters.to)); }
export async function replayDelivery(endpointId:string, deliveryId:string){ const db=await readDb(); const old=db.webhook_deliveries.find(d=>d.id===deliveryId&&d.endpointId===endpointId); if(!old) return null; const retry:WebhookDelivery={...old,id:uid('dlv'),attempt:old.attempt+1,status:'success',responseCode:200,responseBodySnippet:'Replay accepted',nextRetryAt:null,createdAt:now()}; db.webhook_deliveries.push(retry); await writeDb(db); return retry; }

export async function issueClientToken(clientId:string, clientSecret:string){ const db=await readDb(); const client=db.integration_clients.find(c=>c.clientId===clientId && c.status==='active'); if(!client) return null; if(client.clientSecretHash!==hash(clientSecret)) return null; return { access_token: crypto.randomBytes(24).toString('hex'), token_type:'Bearer', expires_in:3600, scope:client.scopes.join(' ') }; }
