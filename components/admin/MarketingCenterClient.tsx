'use client';

import { FormEvent, useMemo, useState } from 'react';
import { Mail, RefreshCw, Search, Send, Users } from 'lucide-react';
import type { MarketingContact, MarketingSenderStore } from '../../lib/marketing-contacts';

type SendResult = { ok?: boolean; error?: string; sentToScript?: number; detail?: string } | null;

function sourceOptions(contacts: MarketingContact[]) {
  return Array.from(new Set(contacts.flatMap((contact) => contact.source.split(',')).filter(Boolean))).sort();
}

function roleOptions(contacts: MarketingContact[]) {
  return Array.from(new Set(contacts.flatMap((contact) => contact.role.split(',')).filter(Boolean))).sort();
}

function bodyToHtml(value: string) {
  return value
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${paragraph.replace(/\n/g, '<br />')}</p>`)
    .join('\n');
}

export default function MarketingCenterClient({ contacts, stores }: { contacts: MarketingContact[]; stores: MarketingSenderStore[] }) {
  const [query, setQuery] = useState('');
  const [source, setSource] = useState('all');
  const [role, setRole] = useState('all');
  const [storeIdFilter, setStoreIdFilter] = useState('all');
  const [includeOptOut, setIncludeOptOut] = useState(false);
  const [selectedEmails, setSelectedEmails] = useState<string[]>([]);
  const [senderStoreId, setSenderStoreId] = useState(stores.find((store) => store.hasBulkEmailIntegration)?.id ?? stores[0]?.id ?? '');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
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

  const filteredContacts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return contacts.filter((contact) => {
      if (!includeOptOut && contact.optedOut) return false;
      if (source !== 'all' && !contact.source.split(',').includes(source)) return false;
      if (role !== 'all' && !contact.role.split(',').includes(role)) return false;
      if (storeIdFilter !== 'all' && contact.storeId !== storeIdFilter) return false;
      if (!normalizedQuery) return true;
      const haystack = [contact.name, contact.email, contact.phone, contact.source, contact.role, contact.storeName, contact.tags.join(' ')].join(' ').toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [contacts, includeOptOut, query, role, source, storeIdFilter]);

  const selectedContacts = useMemo(() => {
    const selected = new Set(selectedEmails);
    return contacts.filter((contact) => selected.has(contact.email) && (includeOptOut || !contact.optedOut));
  }, [contacts, includeOptOut, selectedEmails]);

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

  async function handleSend(event: FormEvent) {
    event.preventDefault();
    setResult(null);
    setSending(true);

    try {
      const response = await fetch('/api/admin/marketing/send', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          storeId: senderStoreId,
          subject,
          text: body,
          html: bodyToHtml(body),
          recipients: selectedContacts.map((contact) => ({
            name: contact.name,
            email: contact.email,
            phone: contact.phone,
            source: contact.source,
            role: contact.role,
          })),
        }),
      });
      const data = await response.json().catch(() => ({}));
      setResult(data);
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
            <p className="mt-1 text-sm leading-6 text-slate-600">Filter customers, stores, students, donors, volunteers, bookings, and orders.</p>
          </div>
          <span className="rounded-2xl bg-indigo-50 p-3 text-indigo-600"><Users className="h-5 w-5" /></span>
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <label className="text-sm font-medium text-slate-700" htmlFor="marketing-search">Search</label>
            <div className="mt-2 flex items-center rounded-2xl border border-slate-200 px-3 focus-within:border-indigo-300 focus-within:ring-4 focus-within:ring-indigo-100">
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
          <label className="text-sm font-medium text-slate-700 lg:col-span-2">Store
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
            <h2 className="text-lg font-semibold text-slate-950">Send marketing email</h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">Uses the selected store’s Google Apps Script bulk email integration.</p>
          </div>
          <span className="rounded-2xl bg-emerald-50 p-3 text-emerald-600"><Mail className="h-5 w-5" /></span>
        </div>

        <form className="mt-5 space-y-4" onSubmit={handleSend}>
          <label className="block text-sm font-medium text-slate-700">Sending store
            <select value={senderStoreId} onChange={(event) => setSenderStoreId(event.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100">
              {stores.map((store) => <option key={store.id} value={store.id}>{store.name} {store.hasBulkEmailIntegration ? '✓' : '⚠ no Apps Script'}</option>)}
            </select>
          </label>
          <label className="block text-sm font-medium text-slate-700">Subject
            <input value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="Your campaign subject" className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100" />
          </label>
          <label className="block text-sm font-medium text-slate-700">Message
            <textarea value={body} onChange={(event) => setBody(event.target.value)} rows={12} placeholder="Write your email. Use clear offer, short message, and contact details." className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm leading-6 outline-none focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100" />
          </label>

          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-800">
            Only selected non-opted-out contacts will be sent. Keep marketing messages relevant and include a way to unsubscribe or contact support.
          </div>

          <button disabled={sending || selectedContacts.length === 0} className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60">
            {sending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {sending ? 'Sending to Apps Script…' : `Send to ${selectedContacts.length} contacts`}
          </button>
        </form>

        {result ? (
          <div className={`mt-5 rounded-2xl border p-4 text-sm ${result.ok ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-800'}`}>
            <strong>{result.ok ? 'Campaign sent to Apps Script' : 'Campaign failed'}</strong>
            <p className="mt-1 leading-6">{result.ok ? `${result.sentToScript ?? 0} recipients submitted.` : result.error}</p>
            {result.detail ? <pre className="mt-2 whitespace-pre-wrap text-xs">{result.detail}</pre> : null}
          </div>
        ) : null}
      </section>
    </div>
  );
}
