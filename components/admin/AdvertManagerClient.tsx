'use client';

import { useMemo, useState, useTransition } from 'react';
import { BadgePercent, CalendarClock, CheckCircle2, ExternalLink, ImagePlus, Loader2, Save, Trash2, UploadCloud } from 'lucide-react';
import { StatusBadge, StatCard } from './ui';

export type AdvertRecord = Record<string, unknown> & {
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
};

type AdvertManagerClientProps = {
  adverts: AdvertRecord[];
  saveAdvertAction: (formData: FormData) => Promise<void>;
  deleteAdvertAction: (formData: FormData) => Promise<void>;
};

const DEFAULT_PLACEMENT = 'home_flash';

type Tab = 'active' | 'manual';

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

function Field({ label, name, value, onChange, placeholder, type = 'text' }: { label: string; name: string; value: string; onChange: (value: string) => void; placeholder?: string; type?: string }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-slate-700">{label}</span>
      <input
        type={type}
        name={name}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100"
      />
    </label>
  );
}

function ReadonlyField({ label, name, value, placeholder }: { label: string; name: string; value: string; placeholder?: string }) {
  return (
    <label className="block md:col-span-2">
      <span className="mb-2 block text-sm font-semibold text-slate-700">{label}</span>
      <input
        name={name}
        value={value}
        readOnly
        placeholder={placeholder}
        className="w-full rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 outline-none"
      />
      <span className="mt-2 block text-xs text-emerald-700">This URL is what gets saved in Firestore. The actual image is stored separately.</span>
    </label>
  );
}

function TextArea({ label, name, value, onChange, placeholder }: { label: string; name: string; value: string; onChange: (value: string) => void; placeholder?: string }) {
  return (
    <label className="block md:col-span-2">
      <span className="mb-2 block text-sm font-semibold text-slate-700">{label}</span>
      <textarea
        name={name}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        rows={4}
        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100"
      />
    </label>
  );
}

function SelectField({ label, name, value, onChange, options }: { label: string; name: string; value: string; onChange: (value: string) => void; options: string[] }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-slate-700">{label}</span>
      <select
        name={name}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100"
      >
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    </label>
  );
}

function AdvertForm({ advert, saveAdvertAction, compact = false }: { advert?: AdvertRecord; saveAdvertAction: (formData: FormData) => Promise<void>; compact?: boolean }) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState('');
  const [uploadError, setUploadError] = useState('');
  const [imageUrl, setImageUrl] = useState(String(advert?.imageUrl || ''));
  const [imagePath, setImagePath] = useState(String(advert?.imagePath || ''));
  const [eyebrow, setEyebrow] = useState(String(advert?.eyebrow || 'Sedifex Flash Deals'));
  const [title, setTitle] = useState(String(advert?.title || ''));
  const [text, setText] = useState(String(advert?.text || ''));
  const [ctaLabel, setCtaLabel] = useState(String(advert?.ctaLabel || 'Shop now'));
  const [href, setHref] = useState(String(advert?.href || '/products'));
  const [badge, setBadge] = useState(String(advert?.badge || 'Sponsored'));
  const [sponsoredBy, setSponsoredBy] = useState(String(advert?.sponsoredBy || ''));
  const [accent, setAccent] = useState(String(advert?.accent || '#ff7a00'));
  const [priority, setPriority] = useState(String(advert?.priority ?? 10));
  const [status, setStatus] = useState(String(advert?.status || 'draft'));
  const [placement, setPlacement] = useState(String(advert?.placement || DEFAULT_PLACEMENT));
  const [startsAt, setStartsAt] = useState(advert?.startsAt ? String(advert.startsAt).slice(0, 16) : '');
  const [endsAt, setEndsAt] = useState(advert?.endsAt ? String(advert.endsAt).slice(0, 16) : '');

  async function uploadImage(file: File | null) {
    if (!file) return;
    setUploadMessage('');
    setUploadError('');
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('imageFile', file);
      formData.append('advertId', String(advert?.id || 'new'));
      const response = await fetch('/api/admin/adverts/upload', { method: 'POST', body: formData });
      const payload = await response.json() as { imageUrl?: string; imagePath?: string; error?: string };
      if (!response.ok || !payload.imageUrl) throw new Error(payload.error || 'Image upload failed.');
      setImageUrl(payload.imageUrl);
      setImagePath(payload.imagePath || '');
      setUploadMessage('Image uploaded successfully. The Image URL field has been filled. Now click Save advert.');
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'Image upload failed.');
    } finally {
      setUploading(false);
    }
  }

  async function onSubmit(formData: FormData) {
    formData.set('imageUrl', imageUrl);
    formData.set('imagePath', imagePath);
    setMessage('');
    startTransition(async () => {
      await saveAdvertAction(formData);
      setMessage('Advert saved successfully.');
      if (!advert?.id) {
        setTitle('');
        setText('');
        setImageUrl('');
        setImagePath('');
        setStatus('draft');
      }
    });
  }

  return (
    <form action={onSubmit} className="space-y-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <input type="hidden" name="advertId" value={advert?.id || ''} />
      <input type="hidden" name="imagePath" value={imagePath} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-950">{advert?.id ? 'Edit advert' : 'Manual add advert'}</p>
          <p className="mt-1 text-xs text-slate-500">Step 1: upload image. Step 2: fill text. Step 3: save advert.</p>
        </div>
        <StatusBadge tone={advert?.id ? 'blue' : 'green'}>{advert?.id ? 'Existing' : 'New'}</StatusBadge>
      </div>

      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4">
        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-slate-700">Upload advert image</span>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={(event) => uploadImage(event.target.files?.[0] || null)}
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 file:mr-3 file:rounded-xl file:border-0 file:bg-indigo-600 file:px-3 file:py-2 file:text-sm file:font-bold file:text-white"
          />
        </label>
        <p className="mt-2 text-xs text-slate-500">JPG, PNG, WEBP, or GIF. Max 5 MB.</p>
        {uploading ? <p className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-indigo-700"><Loader2 className="h-4 w-4 animate-spin" /> Uploading image...</p> : null}
        {uploadMessage ? <p className="mt-3 inline-flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700"><CheckCircle2 className="h-4 w-4" /> {uploadMessage}</p> : null}
        {uploadError ? <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">{uploadError}</p> : null}
      </div>

      {imageUrl ? (
        <div className="grid gap-4 md:grid-cols-[220px_minmax(0,1fr)]">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
            <img src={imageUrl} alt="Advert preview" className="h-36 w-full object-cover" />
          </div>
          <ReadonlyField label="Image URL" name="imageUrl" value={imageUrl} />
        </div>
      ) : (
        <ReadonlyField label="Image URL" name="imageUrl" value={imageUrl} placeholder="Upload an image and the URL will appear here" />
      )}

      <div className="grid gap-5 md:grid-cols-2">
        <Field label="Small label" name="eyebrow" value={eyebrow} onChange={setEyebrow} />
        <Field label="Main title" name="title" value={title} onChange={setTitle} placeholder="Shop with clarity" />
        <TextArea label="Description" name="text" value={text} onChange={setText} placeholder="Describe the advert or promotion." />
        <Field label="Button text" name="ctaLabel" value={ctaLabel} onChange={setCtaLabel} />
        <Field label="Button link" name="href" value={href} onChange={setHref} placeholder="/products" />
        <Field label="Badge text" name="badge" value={badge} onChange={setBadge} />
        {!compact ? <Field label="Sponsor / store name" name="sponsoredBy" value={sponsoredBy} onChange={setSponsoredBy} /> : <input type="hidden" name="sponsoredBy" value={sponsoredBy} />}
        {!compact ? <Field label="Accent color" name="accent" value={accent} onChange={setAccent} /> : <input type="hidden" name="accent" value={accent} />}
        <Field label="Priority" name="priority" type="number" value={priority} onChange={setPriority} />
        <SelectField label="Status" name="status" value={status} onChange={setStatus} options={['active', 'draft', 'paused', 'expired']} />
        <SelectField label="Placement" name="placement" value={placement} onChange={setPlacement} options={[DEFAULT_PLACEMENT, 'products_top', 'category_top', 'store_spotlight']} />
        {!compact ? <Field label="Start date" name="startsAt" type="datetime-local" value={startsAt} onChange={setStartsAt} /> : <input type="hidden" name="startsAt" value={startsAt} />}
        {!compact ? <Field label="End date" name="endsAt" type="datetime-local" value={endsAt} onChange={setEndsAt} /> : <input type="hidden" name="endsAt" value={endsAt} />}
      </div>

      {message ? <p className="inline-flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700"><CheckCircle2 className="h-4 w-4" /> {message}</p> : null}
      <div className="flex justify-end">
        <button disabled={isPending} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-indigo-500 disabled:opacity-60">
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save advert
        </button>
      </div>
    </form>
  );
}

function AdvertCard({ advert, saveAdvertAction, deleteAdvertAction }: { advert: AdvertRecord; saveAdvertAction: (formData: FormData) => Promise<void>; deleteAdvertAction: (formData: FormData) => Promise<void> }) {
  return (
    <article className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
      <div className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
        <div className="min-h-48 overflow-hidden rounded-2xl bg-slate-900">
          {advert.imageUrl ? <img src={String(advert.imageUrl)} alt={advert.title || 'Advert image'} className="h-48 w-full object-cover" /> : <div className="flex h-48 items-center justify-center bg-gradient-to-br from-slate-900 via-indigo-900 to-orange-500 p-5 text-center text-sm font-semibold text-white"><ImagePlus className="mr-2 h-4 w-4" /> No image uploaded</div>}
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
            <div className="rounded-2xl bg-white p-3 ring-1 ring-slate-200"><p className="font-semibold text-slate-950"><UploadCloud className="mr-1 inline h-4 w-4 text-indigo-600" /> Storage</p><p className="mt-1 break-all text-slate-500">{advert.imagePath || 'External URL'}</p></div>
          </div>
          <details className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
            <summary className="cursor-pointer text-sm font-bold text-indigo-700">Edit this advert</summary>
            <div className="mt-4"><AdvertForm advert={advert} saveAdvertAction={saveAdvertAction} compact /></div>
          </details>
          <form action={deleteAdvertAction}>
            <input type="hidden" name="advertId" value={advert.id} />
            <button className="inline-flex items-center justify-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-bold text-rose-700 transition hover:bg-rose-100"><Trash2 className="h-4 w-4" /> Remove advert</button>
          </form>
        </div>
      </div>
    </article>
  );
}

export default function AdvertManagerClient({ adverts, saveAdvertAction, deleteAdvertAction }: AdvertManagerClientProps) {
  const [tab, setTab] = useState<Tab>('active');
  const activeAds = useMemo(() => adverts.filter((advert) => (advert.status || '').toLowerCase() === 'active'), [adverts]);
  const draftAds = useMemo(() => adverts.filter((advert) => (advert.status || '').toLowerCase() !== 'active'), [adverts]);

  return (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Active ads" value={String(activeAds.length)} delta="Showing on marketplace" />
        <StatCard label="Draft / paused" value={String(draftAds.length)} delta="Not live yet" />
        <StatCard label="Total ads" value={String(adverts.length)} delta="All non-deleted ads" />
        <StatCard label="Upload mode" value="URL" delta="Images saved as links" />
      </section>

      <div className="rounded-3xl border border-slate-200 bg-white p-2 shadow-sm">
        <div className="grid gap-2 sm:grid-cols-2">
          <button type="button" onClick={() => setTab('active')} className={`rounded-2xl px-4 py-3 text-sm font-bold transition ${tab === 'active' ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-700 hover:bg-slate-100'}`}>Active ads</button>
          <button type="button" onClick={() => setTab('manual')} className={`rounded-2xl px-4 py-3 text-sm font-bold transition ${tab === 'manual' ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-700 hover:bg-slate-100'}`}>Manual add ads</button>
        </div>
      </div>

      {tab === 'active' ? (
        <section className="space-y-5">
          <div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-4 text-sm text-indigo-900">
            These are the adverts customers can see when status is <strong>active</strong> and placement is <strong>home_flash</strong>.
          </div>
          {activeAds.length > 0 ? activeAds.map((advert) => <AdvertCard key={advert.id} advert={advert} saveAdvertAction={saveAdvertAction} deleteAdvertAction={deleteAdvertAction} />) : <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-600">No active ads yet. Open Manual Add Ads and create one.</div>}
        </section>
      ) : (
        <section className="space-y-5">
          <AdvertForm saveAdvertAction={saveAdvertAction} />
          {draftAds.length > 0 ? <div className="space-y-5"><h3 className="text-sm font-bold text-slate-950">Draft / paused ads</h3>{draftAds.map((advert) => <AdvertCard key={advert.id} advert={advert} saveAdvertAction={saveAdvertAction} deleteAdvertAction={deleteAdvertAction} />)}</div> : null}
        </section>
      )}
    </div>
  );
}
