import { getApps } from 'firebase-admin/app';
import { getStorage } from 'firebase-admin/storage';
import { adminStorageBucket, getFirebaseEnvStatus } from './firebase-admin';

function cleanBucketName(value: string) {
  return value.trim().replace(/^gs:\/\//i, '').replace(/\/+$/, '');
}

function unique(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => typeof value === 'string' && value.trim().length > 0).map(cleanBucketName)));
}

export function firebaseStorageBucketCandidates() {
  const status = getFirebaseEnvStatus();
  const projectId = status.projectId;
  return unique([
    process.env.FIREBASE_STORAGE_BUCKET,
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    status.storageBucket,
    projectId ? `${projectId}.firebasestorage.app` : null,
    projectId ? `${projectId}.appspot.com` : null,
  ]);
}

export async function resolveExistingFirebaseStorageBucket() {
  const candidates = firebaseStorageBucketCandidates();
  if (candidates.length === 0) {
    throw new Error('Missing Firebase Storage bucket. Add FIREBASE_STORAGE_BUCKET in Vercel.');
  }

  // Ensure the Firebase Admin app is initialized by the existing helper.
  adminStorageBucket();
  const app = getApps()[0];
  const storage = getStorage(app);
  const failures: string[] = [];

  for (const bucketName of candidates) {
    try {
      const bucket = storage.bucket(bucketName);
      const [exists] = await bucket.exists();
      if (exists) {
        return { bucket, bucketName, candidates };
      }
      failures.push(`${bucketName}: not found`);
    } catch (error) {
      failures.push(`${bucketName}: ${error instanceof Error ? error.message : 'check failed'}`);
    }
  }

  throw new Error(
    `Firebase Storage bucket not found. Tried: ${candidates.join(', ')}. Details: ${failures.join(' | ')}. Open Firebase Console > Storage and confirm the exact bucket name, or create/enable Firebase Storage first.`,
  );
}
