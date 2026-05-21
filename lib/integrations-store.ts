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

type Db = {
  integration_clients: IntegrationClient[];
  webhook_endpoints: WebhookEndpoint[];
  webhook_deliveries: WebhookDelivery[];
  audit_logs: AuditLog[];
};

const DATA_FILE = process.env.INTEGRATIONS_DB_FILE
  ? path.resolve(process.cwd(), process.env.INTEGRATIONS_DB_FILE)
  : path.join(process.cwd(), 'data', 'integrations-db.json');

const initialDb: Db = {
  integration_clients: [],
  webhook_endpoints: [],
  webhook_deliveries: [],
  audit_logs: [],
};

function normalizeDb(value: unknown): Db {
  const data = value && typeof value === 'object' && !Array.isArray(value) ? value as Partial<Db> : {};
  return {
    integration_clients: Array.isArray(data.integration_clients) ? data.integration_clients : [],
    webhook_endpoints: Array.isArray(data.webhook_endpoints) ? data.webhook_endpoints : [],
    webhook_deliveries: Array.isArray(data.webhook_deliveries) ? data.webhook_deliveries : [],
    audit_logs: Array.isArray(data.audit_logs) ? data.audit_logs : [],
  };
}

function warnIntegrationStore(message: string, error?: unknown) {
  const detail = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  console.warn(`[integrations-store] ${message}${detail ? `: ${detail}` : ''}`);
}

async function ensureFile() {
  try {
    await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
    await fs.access(DATA_FILE).catch(async () => {
      await fs.writeFile(DATA_FILE, JSON.stringify(initialDb, null, 2));
    });
  } catch (error) {
    // Vercel/serverless file systems may be read-only. The admin deliveries page
    // should still render instead of crashing with a Server Components digest.
    warnIntegrationStore('Local integration DB file is unavailable; using empty in-memory snapshot', error);
  }
}

async function readDb(): Promise<Db> {
  try {
    await ensureFile();
    const raw = await fs.readFile(DATA_FILE, 'utf8');
    return normalizeDb(JSON.parse(raw));
  } catch (error) {
    warnIntegrationStore('Unable to read integration DB file; returning empty snapshot', error);
    return normalizeDb(initialDb);
  }
}

async function writeDb(db: Db) {
  try {
    await ensureFile();
    await fs.writeFile(DATA_FILE, JSON.stringify(normalizeDb(db), null, 2));
  } catch (error) {
    // Do not crash admin pages/actions when local persistence is unavailable.
    warnIntegrationStore('Unable to write integration DB file', error);
  }
}

const now = () => new Date().toISOString();
const uid = (prefix: string) => `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
const hash = (s: string) => crypto.createHash('sha256').update(s).digest('hex');
const secret = () => crypto.randomBytes(18).toString('base64url');

export async function createClient(input: { name: string; platformType: PlatformType; storeId: string | null; scopes: IntegrationScope[]; allowedOrigins: string[]; createdBy: string }) {
  const db = await readDb();
  const clientSecret = secret();
  const row: IntegrationClient = {
    id: uid('ic'),
    name: input.name,
    platformType: input.platformType,
    clientId: `sc_${uid('client')}`,
    clientSecretHash: hash(clientSecret),
    scopes: input.scopes,
    allowedOrigins: input.allowedOrigins,
    storeId: input.storeId,
    status: 'active',
    createdBy: input.createdBy,
    createdAt: now(),
    updatedAt: now(),
  };
  db.integration_clients.push(row);
  await writeDb(db);
  return { client: row, clientSecret };
}

export async function listClients() {
  return (await readDb()).integration_clients;
}

export async function patchClient(id: string, patch: Partial<Pick<IntegrationClient, 'scopes' | 'allowedOrigins'>>) {
  const db = await readDb();
  const row = db.integration_clients.find((client) => client.id === id);
  if (!row) return null;
  if (patch.scopes) row.scopes = patch.scopes;
  if (patch.allowedOrigins) row.allowedOrigins = patch.allowedOrigins;
  row.updatedAt = now();
  await writeDb(db);
  return row;
}

export async function rotateClientSecret(id: string) {
  const db = await readDb();
  const row = db.integration_clients.find((client) => client.id === id);
  if (!row) return null;
  const clientSecret = secret();
  row.clientSecretHash = hash(clientSecret);
  row.updatedAt = now();
  await writeDb(db);
  return { client: row, clientSecret };
}

export async function revokeClient(id: string) {
  const db = await readDb();
  const row = db.integration_clients.find((client) => client.id === id);
  if (!row) return null;
  row.status = 'revoked';
  row.updatedAt = now();
  await writeDb(db);
  return row;
}

export async function createWebhook(input: { clientId: string; targetUrl: string; events: string[] }) {
  const db = await readDb();
  const webhookSecret = secret();
  const row: WebhookEndpoint = {
    id: uid('wh'),
    clientId: input.clientId,
    targetUrl: input.targetUrl,
    events: input.events,
    secretHash: hash(webhookSecret),
    status: 'active',
    createdAt: now(),
    updatedAt: now(),
  };
  db.webhook_endpoints.push(row);
  await writeDb(db);
  return { endpoint: row, secret: webhookSecret };
}

export async function listWebhooks() {
  return (await readDb()).webhook_endpoints;
}

export async function patchWebhook(id: string, patch: Partial<Pick<WebhookEndpoint, 'events' | 'status' | 'targetUrl'>>) {
  const db = await readDb();
  const row = db.webhook_endpoints.find((endpoint) => endpoint.id === id);
  if (!row) return null;
  Object.assign(row, patch);
  row.updatedAt = now();
  await writeDb(db);
  return row;
}

export async function rotateWebhookSecret(id: string) {
  const db = await readDb();
  const row = db.webhook_endpoints.find((endpoint) => endpoint.id === id);
  if (!row) return null;
  const webhookSecret = secret();
  row.secretHash = hash(webhookSecret);
  row.updatedAt = now();
  await writeDb(db);
  return { endpoint: row, secret: webhookSecret };
}

export async function listDeliveries(filters: { endpointId?: string | null; status?: DeliveryStatus | null; eventType?: string | null; from?: string | null; to?: string | null }) {
  const db = await readDb();
  return db.webhook_deliveries.filter((delivery) =>
    (!filters.endpointId || delivery.endpointId === filters.endpointId)
    && (!filters.status || delivery.status === filters.status)
    && (!filters.eventType || delivery.eventType === filters.eventType)
    && (!filters.from || delivery.createdAt >= filters.from)
    && (!filters.to || delivery.createdAt <= filters.to),
  );
}

export async function replayDelivery(endpointId: string, deliveryId: string) {
  const db = await readDb();
  const oldDelivery = db.webhook_deliveries.find((delivery) => delivery.id === deliveryId && delivery.endpointId === endpointId);
  if (!oldDelivery) return null;
  const retry: WebhookDelivery = {
    ...oldDelivery,
    id: uid('dlv'),
    attempt: oldDelivery.attempt + 1,
    status: 'success',
    responseCode: 200,
    responseBodySnippet: 'Replay accepted',
    nextRetryAt: null,
    createdAt: now(),
  };
  db.webhook_deliveries.push(retry);
  await writeDb(db);
  return retry;
}

export async function issueClientToken(clientId: string, clientSecret: string) {
  const db = await readDb();
  const client = db.integration_clients.find((row) => row.clientId === clientId && row.status === 'active');
  if (!client) return null;
  if (client.clientSecretHash !== hash(clientSecret)) return null;
  return {
    access_token: crypto.randomBytes(24).toString('hex'),
    token_type: 'Bearer',
    expires_in: 3600,
    scope: client.scopes.join(' '),
  };
}
