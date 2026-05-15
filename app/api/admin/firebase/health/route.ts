import { NextResponse } from 'next/server';
import { getFirebaseEnvStatus, setFirestoreDocument } from '@/lib/firebase-admin';

export async function GET() {
  const env = getFirebaseEnvStatus();

  if (!env.ready) {
    return NextResponse.json(
      {
        ok: false,
        error: 'Firebase environment variables are missing.',
        env,
      },
      { status: 500 },
    );
  }

  try {
    const result = await setFirestoreDocument('_adminHealth/sedifexadmin', {
      app: 'sedifexadmin',
      status: 'ok',
      checkedAt: new Date().toISOString(),
      source: 'vercel-next-admin',
    });

    return NextResponse.json({
      ok: true,
      message: 'Firestore read/write connection is working.',
      env,
      result,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Unable to connect to Firestore.',
        env,
      },
      { status: 500 },
    );
  }
}
