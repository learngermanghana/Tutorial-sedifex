import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

type FirebaseEnvStatus = {
  ready: boolean;
  projectId: string | null;
  databaseId: string;
  hasServiceAccountJson: boolean;
  hasProjectId: boolean;
  hasClientEmail: boolean;
  hasPrivateKey: boolean;
};

function cleanPrivateKey(value: string) {
  return value.trim().replace(/^"|"$/g, '').replace(/\\n/g, '\n');
}

function getCredentialConfig() {
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

  if (serviceAccountJson) {
    const serviceAccount = JSON.parse(serviceAccountJson) as {
      project_id?: string;
      client_email?: string;
      private_key?: string;
    };

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

export function getFirebaseEnvStatus(): FirebaseEnvStatus {
  const hasServiceAccountJson = Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
  const hasProjectId = Boolean(process.env.FIREBASE_PROJECT_ID);
  const hasClientEmail = Boolean(process.env.FIREBASE_CLIENT_EMAIL);
  const hasPrivateKey = Boolean(process.env.FIREBASE_PRIVATE_KEY);

  return {
    ready: hasServiceAccountJson || (hasProjectId && hasClientEmail && hasPrivateKey),
    projectId: process.env.FIREBASE_PROJECT_ID || null,
    databaseId: process.env.FIREBASE_DATABASE_ID || '(default)',
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
  });
}

function firestore() {
  const databaseId = process.env.FIREBASE_DATABASE_ID;
  return databaseId ? getFirestore(firebaseApp(), databaseId) : getFirestore(firebaseApp());
}

function normalizeDocument(snapshot: FirebaseFirestore.DocumentSnapshot) {
  const data = snapshot.data() || {};

  return {
    ...data,
    id: snapshot.id,
    path: snapshot.ref.path,
    createTime: snapshot.createTime?.toDate().toISOString() || null,
    updateTime: snapshot.updateTime?.toDate().toISOString() || null,
  };
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
