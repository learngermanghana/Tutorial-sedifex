import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

type FirebaseEnvStatus = {
  ready: boolean;
  projectId: string | null;
  databaseId: string;
  storageBucket: string | null;
  hasServiceAccountJson: boolean;
  hasProjectId: boolean;
  hasClientEmail: boolean;
  hasPrivateKey: boolean;
};

function cleanPrivateKey(value: string) {
  return value.trim().replace(/^"|"$/g, '').replace(/\\n/g, '\n');
}

function parseServiceAccountJson(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON is empty. Paste the full Firebase service account JSON or use FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY instead.');
  }

  try {
    return JSON.parse(trimmed) as {
      project_id?: string;
      client_email?: string;
      private_key?: string;
    };
  } catch {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON. Re-copy the full service account JSON from Firebase and make sure it was not cut off.');
  }
}

function getCredentialConfig() {
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

  if (serviceAccountJson) {
    const serviceAccount = parseServiceAccountJson(serviceAccountJson);

    if (!serviceAccount.project_id || !serviceAccount.client_email || !serviceAccount.private_key) {
      throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON is missing project_id, client_email, or private_key.');
    }

    return {
      projectId: serviceAccount.project_id,
      clientEmail: serviceAccount.client_email,
      privateKey: cleanPrivateKey(serviceAccount.private_key),
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
  };
}

function getConfiguredProjectId() {
  if (process.env.FIREBASE_PROJECT_ID) return process.env.FIREBASE_PROJECT_ID;
  if (!process.env.FIREBASE_SERVICE_ACCOUNT_JSON) return null;

  try {
    const serviceAccount = parseServiceAccountJson(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    return serviceAccount.project_id || null;
  } catch {
    return null;
  }
}

export function getFirebaseStorageBucketName() {
  const projectId = getConfiguredProjectId();
  return process.env.FIREBASE_STORAGE_BUCKET || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || (projectId ? `${projectId}.appspot.com` : null);
}

export function getFirebaseEnvStatus(): FirebaseEnvStatus {
  const hasServiceAccountJson = Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
  const hasProjectId = Boolean(process.env.FIREBASE_PROJECT_ID);
  const hasClientEmail = Boolean(process.env.FIREBASE_CLIENT_EMAIL);
  const hasPrivateKey = Boolean(process.env.FIREBASE_PRIVATE_KEY);

  return {
    ready: hasServiceAccountJson || (hasProjectId && hasClientEmail && hasPrivateKey),
    projectId: getConfiguredProjectId(),
    databaseId: process.env.FIREBASE_DATABASE_ID || '(default)',
    storageBucket: getFirebaseStorageBucketName(),
    hasServiceAccountJson,
    hasProjectId,
    hasClientEmail,
    hasPrivateKey,
  };
}

function firebaseApp() {
  if (getApps().length > 0) return getApps()[0];

  const credential = getCredentialConfig();

  return initializeApp({
    credential: cert(credential),
    projectId: credential.projectId,
    storageBucket: getFirebaseStorageBucketName() || undefined,
  });
}

export function adminFirestore() {
  const databaseId = process.env.FIREBASE_DATABASE_ID;
  return databaseId ? getFirestore(firebaseApp(), databaseId) : getFirestore(firebaseApp());
}

export function adminStorageBucket() {
  const bucketName = getFirebaseStorageBucketName();
  if (!bucketName) throw new Error('Missing Firebase storage bucket. Add FIREBASE_STORAGE_BUCKET or FIREBASE_PROJECT_ID.');
  return getStorage(firebaseApp()).bucket(bucketName);
}

function firestore() {
  return adminFirestore();
}

export function normalizeFirestoreDocument(snapshot: FirebaseFirestore.DocumentSnapshot) {
  const data = snapshot.data() || {};

  return {
    ...data,
    id: snapshot.id,
    path: snapshot.ref.path,
    createTime: snapshot.createTime?.toDate().toISOString() || null,
    updateTime: snapshot.updateTime?.toDate().toISOString() || null,
  };
}

function normalizeDocument(snapshot: FirebaseFirestore.DocumentSnapshot) {
  return normalizeFirestoreDocument(snapshot);
}

export async function listFirestoreDocuments(collectionPath: string, limit = 25) {
  const safeLimit = Math.min(Math.max(limit, 1), 100);
  const snapshot = await firestore().collection(collectionPath).limit(safeLimit).get();

  return {
    documents: snapshot.docs.map(normalizeDocument),
    nextPageToken: null,
  };
}

export async function getFirestoreDocument(documentPath: string) {
  const snapshot = await firestore().doc(documentPath).get();

  if (!snapshot.exists) {
    throw new Error(`Firestore document not found: ${documentPath}`);
  }

  return normalizeDocument(snapshot);
}

export async function setFirestoreDocument(documentPath: string, data: Record<string, unknown>) {
  const ref = firestore().doc(documentPath);
  await ref.set(data, { merge: true });
  const snapshot = await ref.get();
  return normalizeDocument(snapshot);
}