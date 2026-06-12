import { Megaphone } from 'lucide-react';
import AdvertManagerClient, { type AdvertRecord } from '../../../components/admin/AdvertManagerClient';
import { adminFirestore, getFirebaseEnvStatus, listFirestoreDocuments } from '../../../lib/firebase-admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const AD_COLLECTION = 'marketplaceAdverts';
const DEFAULT_PLACEMENT = 'home_flash';

function text(value: unknown, fallback = '') {
  if (typeof value === 'string') return value.trim() || fallback;
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return fallback;
}

function formText(formData: FormData, key: string) {
  return text(formData.get(key));
}

function formNumber(formData: FormData, key: string, fallback = 0) {
  const value = Number(formText(formData, key));
  return Number.isFinite(value) ? value : fallback;
}

function optionalText(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function normalizeStatus(value: string) {
  return ['active', 'draft', 'paused', 'expired'].includes(value) ? value : 'draft';
}

async function saveAdvert(formData: FormData) {
  'use server';

  const env = getFirebaseEnvStatus();
  if (!env.ready) throw new Error('Firebase environment variables are not ready.');

  const db = adminFirestore();
  const existingId = formText(formData, 'advertId');
  const ref = existingId ? db.collection(AD_COLLECTION).doc(existingId) : db.collection(AD_COLLECTION).doc();
  const now = new Date().toISOString();

  const payload = {
    title: formText(formData, 'title'),
    eyebrow: formText(formData, 'eyebrow') || 'Sedifex Flash Deals',
    text: formText(formData, 'text'),
    ctaLabel: formText(formData, 'ctaLabel') || 'Shop now',
    href: formText(formData, 'href') || '/products',
    badge: formText(formData, 'badge') || 'Sponsored',
    sponsoredBy: optionalText(formText(formData, 'sponsoredBy')),
    accent: formText(formData, 'accent') || '#ff7a00',
    placement: formText(formData, 'placement') || DEFAULT_PLACEMENT,
    status: normalizeStatus(formText(formData, 'status')),
    priority: formNumber(formData, 'priority', 10),
    startsAt: optionalText(formText(formData, 'startsAt')),
    endsAt: optionalText(formText(formData, 'endsAt')),
    imageUrl: optionalText(formText(formData, 'imageUrl')),
    imagePath: optionalText(formText(formData, 'imagePath')),
    updatedAt: now,
    adminUpdatedAt: now,
    adminUpdatedFrom: 'sedifexadmin-advert-manager',
    ...(existingId ? {} : { createdAt: now, viewCount: 0, clickCount: 0 }),
  };

  await ref.set(payload, { merge: true });
  await db.collection('adminAuditLogs').add({
    action: existingId ? 'marketplace_advert_update' : 'marketplace_advert_create',
    advertId: ref.id,
    placement: payload.placement,
    status: payload.status,
    title: payload.title,
    actor: 'sedifexadmin',
    createdAt: now,
  });

}

async function deleteAdvert(formData: FormData) {
  'use server';

  const advertId = formText(formData, 'advertId');
  if (!advertId) return;

  const db = adminFirestore();
  const now = new Date().toISOString();
  await db.collection(AD_COLLECTION).doc(advertId).set({ status: 'expired', deleted: true, deletedAt: now, adminUpdatedAt: now }, { merge: true });
  await db.collection('adminAuditLogs').add({ action: 'marketplace_advert_delete', advertId, actor: 'sedifexadmin', createdAt: now });
}

async function loadAdverts() {
  const env = getFirebaseEnvStatus();
  if (!env.ready) return { env, adverts: [] as AdvertRecord[], error: 'Firebase environment variables are not ready.' };

  try {
    const result = await listFirestoreDocuments(AD_COLLECTION, 100);
    const adverts = (result.documents as AdvertRecord[])
      .filter((advert) => advert.deleted !== true)
      .sort((a, b) => {
        const priorityDiff = (Number(a.priority) || 0) - (Number(b.priority) || 0);
        if (priorityDiff !== 0) return priorityDiff;
        return String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''));
      });
    return { env, adverts, error: null };
  } catch (error) {
    return { env, adverts: [] as AdvertRecord[], error: error instanceof Error ? error.message : 'Unable to load adverts.' };
  }
}

export default async function AdvertManagerPage() {
  const { env, adverts, error } = await loadAdverts();

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-slate-950 p-6 text-white shadow-sm sm:p-8">
        <div className="inline-flex items-center gap-2 rounded-full border border-indigo-300/20 bg-indigo-400/10 px-3 py-1 text-xs font-semibold text-indigo-100">
          <Megaphone className="h-4 w-4" /> Marketplace adverts
        </div>
        <h2 className="mt-5 text-3xl font-bold tracking-tight sm:text-4xl">Advert Manager</h2>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">
          Manage homepage flash adverts in two simple tabs: Active Ads and Manual Add Ads. Upload an image first, the URL is filled automatically, then save the advert.
        </p>
        <div className="mt-5 flex flex-wrap gap-2 text-xs text-slate-300">
          <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1">Collection: {AD_COLLECTION}</span>
          <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1">Placement: {DEFAULT_PLACEMENT}</span>
          <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1">Bucket: {env.storageBucket || 'not configured'}</span>
        </div>
      </section>

      {error ? (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <strong className="font-semibold">Advert manager notice:</strong> {error}
        </section>
      ) : null}

      <AdvertManagerClient adverts={adverts} saveAdvertAction={saveAdvert} deleteAdvertAction={deleteAdvert} />
    </div>
  );
}
