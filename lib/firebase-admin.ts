import { createSign } from 'crypto';

type ServiceAccount = {
  projectId: string;
  clientEmail: string;
  privateKey: string;
  databaseId: string;
};

type FirestoreDocument = {
  name: string;
  fields?: Record<string, FirestoreValue>;
  createTime?: string;
  updateTime?: string;
};

type FirestoreValue = Record<string, unknown>;

type TokenResponse = {
  access_token?: string;
  expires_in?: number;
  token_type?: string;
  error?: string;
  error_description?: string;
};

type ListDocumentsResponse = {
  documents?: FirestoreDocument[];
  nextPageToken?: string;
};

let cachedToken: { token: string; expiresAt: number } | null = null;

function cleanPrivateKey(value: string) {
  return value.trim().replace(/^"|"$/g, '').replace(/\\n/g, '\n');
}

function getServiceAccount(): ServiceAccount {
  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

  if (json) {
    const parsed = JSON.parse(json) as {
      project_id?: string;
      client_email?: string;
      private_key?: string;
    };

    if (!parsed.project_id || !parsed.client_email || !parsed.private_key) {
      throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON is missing project_id, client_email, or private_key.');
    }

    return {
      projectId: parsed.project_id,
      clientEmail: parsed.client_email,
      privateKey: cleanPrivateKey(parsed.private_key),
      databaseId: process.env.FIREBASE_DATABASE_ID || '(default)',
    };
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error('Missing Firebase environment variables. Add FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY.');
  }

  return {
    projectId,
    clientEmail,
    privateKey: cleanPrivateKey(privateKey),
    databaseId: process.env.FIREBASE_DATABASE_ID || '(default)',
  };
}

export function getFirebaseEnvStatus() {
  const hasJson = Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
  const hasSplitEnv = Boolean(
    process.env.FIREBASE_PROJECT_ID &&
      process.env.FIREBASE_CLIENT_EMAIL &&
      process.env.FIREBASE_PRIVATE_KEY,
  );

  return {
    ready: hasJson || hasSplitEnv,
    projectId: process.env.FIREBASE_PROJECT_ID || null,
    databaseId: process.env.FIREBASE_DATABASE_ID || '(default)',
    hasServiceAccountJson: hasJson,
    hasProjectId: Boolean(process.env.FIREBASE_PROJECT_ID),
    hasClientEmail: Boolean(process.env.FIREBASE_CLIENT_EMAIL),
    hasPrivateKey: Boolean(process.env.FIREBASE_PRIVATE_KEY),
  };
}

function base64Url(input: string | Buffer) {
  return Buffer.from(input).toString('base64url');
}

function createJwt(account: ServiceAccount) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = base64Url(
    JSON.stringify({
      iss: account.clientEmail,
      scope: 'https://www.googleapis.com/auth/datastore',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    }),
  );
  const signingInput = `${header}.${payload}`;
  const signer = createSign('RSA-SHA256');
  signer.update(signingInput);
  signer.end();
  const signature = signer.sign(account.privateKey).toString('base64url');

  return `${signingInput}.${signature}`;
}

async function getAccessToken() {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.token;
  }

  const account = getServiceAccount();
  const assertion = createJwt(account);
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });

  const data = (await res.json().catch(() => ({}))) as TokenResponse;

  if (!res.ok || !data.access_token) {
    throw new Error(data.error_description || data.error || 'Unable to create Firebase access token.');
  }

  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in || 3600) * 1000,
  };

  return cachedToken.token;
}

function encodePath(path: string) {
  return path
    .split('/')
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

function firestoreBaseUrl() {
  const account = getServiceAccount();
  return `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(account.projectId)}/databases/${encodeURIComponent(account.databaseId)}/documents`;
}

async function firestoreRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await getAccessToken();
  const url = path.startsWith('https://') ? path : `${firestoreBaseUrl()}/${encodePath(path)}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      ...(init?.headers || {}),
    },
  });

  const text = await res.text();
  const data = text ? (JSON.parse(text) as T & { error?: { message?: string } }) : ({} as T);

  if (!res.ok) {
    const message = data && typeof data === 'object' && 'error' in data ? data.error?.message : text;
    throw new Error(message || `Firestore request failed with status ${res.status}.`);
  }

  return data as T;
}

function decodeFields(fields?: Record<string, FirestoreValue>) {
  return Object.fromEntries(
    Object.entries(fields || {}).map(([key, value]) => [key, decodeValue(value)]),
  );
}

function decodeValue(value: FirestoreValue): unknown {
  if ('stringValue' in value) return value.stringValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return value.doubleValue;
  if ('booleanValue' in value) return value.booleanValue;
  if ('timestampValue' in value) return value.timestampValue;
  if ('nullValue' in value) return null;
  if ('referenceValue' in value) return value.referenceValue;
  if ('bytesValue' in value) return value.bytesValue;
  if ('geoPointValue' in value) return value.geoPointValue;

  if ('arrayValue' in value) {
    const arrayValue = value.arrayValue as { values?: FirestoreValue[] };
    return (arrayValue.values || []).map((item) => decodeValue(item));
  }

  if ('mapValue' in value) {
    const mapValue = value.mapValue as { fields?: Record<string, FirestoreValue> };
    return decodeFields(mapValue.fields);
  }

  return value;
}

function encodeFields(data: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(data).map(([key, value]) => [key, encodeValue(value)]));
}

function encodeValue(value: unknown): FirestoreValue {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number') {
    return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  }
  if (value instanceof Date) return { timestampValue: value.toISOString() };
  if (Array.isArray(value)) return { arrayValue: { values: value.map((item) => encodeValue(item)) } };
  if (typeof value === 'object') return { mapValue: { fields: encodeFields(value as Record<string, unknown>) } };
  return { stringValue: String(value) };
}

export function decodeFirestoreDocument(document: FirestoreDocument) {
  const marker = '/documents/';
  const documentPath = document.name.includes(marker) ? document.name.split(marker)[1] : document.name;
  const id = documentPath.split('/').at(-1) || documentPath;

  return {
    ...decodeFields(document.fields),
    id,
    path: documentPath,
    createTime: document.createTime || null,
    updateTime: document.updateTime || null,
  };
}

export async function listFirestoreDocuments(collectionPath: string, limit = 25) {
  const safeLimit = Math.min(Math.max(limit, 1), 100);
  const url = `${firestoreBaseUrl()}/${encodePath(collectionPath)}?pageSize=${safeLimit}`;
  const data = await firestoreRequest<ListDocumentsResponse>(url);

  return {
    documents: (data.documents || []).map(decodeFirestoreDocument),
    nextPageToken: data.nextPageToken || null,
  };
}

export async function getFirestoreDocument(documentPath: string) {
  const document = await firestoreRequest<FirestoreDocument>(documentPath);
  return decodeFirestoreDocument(document);
}

export async function setFirestoreDocument(documentPath: string, data: Record<string, unknown>) {
  const document = await firestoreRequest<FirestoreDocument>(documentPath, {
    method: 'PATCH',
    body: JSON.stringify({ fields: encodeFields(data) }),
  });

  return decodeFirestoreDocument(document);
}
