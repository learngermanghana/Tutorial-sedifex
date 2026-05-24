import { revalidatePath } from 'next/cache';
import { BadgePercent, CalendarClock, ExternalLink, Megaphone, Save, Trash2 } from 'lucide-react';
import { SectionCard, StatusBadge, StatCard } from '../../../components/admin/ui';
import { adminFirestore, getFirebaseEnvStatus, listFirestoreDocuments } from '../../../lib/firebase-admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type AdvertRecord = Record<string, unknown> & {
  id: string;
  title?: string;
  eyebrow?: string;
  text?: string;
  ctaLabel?: string;
  href?: string;
  badge?: string;
  imageUrl?: string;
  placement?: string;
  status?: string;
  priority?: number;
  startsAt?: string;
  endsAt?: string;
  accent?: string;
  sponsoredBy?: string;
  clickCount?: number;
  viewCount?: number;
};

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

function isActive(advert: AdvertRecord) {
  if ((advert.status || '').toLowerCase() !== 'active') return false;
  const now = Date.now();
  const start = advert.startsAt ? Date.parse(String(advert.startsAt)) : null;
  const end = advert.endsAt ? Date.parse(String(advert.endsAt)) : null;
  if (start && Number.isFinite(start) && start > now) return false;
  if (end && Number.isFinite(end) && end < now) return false;
  return true;
}

function statusTone(advert: AdvertRecord) {
  if (isActive(advert)) return 'green' as const;
  if ((advert.status || '').toLowerCase() === 'paused') return 'yellow' as const;
  if ((advert.status || '').toLowerCase() === 'expired') return 'red' as const;
  return 'slate' as const;
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

  revalidatePath('/admin/adverts');
}

async function deleteAdvert(formData: FormData) {
  'use server';

  const advertId = formText(formData, 'advertId');
  if (!advertId) return;

  const db = adminFirestore();
  const now = new Date().toISOString();
  await db.collection(AD_COLLECTION).doc(advertId).set({ status: 'expired', deleted: true, deletedAt: now, adminUpdatedAt: now }, { merge: true });
  await db.collection('adminAuditLogs').add({ action: 'marketplace_advert_delete', advertId, actor: 'sedifexadmin', createdAt: now });
  revalidatePath('/admin/adverts');
}

async function loadAdverts() {
  const env = getFirebaseEnvStatus();
  if (!env.ready) return { env, adverts: [] as AdvertRecord[], error: 'Firebase environment variables are not ready.' };

  try {
    const result = await listFirestoreDocuments(AD_COLLECTION, 100);
    const adverts = (result.documents as AdvertRecord[])
      .filter((advert) => advert.deleted !== true)
      .sort((a, b) => (Number(a.priority) || 0) - (Number(b.priority) || 0));
    return { env, adverts, error: null };
  } catch (error) {
    return { env, adverts: [] as AdvertRecord[], error: error instanceof Error ? error.message : 'Unable to load adverts.' };
  }
}

function Input({ label, name, defaultValue, placeholder, type = 'text' }: { label: string; name: string; defaultValue?: string | number | null; placeholder?: string; type?: string }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-slate-700">{label}</span>
      <input type={type} name={name} defaultValue={defaultValue == null ? '' : String(defaultValue)} placeholder={placeholder} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100" />
    </label>
  );
}

function TextArea({ label, name, defaultValue, placeholder }: { label: string; name: string; defaultValue?: string | null; placeholder?: string }) {
  return (
    <label className="block md:col-span-2">
      <span className="mb-2 block text-sm font-semibold text-slate-700">{label}</span>
      <textarea name={name} defaultValue={defaultValue || ''} placeholder={placeholder} rows={4} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100" />
    </label>
  );
}

function Select({ label, name, defaultValue, options }: { label: string; name: string; defaultValue?: string; options: string[] }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-slate-700">{label}</span>
      <select name={name} defaultValue={defaultValue || options[0]} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100">
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    </label>
  );
}

function AdvertForm({ advert }: { advert?: AdvertRecord }) {
  const isEditing = Boolean(advert?.id);
  return (
    <form action={saveAdvert} className="space-y-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <input type="hidden" name="advertId" value={advert?.id || ''} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-950">{isEditing ? 'Edit advert slide' : 'Create new advert slide'}</p>
          <p className="mt-1 text-xs text-slate-500">Paste an image URL for now. Upload flow can be added after this first version.</p>
        </div>
        <StatusBadge tone={isEditing ? 'blue' : 'green'}>{isEditing ? 'Existing slide' : 'New slide'}</StatusBadge>
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        <Input label="Small label" name="eyebrow" defaultValue={advert?.eyebrow || 'Sedifex Flash Deals'} placeholder="Sedifex Flash Deals" />
        <Input label="Main title" name="title" defaultValue={advert?.title} placeholder="Advertise quality products customers can trust" />
        <TextArea label="Description" name="text" defaultValue={advert?.text} placeholder="Describe the promotion, product, store, delivery promise, or campaign." />
        <Input label="Button text" name="ctaLabel" defaultValue={advert?.ctaLabel || 'Shop now'} placeholder="Shop now" />
        <Input label="Button link" name="href" defaultValue={advert?.href || '/products'} placeholder="/products or /stores/store-id" />
        <Input label="Image URL" name="imageUrl" defaultValue={advert?.imageUrl} placeholder="https://..." />
        <Input label="Badge text" name="badge" defaultValue={advert?.badge || 'Sponsored'} placeholder="Sponsored" />
        <Input label="Sponsor / store name" name="sponsoredBy" defaultValue={advert?.sponsoredBy} placeholder="Glittering Med Spa" />
        <Input label="Accent color" name="accent" defaultValue={advert?.accent || '#ff7a00'} placeholder="#ff7a00" />
        <Input label="Priority" name="priority" type="number" defaultValue={advert?.priority ?? 10} placeholder="1" />
        <Select label="Status" name="status" defaultValue={advert?.status || 'draft'} options={['active', 'draft', 'paused', 'expired']} />
        <Select label="Placement" name="placement" defaultValue={advert?.placement || DEFAULT_PLACEMENT} options={[DEFAULT_PLACEMENT, 'products_top', 'category_top', 'store_spotlight']} />
        <Input label="Start date" name="startsAt" type="datetime-local" defaultValue={advert?.startsAt ? String(advert.startsAt).slice(0, 16) : ''} />
        <Input label="End date" name="endsAt" type="datetime-local" defaultValue={advert?.endsAt ? String(advert.endsAt).slice(0, 16) : ''} />
      </div>
      <div className="flex justify-end">
        <button className="inline-flex items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-indigo-500">
          <Save className="h-4 w-4" /> {isEditing ? 'Save advert' : 'Create advert'}
        </button>
      </div>
    </form>
  );
}

export default async function AdvertManagerPage() {
  const { env, adverts, error } = await loadAdverts();
  const activeCount = adverts.filter(isActive).length;
  const draftCount = adverts.filter((advert) => (advert.status || '').toLowerCase() === 'draft').length;
  const pausedCount = adverts.filter((advert) => (advert.status || '').toLowerCase() === 'paused').length;

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-slate-950 p-6 text-white shadow-sm sm:p-8">
        <div className="inline-flex items-center gap-2 rounded-full border border-indigo-300/20 bg-indigo-400/10 px-3 py-1 text-xs font-semibold text-indigo-100"><Megaphone className="h-4 w-4" /> Marketplace adverts</div>
        <h2 className="mt-5 text-3xl font-bold tracking-tight sm:text-4xl">Manage homepage flash adverts</h2>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">Create quality advert slides for Sedifex Market. Add image URLs, product links, schedule dates, priority, and active or paused status.</p>
        <div className="mt-5 flex flex-wrap gap-2 text-xs text-slate-300">
          <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1">Collection: {AD_COLLECTION}</span>
          <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1">Placement: {DEFAULT_PLACEMENT}</span>
          <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1">Bucket: {env.storageBucket || 'not configured'}</span>
        </div>
      </section>

      {error ? <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800"><strong className="font-semibold">Advert manager notice:</strong> {error}</section> : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total adverts" value={String(adverts.length)} delta="All non-deleted slides" />
        <StatCard label="Active now" value={String(activeCount)} delta="Available for marketplace" />
        <StatCard label="Draft slides" value={String(draftCount)} delta="Created but not live" />
        <StatCard label="Paused slides" value={String(pausedCount)} delta="Temporarily hidden" />
      </section>

      <SectionCard title="Create advert"><AdvertForm /></SectionCard>

      <SectionCard title="Advert slides">
        {adverts.length > 0 ? <div className="space-y-5">{adverts.map((advert) => (
          <article key={advert.id} className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
            <div className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
              <div className="min-h-48 overflow-hidden rounded-2xl bg-slate-900">
                {advert.imageUrl ? <img src={String(advert.imageUrl)} alt={advert.title || 'Advert image'} className="h-48 w-full object-cover" /> : <div className="flex h-48 items-center justify-center bg-gradient-to-br from-slate-900 via-indigo-900 to-orange-500 p-5 text-center text-sm font-semibold text-white">No image URL added</div>}
              </div>
              <div className="space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600">{advert.eyebrow || 'Advert'}</p>
                    <h3 className="mt-2 text-xl font-bold tracking-tight text-slate-950">{advert.title || 'Untitled advert'}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{advert.text || 'No description added.'}</p>
                  </div>
                  <StatusBadge tone={statusTone(advert)}>{isActive(advert) ? 'Active' : advert.status || 'Draft'}</StatusBadge>
                </div>
                <div className="grid gap-3 text-sm sm:grid-cols-2">
                  <div className="rounded-2xl bg-white p-3 ring-1 ring-slate-200"><p className="flex items-center gap-2 font-semibold text-slate-950"><ExternalLink className="h-4 w-4 text-indigo-600" /> Link</p><p className="mt-1 break-all text-slate-500">{advert.href || '/products'}</p></div>
                  <div className="rounded-2xl bg-white p-3 ring-1 ring-slate-200"><p className="flex items-center gap-2 font-semibold text-slate-950"><BadgePercent className="h-4 w-4 text-indigo-600" /> Badge</p><p className="mt-1 text-slate-500">{advert.badge || 'Sponsored'}</p></div>
                  <div className="rounded-2xl bg-white p-3 ring-1 ring-slate-200"><p className="flex items-center gap-2 font-semibold text-slate-950"><CalendarClock className="h-4 w-4 text-indigo-600" /> Schedule</p><p className="mt-1 text-slate-500">{advert.startsAt || 'Now'} → {advert.endsAt || 'No end date'}</p></div>
                  <div className="rounded-2xl bg-white p-3 ring-1 ring-slate-200"><p className="font-semibold text-slate-950">Performance</p><p className="mt-1 text-slate-500">{Number(advert.viewCount || 0)} views • {Number(advert.clickCount || 0)} clicks</p></div>
                </div>
                <details className="rounded-2xl bg-white p-4 ring-1 ring-slate-200"><summary className="cursor-pointer text-sm font-bold text-indigo-700">Edit this advert</summary><div className="mt-4"><AdvertForm advert={advert} /></div></details>
                <form action={deleteAdvert}><input type="hidden" name="advertId" value={advert.id} /><button className="inline-flex items-center justify-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-bold text-rose-700 transition hover:bg-rose-100"><Trash2 className="h-4 w-4" /> Remove advert</button></form>
              </div>
            </div>
          </article>
        ))}</div> : <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-600">No adverts yet. Create your first homepage flash advert above.</div>}
      </SectionCard>
    </div>
  );
}
