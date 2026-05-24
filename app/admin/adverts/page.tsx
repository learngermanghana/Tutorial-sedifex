import { revalidatePath } from 'next/cache';
import { BadgePercent, CalendarClock, ExternalLink, ImagePlus, Megaphone, Save, Sparkles, Trash2, UploadCloud } from 'lucide-react';
import { SectionCard, StatusBadge, StatCard } from '../../../components/admin/ui';
import { adminFirestore, adminStorageBucket, getFirebaseEnvStatus, listFirestoreDocuments } from '../../../lib/firebase-admin';

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
  imagePath?: string;
  placement?: string;
  status?: string;
  priority?: number;
  startsAt?: string;
  endsAt?: string;
  accent?: string;
  sponsoredBy?: string;
  clickCount?: number;
  viewCount?: number;
  generatedByAI?: boolean;
};

type GeneratedAdvertCopy = {
  eyebrow: string;
  title: string;
  text: string;
  ctaLabel: string;
  badge: string;
  accent: string;
};

const AD_COLLECTION = 'marketplaceAdverts';
const DEFAULT_PLACEMENT = 'home_flash';
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const SUPPORTED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const DEFAULT_OPENAI_MODEL = 'gpt-4o-mini';

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

function safeFilename(value: string) {
  const cleaned = value.trim().replace(/[^a-zA-Z0-9._-]/g, '_').replace(/_+/g, '_');
  return cleaned || 'advert-image';
}

function resolveExtension(filename: string, mimeType: string) {
  const fromName = filename.match(/\.([a-zA-Z0-9_-]{1,10})$/)?.[0]?.toLowerCase();
  if (fromName && ['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(fromName)) return fromName;
  if (mimeType === 'image/png') return '.png';
  if (mimeType === 'image/webp') return '.webp';
  if (mimeType === 'image/gif') return '.gif';
  return '.jpg';
}

function detectImageMimeType(buffer: Buffer) {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  if (buffer.length >= 8 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) return 'image/png';
  if (buffer.length >= 12 && buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 && buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50) return 'image/webp';
  if (buffer.length >= 6 && ['GIF87a', 'GIF89a'].includes(String.fromCharCode(buffer[0], buffer[1], buffer[2], buffer[3], buffer[4], buffer[5]))) return 'image/gif';
  return null;
}

function storagePublicUrl(bucketName: string, objectName: string) {
  return `https://storage.googleapis.com/${bucketName}/${encodeURI(objectName)}`;
}

async function uploadAdvertImage(fileValue: FormDataEntryValue | null, advertId: string) {
  if (!(fileValue instanceof File) || fileValue.size === 0) return null;
  if (fileValue.size > MAX_IMAGE_BYTES) throw new Error('Advert image is too large. Maximum upload size is 5 MB. Please compress or resize it first.');

  const buffer = Buffer.from(await fileValue.arrayBuffer());
  const detectedMimeType = detectImageMimeType(buffer);
  if (!detectedMimeType || !SUPPORTED_IMAGE_TYPES.has(detectedMimeType)) {
    throw new Error('Unsupported image file. Please upload JPG, PNG, WEBP, or GIF.');
  }

  const originalName = safeFilename(fileValue.name || 'advert-image');
  const basename = originalName.replace(/\.(jpe?g|png|webp|gif)$/i, '') || 'advert-image';
  const extension = resolveExtension(originalName, detectedMimeType);
  const objectName = `marketplace-adverts/${advertId}/${Date.now()}-${basename}${extension}`;
  const bucket = adminStorageBucket();
  const target = bucket.file(objectName);

  await target.save(buffer, {
    resumable: false,
    metadata: {
      contentType: detectedMimeType,
      cacheControl: 'public,max-age=31536000,immutable',
    },
  });

  return { imageUrl: storagePublicUrl(bucket.name, objectName), imagePath: objectName };
}

function fallbackAdvertCopy(idea: string, category: string, offer: string, audience: string): GeneratedAdvertCopy {
  const cleanIdea = idea || category || 'Sedifex Market deal';
  const cleanOffer = offer ? ` ${offer}` : '';
  const cleanAudience = audience || 'Ghana shoppers';
  return {
    eyebrow: 'Sedifex Flash Deals',
    title: `${cleanIdea}: shop smart, save more`,
    text: `Promote trusted products to ${cleanAudience}. Customers see seller details, secure checkout, delivery options, and support before they buy.${cleanOffer}`,
    ctaLabel: 'Shop now',
    badge: offer ? 'Special offer' : 'Sponsored',
    accent: '#ff7a00',
  };
}

function extractJsonObject(value: string) {
  const trimmed = value.trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) return trimmed;
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start >= 0 && end > start) return trimmed.slice(start, end + 1);
  return trimmed;
}

function normalizeGeneratedCopy(value: Partial<GeneratedAdvertCopy>, fallback: GeneratedAdvertCopy): GeneratedAdvertCopy {
  return {
    eyebrow: text(value.eyebrow, fallback.eyebrow).slice(0, 48),
    title: text(value.title, fallback.title).slice(0, 90),
    text: text(value.text, fallback.text).slice(0, 220),
    ctaLabel: text(value.ctaLabel, fallback.ctaLabel).slice(0, 28),
    badge: text(value.badge, fallback.badge).slice(0, 32),
    accent: /^#[0-9a-fA-F]{6}$/.test(text(value.accent)) ? text(value.accent) : fallback.accent,
  };
}

async function generateAdvertCopyWithAI(input: { idea: string; category: string; offer: string; audience: string; tone: string }): Promise<{ copy: GeneratedAdvertCopy; usedAI: boolean; error?: string }> {
  const fallback = fallbackAdvertCopy(input.idea, input.category, input.offer, input.audience);
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return { copy: fallback, usedAI: false, error: 'OPENAI_API_KEY is not configured, so a smart template was used.' };

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || DEFAULT_OPENAI_MODEL,
        temperature: 0.75,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: 'You write short, clean marketplace advert copy for Sedifex Market in Ghana. Return only JSON with keys: eyebrow, title, text, ctaLabel, badge, accent. Keep copy concise, trustworthy, and conversion-focused. Do not mention Jumia. Use Ghana marketplace context. accent must be a hex color.' },
          { role: 'user', content: JSON.stringify({ campaignIdea: input.idea, productCategory: input.category, offer: input.offer, audience: input.audience, tone: input.tone, constraints: { eyebrowMax: 48, titleMax: 90, textMax: 220, ctaMax: 28, badgeMax: 32 } }) },
        ],
      }),
    });

    if (!response.ok) return { copy: fallback, usedAI: false, error: `AI request failed (${response.status}). Template used instead.` };
    const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    const raw = payload.choices?.[0]?.message?.content || '';
    const parsed = JSON.parse(extractJsonObject(raw)) as Partial<GeneratedAdvertCopy>;
    return { copy: normalizeGeneratedCopy(parsed, fallback), usedAI: true };
  } catch (error) {
    return { copy: fallback, usedAI: false, error: error instanceof Error ? error.message : 'AI generation failed. Template used instead.' };
  }
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

async function generateAIAdvertDraft(formData: FormData) {
  'use server';

  const env = getFirebaseEnvStatus();
  if (!env.ready) throw new Error('Firebase environment variables are not ready.');

  const idea = formText(formData, 'aiIdea');
  const category = formText(formData, 'aiCategory');
  const offer = formText(formData, 'aiOffer');
  const audience = formText(formData, 'aiAudience') || 'Ghana shoppers';
  const tone = formText(formData, 'aiTone') || 'bold and trustworthy';
  const href = formText(formData, 'aiHref') || '/products';
  const sponsoredBy = optionalText(formText(formData, 'aiSponsoredBy'));
  const priority = formNumber(formData, 'aiPriority', 10);
  const { copy, usedAI, error } = await generateAdvertCopyWithAI({ idea, category, offer, audience, tone });
  const db = adminFirestore();
  const now = new Date().toISOString();
  const ref = db.collection(AD_COLLECTION).doc();

  await ref.set({
    ...copy,
    href,
    sponsoredBy,
    placement: DEFAULT_PLACEMENT,
    status: 'draft',
    priority,
    generatedByAI: usedAI,
    generationSource: usedAI ? 'openai' : 'template_fallback',
    generationError: error || null,
    generationInput: { idea, category, offer, audience, tone },
    createdAt: now,
    updatedAt: now,
    adminUpdatedAt: now,
    adminUpdatedFrom: 'sedifexadmin-ai-advert-generator',
    viewCount: 0,
    clickCount: 0,
  });

  await db.collection('adminAuditLogs').add({ action: 'marketplace_advert_ai_generate', advertId: ref.id, usedAI, idea, category, actor: 'sedifexadmin', createdAt: now });
  revalidatePath('/admin/adverts');
}

async function saveAdvert(formData: FormData) {
  'use server';

  const env = getFirebaseEnvStatus();
  if (!env.ready) throw new Error('Firebase environment variables are not ready.');

  const db = adminFirestore();
  const existingId = formText(formData, 'advertId');
  const ref = existingId ? db.collection(AD_COLLECTION).doc(existingId) : db.collection(AD_COLLECTION).doc();
  const now = new Date().toISOString();
  const uploadedImage = await uploadAdvertImage(formData.get('imageFile'), ref.id);
  const manualImageUrl = optionalText(formText(formData, 'imageUrl'));
  const existingImageUrl = optionalText(formText(formData, 'existingImageUrl'));
  const existingImagePath = optionalText(formText(formData, 'existingImagePath'));

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
    imageUrl: uploadedImage?.imageUrl || manualImageUrl || existingImageUrl,
    imagePath: uploadedImage?.imagePath || existingImagePath,
    updatedAt: now,
    adminUpdatedAt: now,
    adminUpdatedFrom: 'sedifexadmin-advert-manager',
    ...(existingId ? {} : { createdAt: now, viewCount: 0, clickCount: 0 }),
  };

  await ref.set(payload, { merge: true });
  await db.collection('adminAuditLogs').add({ action: existingId ? 'marketplace_advert_update' : 'marketplace_advert_create', advertId: ref.id, placement: payload.placement, status: payload.status, title: payload.title, hasUploadedImage: Boolean(uploadedImage), actor: 'sedifexadmin', createdAt: now });
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

function Input({ label, name, defaultValue, placeholder, type = 'text' }: { label: string; name: string; defaultValue?: string | number | null; placeholder?: string; type?: string }) {
  return <label className="block"><span className="mb-2 block text-sm font-semibold text-slate-700">{label}</span><input type={type} name={name} defaultValue={defaultValue == null ? '' : String(defaultValue)} placeholder={placeholder} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100" /></label>;
}

function TextArea({ label, name, defaultValue, placeholder }: { label: string; name: string; defaultValue?: string | null; placeholder?: string }) {
  return <label className="block md:col-span-2"><span className="mb-2 block text-sm font-semibold text-slate-700">{label}</span><textarea name={name} defaultValue={defaultValue || ''} placeholder={placeholder} rows={4} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100" /></label>;
}

function Select({ label, name, defaultValue, options }: { label: string; name: string; defaultValue?: string; options: string[] }) {
  return <label className="block"><span className="mb-2 block text-sm font-semibold text-slate-700">{label}</span><select name={name} defaultValue={defaultValue || options[0]} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100">{options.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>;
}

function AIAdvertGenerator() {
  return (
    <form action={generateAIAdvertDraft} className="space-y-5 rounded-3xl border border-indigo-200 bg-gradient-to-br from-indigo-50 via-white to-amber-50 p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="inline-flex items-center gap-2 text-sm font-bold text-indigo-700"><Sparkles className="h-4 w-4" /> Generate advert text by AI</p><p className="mt-1 text-xs leading-5 text-slate-600">Enter a rough idea. The system creates a draft advert you can edit, add image, then activate.</p></div><StatusBadge tone="blue">Creates draft</StatusBadge></div>
      <div className="grid gap-5 md:grid-cols-2"><TextArea label="Campaign idea" name="aiIdea" placeholder="Example: Big skincare weekend deal for trusted Ghana beauty shops" /><Input label="Product/category" name="aiCategory" placeholder="Skincare, makeup, phones, fashion, groceries..." /><Input label="Offer or deal" name="aiOffer" placeholder="10% off, free delivery, new arrivals, Christmas promo..." /><Input label="Target audience" name="aiAudience" defaultValue="Ghana shoppers" placeholder="Students, beauty lovers, parents, businesses..." /><Input label="Tone" name="aiTone" defaultValue="bold and trustworthy" placeholder="premium, friendly, urgent, youthful..." /><Input label="Button link" name="aiHref" defaultValue="/products" placeholder="/products, /category/beauty, /stores/store-id" /><Input label="Sponsor/store name" name="aiSponsoredBy" placeholder="Optional" /><Input label="Priority" name="aiPriority" type="number" defaultValue={10} /></div>
      <div className="flex justify-end"><button className="inline-flex items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-indigo-500"><Sparkles className="h-4 w-4" /> Generate AI draft</button></div>
    </form>
  );
}

function AdvertForm({ advert }: { advert?: AdvertRecord }) {
  const isEditing = Boolean(advert?.id);
  return (
    <form action={saveAdvert} className="space-y-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <input type="hidden" name="advertId" value={advert?.id || ''} />
      <input type="hidden" name="existingImageUrl" value={advert?.imageUrl || ''} />
      <input type="hidden" name="existingImagePath" value={advert?.imagePath || ''} />
      <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-semibold text-slate-950">{isEditing ? 'Edit advert slide' : 'Create new advert slide'}</p><p className="mt-1 text-xs text-slate-500">Upload an image file. The file is stored in Firebase Storage and only the URL is saved on the advert.</p></div><StatusBadge tone={isEditing ? 'blue' : 'green'}>{isEditing ? 'Existing slide' : 'New slide'}</StatusBadge></div>
      <div className="grid gap-5 md:grid-cols-2"><Input label="Small label" name="eyebrow" defaultValue={advert?.eyebrow || 'Sedifex Flash Deals'} placeholder="Sedifex Flash Deals" /><Input label="Main title" name="title" defaultValue={advert?.title} placeholder="Advertise quality products customers can trust" /><TextArea label="Description" name="text" defaultValue={advert?.text} placeholder="Describe the promotion, product, store, delivery promise, or campaign." /><Input label="Button text" name="ctaLabel" defaultValue={advert?.ctaLabel || 'Shop now'} placeholder="Shop now" /><Input label="Button link" name="href" defaultValue={advert?.href || '/products'} placeholder="/products or /stores/store-id" /><label className="block"><span className="mb-2 block text-sm font-semibold text-slate-700">Upload advert image</span><input type="file" name="imageFile" accept="image/jpeg,image/png,image/webp,image/gif" className="w-full rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-700 file:mr-3 file:rounded-xl file:border-0 file:bg-indigo-600 file:px-3 file:py-2 file:text-sm file:font-bold file:text-white" /><span className="mt-2 block text-xs text-slate-500">JPG, PNG, WEBP, or GIF. Max 5 MB.</span></label><Input label="Or paste image URL" name="imageUrl" defaultValue={advert?.imageUrl} placeholder="https://..." /><Input label="Badge text" name="badge" defaultValue={advert?.badge || 'Sponsored'} placeholder="Sponsored" /><Input label="Sponsor / store name" name="sponsoredBy" defaultValue={advert?.sponsoredBy} placeholder="Glittering Med Spa" /><Input label="Accent color" name="accent" defaultValue={advert?.accent || '#ff7a00'} placeholder="#ff7a00" /><Input label="Priority" name="priority" type="number" defaultValue={advert?.priority ?? 10} placeholder="1" /><Select label="Status" name="status" defaultValue={advert?.status || 'draft'} options={['active', 'draft', 'paused', 'expired']} /><Select label="Placement" name="placement" defaultValue={advert?.placement || DEFAULT_PLACEMENT} options={[DEFAULT_PLACEMENT, 'products_top', 'category_top', 'store_spotlight']} /><Input label="Start date" name="startsAt" type="datetime-local" defaultValue={advert?.startsAt ? String(advert.startsAt).slice(0, 16) : ''} /><Input label="End date" name="endsAt" type="datetime-local" defaultValue={advert?.endsAt ? String(advert.endsAt).slice(0, 16) : ''} /></div>
      <div className="flex justify-end"><button className="inline-flex items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-indigo-500"><Save className="h-4 w-4" /> {isEditing ? 'Save advert' : 'Create advert'}</button></div>
    </form>
  );
}

export default async function AdvertManagerPage() {
  const { env, adverts, error } = await loadAdverts();
  const activeCount = adverts.filter(isActive).length;
  const draftCount = adverts.filter((advert) => (advert.status || '').toLowerCase() === 'draft').length;
  const pausedCount = adverts.filter((advert) => (advert.status || '').toLowerCase() === 'paused').length;
  const aiCount = adverts.filter((advert) => advert.generatedByAI === true).length;

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-slate-950 p-6 text-white shadow-sm sm:p-8"><div className="inline-flex items-center gap-2 rounded-full border border-indigo-300/20 bg-indigo-400/10 px-3 py-1 text-xs font-semibold text-indigo-100"><Megaphone className="h-4 w-4" /> Marketplace adverts</div><h2 className="mt-5 text-3xl font-bold tracking-tight sm:text-4xl">Manage homepage flash adverts</h2><p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">Create quality advert slides for Sedifex Market. Images are uploaded to Firebase Storage; Firestore only stores the generated image URL and advert metadata.</p><div className="mt-5 flex flex-wrap gap-2 text-xs text-slate-300"><span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1">Collection: {AD_COLLECTION}</span><span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1">Placement: {DEFAULT_PLACEMENT}</span><span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1">Bucket: {env.storageBucket || 'not configured'}</span></div></section>
      {error ? <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800"><strong className="font-semibold">Advert manager notice:</strong> {error}</section> : null}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><StatCard label="Total adverts" value={String(adverts.length)} delta="All non-deleted slides" /><StatCard label="Active now" value={String(activeCount)} delta="Available for marketplace" /><StatCard label="Draft slides" value={String(draftCount)} delta="Created but not live" /><StatCard label="AI drafts" value={String(aiCount)} delta="Generated copy helpers" /></section>
      <SectionCard title="Generate copy fast"><AIAdvertGenerator /></SectionCard>
      <SectionCard title="Create advert manually"><AdvertForm /></SectionCard>
      <SectionCard title="Advert slides">{adverts.length > 0 ? <div className="space-y-5">{adverts.map((advert) => (<article key={advert.id} className="rounded-3xl border border-slate-200 bg-slate-50 p-5"><div className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]"><div className="min-h-48 overflow-hidden rounded-2xl bg-slate-900">{advert.imageUrl ? <img src={String(advert.imageUrl)} alt={advert.title || 'Advert image'} className="h-48 w-full object-cover" /> : <div className="flex h-48 items-center justify-center bg-gradient-to-br from-slate-900 via-indigo-900 to-orange-500 p-5 text-center text-sm font-semibold text-white"><ImagePlus className="mr-2 h-4 w-4" /> No image uploaded</div>}</div><div className="space-y-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600">{advert.eyebrow || 'Advert'}</p><h3 className="mt-2 text-xl font-bold tracking-tight text-slate-950">{advert.title || 'Untitled advert'}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{advert.text || 'No description added.'}</p></div><div className="flex flex-wrap gap-2"><StatusBadge tone={statusTone(advert)}>{isActive(advert) ? 'Active' : advert.status || 'Draft'}</StatusBadge>{advert.generatedByAI ? <StatusBadge tone="blue">AI</StatusBadge> : null}</div></div><div className="grid gap-3 text-sm sm:grid-cols-2"><div className="rounded-2xl bg-white p-3 ring-1 ring-slate-200"><p className="flex items-center gap-2 font-semibold text-slate-950"><ExternalLink className="h-4 w-4 text-indigo-600" /> Link</p><p className="mt-1 break-all text-slate-500">{advert.href || '/products'}</p></div><div className="rounded-2xl bg-white p-3 ring-1 ring-slate-200"><p className="flex items-center gap-2 font-semibold text-slate-950"><BadgePercent className="h-4 w-4 text-indigo-600" /> Badge</p><p className="mt-1 text-slate-500">{advert.badge || 'Sponsored'}</p></div><div className="rounded-2xl bg-white p-3 ring-1 ring-slate-200"><p className="flex items-center gap-2 font-semibold text-slate-950"><CalendarClock className="h-4 w-4 text-indigo-600" /> Schedule</p><p className="mt-1 text-slate-500">{advert.startsAt || 'Now'} → {advert.endsAt || 'No end date'}</p></div><div className="rounded-2xl bg-white p-3 ring-1 ring-slate-200"><p className="font-semibold text-slate-950"><UploadCloud className="mr-1 inline h-4 w-4 text-indigo-600" /> Storage</p><p className="mt-1 break-all text-slate-500">{advert.imagePath || 'External URL'}</p></div></div><details className="rounded-2xl bg-white p-4 ring-1 ring-slate-200"><summary className="cursor-pointer text-sm font-bold text-indigo-700">Edit this advert</summary><div className="mt-4"><AdvertForm advert={advert} /></div></details><form action={deleteAdvert}><input type="hidden" name="advertId" value={advert.id} /><button className="inline-flex items-center justify-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-bold text-rose-700 transition hover:bg-rose-100"><Trash2 className="h-4 w-4" /> Remove advert</button></form></div></div></article>))}</div> : <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-600">No adverts yet. Create your first homepage flash advert above.</div>}</SectionCard>
    </div>
  );
}
