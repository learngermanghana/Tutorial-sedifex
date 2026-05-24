'use client';

import { ChangeEvent, FormEvent, useMemo, useState } from 'react';
import { ImagePlus, Mail, RefreshCw, Search, Send, UploadCloud, Users } from 'lucide-react';
import type { MarketingContact } from '../../lib/marketing-contacts';

type AudienceMode = 'stores' | 'customers' | 'both';
type SendResult = {
  ok?: boolean;
  error?: string;
  sentToScript?: number;
  detail?: string;
  httpStatus?: number;
  rawResponse?: string;
  response?: unknown;
} | null;

type UploadResult = {
  ok?: boolean;
  imageUrl?: string;
  imagePath?: string;
  error?: string;
  detail?: string;
  rawResponse?: string;
};

function sourceOptions(contacts: MarketingContact[]) {
  return Array.from(new Set(contacts.flatMap((contact) => contact.source.split(',')).filter(Boolean))).sort();
}

function roleOptions(contacts: MarketingContact[]) {
  return Array.from(new Set(contacts.flatMap((contact) => contact.role.split(',')).filter(Boolean))).sort();
}

function escapeHtml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\"/g, '&quot;').replace(/'/g, '&#039;');
}

function bodyToHtml(value: string, imageUrl?: string) {
  const bodyHtml = value
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, '<br />')}</p>`)
    .join('\n');

  if (!imageUrl) return bodyHtml;

  return `
    <div style="margin:0 0 22px;overflow:hidden;border-radius:20px;border:1px solid #e2e8f0;background:#f8fafc;">
      <img src="${escapeHtml(imageUrl)}" alt="Sedifex campaign image" style="display:block;width:100%;max-width:100%;height:auto;border:0;" />
    </div>
    ${bodyHtml}
  `;
}

function textWithImage(value: string, imageUrl?: string) {
  if (!imageUrl) return value;
  return `${value}\n\nCampaign image: ${imageUrl}`;
}

function parts(value: string) {
  return value.split(',').map((item) => item.trim()).filter(Boolean);
}

function isStoreContact(contact: MarketingContact) {
  const sources = parts(contact.source);
  const roles = parts(contact.role);
  return sources.includes('stores') || roles.includes('store_owner');
}

function isCustomerContact(contact: MarketingContact) {
  const sources = parts(contact.source);
  const roles = parts(contact.role);
  return sources.some((item) => ['customers', 'orders', 'bookings', 'support_requests'].includes(item)) ||
    roles.some((item) => ['customer', 'buyer', 'booking_customer', 'support_request'].includes(item));
}

function contactMatchesAudience(contact: MarketingContact, audience: AudienceMode) {
  if (audience === 'stores') return isStoreContact(contact);
  if (audience === 'customers') return isCustomerContact(contact);
  return isStoreContact(contact) || isCustomerContact(contact);
}

function parseMaybeJson(value: string) {
  if (!value.trim()) return null;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

function pretty(value: unknown) {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('Unable to read image file.'));
    reader.readAsDataURL(file);
  });
}

export default function MarketingCenterClient({ contacts }: { contacts: MarketingContact[] }) {
  const [query, setQuery] = useState('');
  const [audience, setAudience] = useState<AudienceMode>('both');
  const [source, setSource] = useState('all');
  const [role, setRole] = useState('all');
  const [storeIdFilter, setStoreIdFilter] = useState('all');
  const [includeOptOut, setIncludeOptOut] = useState(false);
  const [selectedEmails, setSelectedEmails] = useState<string[]>([]);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [campaignImageUrl, setCampaignImageUrl] = useState('');
  const [imageUploading, setImageUploading] = useState(false);
  const [imageUploadError, setImageUploadError] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<SendResult>(null);

  const sources = useMemo(() => sourceOptions(contacts), [contacts]);
  const roles = useMemo(() => roleOptions(contacts), [contacts]);
  const storeFilters = useMemo(() => {
    const map = new Map<string, string>();
    contacts.forEach((contact) => {
      if (contact.storeId) map.set(contact.storeId, contact.storeName || contact.storeId);
    });
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [contacts]);

  const audienceCounts = useMemo(() => ({
    stores: contacts.filter((contact) => !contact.optedOut && isStoreContact(contact)).length,
    customers: contacts.filter((contact) => !contact.optedOut && isCustomerContact(contact)).length,
    both: contacts.filter((contact) => !contact.optedOut && (isStoreContact(contact) || isCustomerContact(contact))).length,
  }), [contacts]);

  const filteredContacts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return contacts.filter((contact) => {
      if (!contactMatchesAudience(contact, audience)) return false;
      if (!includeOptOut && contact.optedOut) return false;
      if (source !== 'all' && !contact.source.split(',').includes(source)) return false;
      if (role !== 'all' && !contact.role.split(',').includes(role)) return false;
      if (storeIdFilter !== 'all' && contact.storeId !== storeIdFilter) return false;
      if (!normalizedQuery) return true;
      const haystack = [contact.name, contact.email, contact.phone, contact.source, contact.role, contact.storeName, contact.tags.join(' ')].join(' ').toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [contacts, audience, includeOptOut, query, role, source, storeIdFilter]);

  const selectedContacts = useMemo(() => {
    const selected = new Set(selectedEmails);
    return contacts.filter((contact) => selected.has(contact.email) && contactMatchesAudience(contact, audience) && (includeOptOut || !contact.optedOut));
  }, [contacts, audience, includeOptOut, selectedEmails]);

  function toggleVisibleSelection() {
    const visibleEmails = filteredContacts.map((contact) => contact.email);
    const selected = new Set(selectedEmails);
    const allVisibleSelected = visibleEmails.length > 0 && visibleEmails.every((email) => selected.has(email));
    if (allVisibleSelected) {
      setSelectedEmails(selectedEmails.filter((email) => !visibleEmails.includes(email)));
    } else {
      setSelectedEmails(Array.from(new Set([...selectedEmails, ...visibleEmails])));
    }
  }

  function selectAudienceOnly(nextAudience: AudienceMode) {
    setAudience(nextAudience);
    setSelectedEmails([]);
  }

  async function handleImageUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setImageUploadError('');
    setImageUploading(true);

    try {
      if (file.size > 4 * 1024 * 1024) {
        setImageUploadError('Image is too large. Maximum upload size is 4 MB. Please compress or resize it first.');
        return;
      }

      const dataUrl = await readFileAsDataUrl(file);
      const response = await fetch('/api/admin/marketing/upload-image-json', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ fileName: file.name, contentType: file.type, dataUrl }),
      });

      const rawResponse = await response.text();
      const parsed = parseMaybeJson(rawResponse) as UploadResult | null;

      if (!response.ok || !parsed?.ok || !parsed.imageUrl) {
        setImageUploadError(parsed?.error || parsed?.detail || rawResponse || `Image upload failed with HTTP ${response.status}.`);
        return;
      }

      setCampaignImageUrl(parsed.imageUrl);
    } catch (error) {
      setImageUploadError(error instanceof Error ? error.message : 'Image upload failed.');
    } finally {
      setImageUploading(false);
      event.target.value = '';
    }
  }

  async function handleSend(event: FormEvent) {
    event.preventDefault();
    setResult(null);
    setSending(true);

    try {
      const response = await fetch('/api/admin/marketing/send', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          audience,
          subject,
          text: textWithImage(body, campaignImageUrl),
          html: bodyToHtml(body, campaignImageUrl),
          ctaUrl: audience === 'stores' ? 'https://www.sedifex.com' : 'https://www.sedifexmarket.com',
          ctaLabel: audience === 'stores' ? 'Update Your Store' : 'Open Sedifex Market',
          recipients: selectedContacts.map((contact) => ({
            name: contact.name,
            email: contact.email,
            phone: contact.phone,
            source: contact.source,
            role: contact.role,
            storeId: contact.storeId,
            storeName: contact.storeName,
          })),
        }),
      });

      const rawResponse = await response.text();
      const parsed = parseMaybeJson(rawResponse) as SendResult;
      const data = parsed && typeof parsed === 'object' ? parsed : null;

      if (!response.ok) {
        setResult({
          ok: false,
          httpStatus: response.status,
          error: data?.error || `Marketing API returned HTTP ${response.status}.`,
          detail: data?.detail || rawResponse || 'The server returned an empty response body.',
          rawResponse,
          response: data,
        });
        return;
      }

      setResult(data || { ok: false, httpStatus: response.status, error: 'Marketing API returned an empty or non-JSON response.', rawResponse });
    } catch (error) {
      setResult({ ok: false, error: error instanceof Error ? error.message : 'Unable to send campaign.' });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">Audience database</h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">Choose stores, customers, or both. Campaigns are sent as Sedifex Team, not as an individual store.</p>
          </div>
          <span className="rounded-2xl bg-indigo-50 p-3 text-indigo-600"><Users className="h-5 w-5" /></span>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          {(['stores', 'customers', 'both'] as AudienceMode[]).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => selectAudienceOnly(item)}
              className={`rounded-2xl border px-4 py-3 text-left text-sm transition ${audience === item ? 'border-indigo-300 bg-indigo-50 text-indigo-900 ring-4 ring-indigo-100' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}
            >
              <span className="block font-bold capitalize">{item === 'both' ? 'Stores + Customers' : item}</span>
              <span className="mt-1 block text-xs text-slate-500">{audienceCounts[item]} available contacts</span>
            </button>
          ))}
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <label className="text-sm font-medium text-slate-700" htmlFor="marketing-search">Search</label>
            <div className="mt-2 flex items-center rounded-2xl border border-slate-200 px-3 focus-within:border-indigo-300 focus-within:ring-4 focus:ring-indigo-100">
              <Search className="h-4 w-4 text-slate-400" />
              <input id="marketing-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name, email, phone, tag, store" className="w-full border-0 bg-transparent px-3 py-3 text-sm outline-none" />
            </div>
          </div>
          <label className="text-sm font-medium text-slate-700">Source
            <select value={source} onChange={(event) => setSource(event.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100">
              <option value="all">All sources</option>
              {sources.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label className="text-sm font-medium text-slate-700">Role
            <select value={role} onChange={(event) => setRole(event.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100">
              <option value="all">All roles</option>
              {roles.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label className="text-sm font-medium text-slate-700 lg:col-span-2">Store filter
            <select value={storeIdFilter} onChange={(event) => setStoreIdFilter(event.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100">
              <option value="all">All stores</option>
              {storeFilters.map(([id, name]) => <option key={id} value={id}>{name} · {id}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 lg:col-span-2">
            <input type="checkbox" checked={includeOptOut} onChange={(event) => setIncludeOptOut(event.target.checked)} className="h-4 w-4 rounded border-slate-300 text-indigo-600" />
            Show opted-out contacts for review only
          </label>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-slate-50 p-4">
          <div className="text-sm text-slate-600"><strong className="text-slate-950">{filteredContacts.length}</strong> visible · <strong className="text-slate-950">{selectedContacts.length}</strong> selected</div>
          <button type="button" onClick={toggleVisibleSelection} className="rounded-2xl bg-slate-950 px-4 py-2 text-sm font-bold text-white hover:bg-slate-800">Select / unselect visible</button>
        </div>

        <div className="mt-5 max-h-[620px] overflow-hidden rounded-2xl border border-slate-200">
          <div className="grid grid-cols-[auto_1.1fr_1fr_0.8fr] bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <span /> <span>Contact</span><span>Source</span><span>Status</span>
          </div>
          <div className="max-h-[560px] divide-y divide-slate-200 overflow-y-auto">
            {filteredContacts.slice(0, 800).map((contact) => (
              <label key={contact.email} className="grid cursor-pointer grid-cols-[auto_1.1fr_1fr_0.8fr] items-center gap-3 px-4 py-3 text-sm hover:bg-indigo-50/40">
                <input type="checkbox" checked={selectedEmails.includes(contact.email)} onChange={(event) => {
                  setSelectedEmails((current) => event.target.checked ? Array.from(new Set([...current, contact.email])) : current.filter((email) => email !== contact.email));
                }} className="h-4 w-4 rounded border-slate-300 text-indigo-600" />
                <span className="min-w-0"><strong className="block truncate text-slate-950">{contact.name}</strong><span className="block truncate text-xs text-slate-500">{contact.email}</span></span>
                <span className="min-w-0"><span className="block truncate text-slate-700">{contact.role}</span><span className="block truncate text-xs text-slate-500">{contact.source}</span></span>
                <span className={`rounded-full px-2 py-1 text-center text-xs font-semibold ${contact.optedOut ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>{contact.optedOut ? 'Opted out' : 'OK'}</span>
              </label>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">Send Sedifex Team email</h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">Sender identity: <strong>Sedifex Team</strong>. Uses the Sedifex marketing Apps Script configured in Vercel.</p>
          </div>
          <span className="rounded-2xl bg-emerald-50 p-3 text-emerald-600"><Mail className="h-5 w-5" /></span>
        </div>

        <form className="mt-5 space-y-4" onSubmit={handleSend}>
          <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4 text-sm leading-6 text-indigo-900">
            <strong>Sending as Sedifex Team</strong>
            <p className="mt-1">Choose the audience on the left: all stores, all customers, or both. The message will not use a store name as sender.</p>
          </div>
          <label className="block text-sm font-medium text-slate-700">Subject
            <input value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="Your campaign subject" className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100" />
          </label>

          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="flex items-center gap-2 text-sm font-bold text-slate-800"><ImagePlus className="h-4 w-4" /> Campaign image</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">Upload a JPG, PNG, WEBP, or GIF. The file is stored in Firebase Storage and only the URL is added to the email.</p>
              </div>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-2xl bg-slate-950 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800">
                {imageUploading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
                {imageUploading ? 'Uploading…' : 'Upload image'}
                <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={handleImageUpload} className="hidden" disabled={imageUploading} />
              </label>
            </div>
            {campaignImageUrl ? (
              <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white">
                <img src={campaignImageUrl} alt="Campaign preview" className="max-h-64 w-full object-cover" />
                <div className="flex flex-wrap items-center justify-between gap-2 p-3 text-xs text-slate-500">
                  <span className="break-all">{campaignImageUrl}</span>
                  <button type="button" onClick={() => setCampaignImageUrl('')} className="font-bold text-rose-600">Remove</button>
                </div>
              </div>
            ) : null}
            {imageUploadError ? <p className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">{imageUploadError}</p> : null}
          </div>

          <label className="block text-sm font-medium text-slate-700">Message
            <textarea value={body} onChange={(event) => setBody(event.target.value)} rows={12} placeholder="Write your email. Use clear offer, short message, and contact details." className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm leading-6 outline-none focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100" />
          </label>

          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-800">
            Only selected non-opted-out contacts will be sent. Keep marketing messages relevant and include a way to unsubscribe or contact support.
          </div>

          <button disabled={sending || imageUploading || selectedContacts.length === 0} className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60">
            {sending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {sending ? 'Sending to Sedifex Apps Script…' : `Send to ${selectedContacts.length} selected ${audience === 'both' ? 'contacts' : audience}`}
          </button>
        </form>

        {result ? (
          <div className={`mt-5 rounded-2xl border p-4 text-sm ${result.ok ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-800'}`}>
            <strong>{result.ok ? 'Campaign sent to Apps Script' : 'Campaign failed'}</strong>
            <p className="mt-1 leading-6">{result.ok ? `${result.sentToScript ?? 0} recipients submitted.` : result.error || 'Unknown error.'}</p>
            {!result.ok ? (
              <div className="mt-3 rounded-xl bg-white/70 p-3 text-xs text-red-900 ring-1 ring-red-200">
                <p className="font-bold">Exact error details</p>
                <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap">{result.detail || result.rawResponse || pretty(result.response) || 'No response detail was returned.'}</pre>
              </div>
            ) : null}
            {result.ok && result.response ? <pre className="mt-2 max-h-60 overflow-auto whitespace-pre-wrap text-xs">{pretty(result.response)}</pre> : null}
          </div>
        ) : null}
      </section>
    </div>
  );
}
