import { adminFirestore } from './firebase-admin';

export type MarketingContact = {
  id: string;
  name: string;
  email: string;
  phone: string;
  source: string;
  storeId: string;
  storeName: string;
  role: string;
  tags: string[];
  optedOut: boolean;
  updatedAt: string | null;
};

export type MarketingSenderStore = {
  id: string;
  name: string;
  email: string;
  fromName: string;
  hasBulkEmailIntegration: boolean;
  city?: string;
};

type FirestoreRecord = Record<string, unknown> & { id?: string };

const SOURCE_COLLECTIONS = [
  { collection: 'stores', source: 'stores', role: 'store_owner', limit: 350 },
  { collection: 'customers', source: 'customers', role: 'customer', limit: 500 },
  { collection: 'students', source: 'students', role: 'student', limit: 500 },
  { collection: 'donors', source: 'donors', role: 'donor', limit: 500 },
  { collection: 'volunteers', source: 'volunteers', role: 'volunteer', limit: 500 },
  { collection: 'volunteerApplications', source: 'volunteer_applications', role: 'volunteer', limit: 500 },
  { collection: 'supportRequests', source: 'support_requests', role: 'support_request', limit: 500 },
  { collection: 'bookings', source: 'bookings', role: 'booking_customer', limit: 500 },
  { collection: 'studentRegistrations', source: 'student_registrations', role: 'student', limit: 500 },
  { collection: 'integrationOrders', source: 'orders', role: 'buyer', limit: 500 },
] as const;

function text(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number') return String(value);
  return '';
}

function textFrom(record: FirestoreRecord, fields: string[]): string {
  for (const field of fields) {
    const value = text(record[field]);
    if (value) return value;
  }
  return '';
}

function boolFrom(record: FirestoreRecord, fields: string[]) {
  return fields.some((field) => record[field] === true || text(record[field]).toLowerCase() === 'true');
}

function timestampText(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && typeof (value as { toDate?: unknown }).toDate === 'function') {
    try {
      return (value as { toDate: () => Date }).toDate().toISOString();
    } catch {
      return null;
    }
  }
  if (value instanceof Date) return value.toISOString();
  return null;
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function safeId(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 120) || 'contact';
}

function arrayTags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => text(item)).filter(Boolean).slice(0, 12);
}

function tagsForRecord(record: FirestoreRecord, source: string, role: string) {
  return Array.from(new Set([
    source,
    role,
    text(record.level),
    text(record.status),
    text(record.category),
    text(record.programme),
    text(record.courseName),
    text(record.source),
    ...arrayTags(record.tags),
  ].map((tag) => tag.trim().toLowerCase()).filter(Boolean)));
}

function contactFromRecord(record: FirestoreRecord, source: string, role: string): MarketingContact | null {
  const email = normalizeEmail(textFrom(record, [
    'email',
    'customerEmail',
    'studentEmail',
    'donorEmail',
    'volunteerEmail',
    'ownerEmail',
    'publicEmail',
    'adminEmail',
    'supportEmail',
    'firstSignupEmail',
  ]));

  if (!isValidEmail(email)) return null;

  const name = textFrom(record, [
    'name',
    'fullName',
    'customerName',
    'studentName',
    'donorName',
    'volunteerName',
    'displayName',
    'businessName',
    'storeName',
    'ownerName',
  ]) || email.split('@')[0];

  const storeId = textFrom(record, ['storeId', 'merchantId', 'businessId', 'ownerStoreId', 'id']);
  const storeName = textFrom(record, ['storeName', 'businessName', 'displayName']);
  const phone = textFrom(record, ['phone', 'phoneNumber', 'customerPhone', 'studentPhone', 'donorPhone', 'volunteerPhone', 'whatsapp', 'whatsappNumber']);
  const optedOut = boolFrom(record, ['marketingOptOut', 'emailOptOut', 'newsletterOptOut', 'unsubscribe', 'unsubscribed']);

  return {
    id: `${source}:${safeId(email)}`,
    name,
    email,
    phone,
    source,
    storeId,
    storeName,
    role,
    tags: tagsForRecord(record, source, role),
    optedOut,
    updatedAt: timestampText(record.updatedAt) ?? timestampText(record.updateTime) ?? timestampText(record.createdAt) ?? timestampText(record.createTime),
  };
}

function mergeContacts(contacts: MarketingContact[]): MarketingContact[] {
  const byEmail = new Map<string, MarketingContact>();
  for (const contact of contacts) {
    const key = normalizeEmail(contact.email);
    const existing = byEmail.get(key);
    if (!existing) {
      byEmail.set(key, contact);
      continue;
    }

    byEmail.set(key, {
      ...existing,
      name: existing.name || contact.name,
      phone: existing.phone || contact.phone,
      storeId: existing.storeId || contact.storeId,
      storeName: existing.storeName || contact.storeName,
      source: Array.from(new Set([...existing.source.split(','), contact.source])).join(','),
      role: Array.from(new Set([...existing.role.split(','), contact.role])).join(','),
      tags: Array.from(new Set([...existing.tags, ...contact.tags])),
      optedOut: existing.optedOut || contact.optedOut,
      updatedAt: existing.updatedAt || contact.updatedAt,
    });
  }
  return Array.from(byEmail.values()).sort((a, b) => a.name.localeCompare(b.name));
}

function integrationRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export async function listMarketingContacts(): Promise<MarketingContact[]> {
  const db = adminFirestore();
  const contacts: MarketingContact[] = [];

  await Promise.all(SOURCE_COLLECTIONS.map(async (sourceConfig) => {
    try {
      const snapshot = await db.collection(sourceConfig.collection).limit(sourceConfig.limit).get();
      for (const doc of snapshot.docs) {
        const contact = contactFromRecord({ id: doc.id, ...doc.data() }, sourceConfig.source, sourceConfig.role);
        if (contact) contacts.push(contact);
      }
    } catch (error) {
      console.warn(`[marketing-contacts] Could not read ${sourceConfig.collection}`, error instanceof Error ? error.message : error);
    }
  }));

  return mergeContacts(contacts).slice(0, 3000);
}

export async function listMarketingSenderStores(): Promise<MarketingSenderStore[]> {
  const db = adminFirestore();
  const snapshot = await db.collection('stores').limit(500).get();

  return snapshot.docs.map((doc) => {
    const data = doc.data() as FirestoreRecord;
    const bulkEmailIntegration = integrationRecord(data.bulkEmailIntegration);
    const name = textFrom({ ...data, id: doc.id }, ['displayName', 'name', 'businessName', 'storeName']) || doc.id;
    const webAppUrl = text(bulkEmailIntegration.webAppUrl);
    const sharedToken = text(bulkEmailIntegration.sharedToken);

    return {
      id: doc.id,
      name,
      email: textFrom(data, ['email', 'ownerEmail', 'publicEmail', 'supportEmail']),
      fromName: text(bulkEmailIntegration.fromName) || name,
      hasBulkEmailIntegration: Boolean(webAppUrl && sharedToken),
      city: textFrom(data, ['city', 'town', 'storeCity']) || undefined,
    };
  }).sort((a, b) => Number(b.hasBulkEmailIntegration) - Number(a.hasBulkEmailIntegration) || a.name.localeCompare(b.name));
}

export async function getBulkEmailIntegrationForStore(storeId: string) {
  const snapshot = await adminFirestore().collection('stores').doc(storeId).get();
  if (!snapshot.exists) throw new Error(`Store not found: ${storeId}`);
  const data = snapshot.data() as FirestoreRecord;
  const bulkEmailIntegration = integrationRecord(data.bulkEmailIntegration);
  const webAppUrl = text(bulkEmailIntegration.webAppUrl);
  const sharedToken = text(bulkEmailIntegration.sharedToken);
  const fromName = text(bulkEmailIntegration.fromName) || textFrom(data, ['displayName', 'name', 'businessName', 'storeName']) || 'Sedifex';

  if (!webAppUrl || !sharedToken) {
    throw new Error('This store does not have bulkEmailIntegration.webAppUrl and bulkEmailIntegration.sharedToken configured.');
  }

  return { webAppUrl, sharedToken, fromName };
}
