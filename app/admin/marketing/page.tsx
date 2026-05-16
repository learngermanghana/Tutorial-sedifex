import { redirect } from 'next/navigation';
import { AlertTriangle, CheckCircle2, Mail, Send, Store, Users } from 'lucide-react';
import { SectionCard, StatCard, StatusBadge } from '../../../components/admin/ui';
import { getFirebaseEnvStatus, listFirestoreDocuments, setFirestoreDocument } from '../../../lib/firebase-admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type RecordData = Record<string, unknown> & { id?: string; path?: string };
type Recipient = {
  id: string;
  type: 'store' | 'customer';
  name: string;
  email: string;
  storeId?: string;
};

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function text(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function firstText(record: RecordData, fields: string[], fallback = '') {
  for (const field of fields) {
    const value = text(record[field]);
    if (value) return value;
  }
  return fallback;
}

function nestedText(record: RecordData, path: string[]) {
  let current: unknown = record;
  for (const key of path) current = asObject(current)[key];
  return text(current);
}

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function storeRecipient(record: RecordData): Recipient | null {
  const email =
    firstText(record, ['email', 'ownerEmail', 'adminEmail', 'contactEmail', 'businessEmail', 'supportEmail']) ||
    nestedText(record, ['owner', 'email']) ||
    nestedText(record, ['contact', 'email']);

  if (!validEmail(email)) return null;

  const id = firstText(record, ['id', 'storeId'], email);
  const name = firstText(record, ['storeName', 'name', 'businessName', 'displayName', 'merchantName', 'ownerName'], email);

  return { id, storeId: id, type: 'store', name, email };
}

function customerRecipient(record: RecordData): Recipient | null {
  const email =
    firstText(record, ['email', 'customerEmail', 'billingEmail']) ||
    nestedText(record, ['customer', 'email']);

  if (!validEmail(email)) return null;

  const id = firstText(record, ['id', 'customerId'], email);
  const name =
    firstText(record, ['name', 'customerName', 'fullName', 'displayName']) ||
    nestedText(record, ['customer', 'name']) ||
    email;
  const storeId = firstText(record, ['storeId', 'merchantId']);

  return { id, storeId: storeId || undefined, type: 'customer', name, email };
}

function dedupeRecipients(recipients: Recipient[]) {
  const map = new Map<string, Recipient>();
  for (const recipient of recipients) {
    const key = recipient.email.toLowerCase();
    if (!map.has(key)) map.set(key, recipient);
  }
  return Array.from(map.values()).sort((a, b) => a.email.localeCompare(b.email));
}

async function loadRecipients() {
  const env = getFirebaseEnvStatus();

  if (!env.ready) {
    return {
      ok: false,
      error: 'Firebase envs are not ready in Vercel or local .env.local.',
      stores: [] as Recipient[],
      customers: [] as Recipient[],
      recentCampaigns: [] as RecordData[],
    };
  }

  try {
    const [storesResult, settingsResult, customersResult, campaignsResult] = await Promise.all([
      listFirestoreDocuments('stores', 100),
      listFirestoreDocuments('storeSettings', 100),
      listFirestoreDocuments('customers', 100),
      listFirestoreDocuments('marketingCampaigns', 20),
    ]);

    const stores = dedupeRecipients([
      ...storesResult.documents.map((record) => storeRecipient(record as RecordData)).filter(Boolean),
      ...settingsResult.documents.map((record) => storeRecipient(record as RecordData)).filter(Boolean),
    ] as Recipient[]);

    const customers = dedupeRecipients(
      customersResult.documents.map((record) => customerRecipient(record as RecordData)).filter(Boolean) as Recipient[],
    );

    return {
      ok: true,
      error: null,
      stores,
      customers,
      recentCampaigns: campaignsResult.documents as RecordData[],
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Unable to load marketing recipients.',
      stores: [] as Recipient[],
      customers: [] as Recipient[],
      recentCampaigns: [] as RecordData[],
    };
  }
}

function appsScriptUrl() {
  return (
    process.env.MARKETING_APPS_SCRIPT_WEBHOOK_URL ||
    process.env.APPS_SCRIPT_MARKETING_WEBHOOK_URL ||
    process.env.SEDIFEX_MARKETING_APPS_SCRIPT_URL ||
    ''
  ).trim();
}

function appsScriptToken() {
  return (process.env.MARKETING_APPS_SCRIPT_TOKEN || process.env.SEDIFEX_SHARED_TOKEN || '').trim();
}

async function sendMarketingCampaign(formData: FormData) {
  'use server';

  const audience = String(formData.get('audience') || 'stores');
  const subject = String(formData.get('subject') || '').trim();
  const message = String(formData.get('message') || '').trim();
  const senderName = String(formData.get('senderName') || 'Sedifex').trim();

  if (!subject || !message) redirect('/admin/marketing?status=missing_content');

  const data = await loadRecipients();
  const stores = data.stores;
  const customers = data.customers;
  const recipients = audience === 'customers' ? customers : audience === 'both' ? dedupeRecipients([...stores, ...customers]) : stores;
  const now = new Date().toISOString();
  const campaignId = `campaign_${Date.now()}`;
  const webhookUrl = appsScriptUrl();
  const token = appsScriptToken();
  const payload = {
    source: 'sedifexadmin',
    type: 'marketing_email_campaign',
    campaignId,
    audience,
    senderName,
    subject,
    message,
    createdAt: now,
    recipientCount: recipients.length,
    recipients,
  };

  await setFirestoreDocument(`marketingCampaigns/${campaignId}`, {
    ...payload,
    status: webhookUrl ? 'syncing_to_apps_script' : 'missing_apps_script_webhook',
  });

  if (!webhookUrl) redirect('/admin/marketing?status=missing_webhook');
  if (recipients.length === 0) redirect('/admin/marketing?status=no_recipients');

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ ...payload, token }),
    });
    const responseText = await response.text();

    await setFirestoreDocument(`marketingCampaigns/${campaignId}`, {
      status: response.ok ? 'sent_to_apps_script' : 'apps_script_error',
      syncedAt: new Date().toISOString(),
      appsScriptStatus: response.status,
      appsScriptResponse: responseText.slice(0, 1000),
    });

    redirect(response.ok ? '/admin/marketing?status=sent' : '/admin/marketing?status=sync_error');
  } catch (error) {
    await setFirestoreDocument(`marketingCampaigns/${campaignId}`, {
      status: 'apps_script_error',
      syncedAt: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown Apps Script sync error.',
    });

    redirect('/admin/marketing?status=sync_error');
  }
}

function statusMessage(status: string) {
  if (status === 'sent') return { tone: 'green' as const, title: 'Campaign sent to Apps Script.', text: 'Apps Script received the campaign payload and can process the email send.' };
  if (status === 'missing_webhook') return { tone: 'yellow' as const, title: 'Apps Script URL is missing.', text: 'Add MARKETING_APPS_SCRIPT_WEBHOOK_URL in .env.local or Vercel before sending.' };
  if (status === 'no_recipients') return { tone: 'yellow' as const, title: 'No recipients found.', text: 'No valid email addresses were found for the selected audience.' };
  if (status === 'missing_content') return { tone: 'yellow' as const, title: 'Subject and message are required.', text: 'Add campaign content before sending.' };
  if (status === 'sync_error') return { tone: 'red' as const, title: 'Apps Script sync failed.', text: 'The campaign was saved, but Apps Script returned an error or could not be reached.' };
  return null;
}

function campaignStatus(record: RecordData) {
  return text(record.status) || 'unknown';
}

function campaignTone(status: string) {
  if (status.includes('sent')) return 'green' as const;
  if (status.includes('missing') || status.includes('syncing')) return 'yellow' as const;
  if (status.includes('error')) return 'red' as const;
  return 'slate' as const;
}

function formatDate(value: unknown) {
  if (typeof value !== 'string') return '—';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

export default async function MarketingPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const params = searchParams ? await searchParams : {};
  const status = typeof params.status === 'string' ? params.status : '';
  const notice = statusMessage(status);
  const data = await loadRecipients();
  const webhookReady = Boolean(appsScriptUrl());
  const totalRecipients = dedupeRecipients([...data.stores, ...data.customers]).length;

  const stats = [
    { label: 'Store contacts', value: data.ok ? String(data.stores.length) : 'Setup', delta: data.ok ? 'From stores + storeSettings' : 'Database not ready' },
    { label: 'Customers', value: data.ok ? String(data.customers.length) : '—', delta: 'From customers collection' },
    { label: 'Total reachable', value: data.ok ? String(totalRecipients) : '—', delta: 'De-duplicated emails' },
    { label: 'Apps Script sync', value: webhookReady ? 'Ready' : 'Missing', delta: webhookReady ? 'Webhook URL configured' : 'Add webhook env' },
  ];

  return (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => <StatCard key={stat.label} {...stat} />)}
      </section>

      {data.error ? (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <div className="flex gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="font-semibold">Marketing recipients are not available yet.</p>
              <p className="mt-1 leading-6">{data.error}</p>
            </div>
          </div>
        </section>
      ) : null}

      {notice ? (
        <section className={`rounded-2xl border p-4 text-sm ${notice.tone === 'green' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : notice.tone === 'red' ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
          <p className="font-semibold">{notice.title}</p>
          <p className="mt-1 leading-6">{notice.text}</p>
        </section>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[1.25fr_0.85fr]">
        <div className="space-y-6">
          <SectionCard title="Send marketing email through Apps Script">
            <form action={sendMarketingCampaign} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-slate-800">Audience</span>
                  <select name="audience" className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-indigo-300 focus:ring-4 focus:ring-indigo-500/10">
                    <option value="stores">Stores only</option>
                    <option value="customers">Available customers only</option>
                    <option value="both">Stores + available customers</option>
                  </select>
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-slate-800">Sender name</span>
                  <input name="senderName" defaultValue="Sedifex" className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-indigo-300 focus:ring-4 focus:ring-indigo-500/10" />
                </label>
              </div>

              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-800">Subject</span>
                <input name="subject" required placeholder="New Sedifex update for your store" className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-indigo-300 focus:ring-4 focus:ring-indigo-500/10" />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-800">Message</span>
                <textarea name="message" required rows={8} placeholder="Write the email message here..." className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm leading-6 outline-none transition focus:border-indigo-300 focus:ring-4 focus:ring-indigo-500/10" />
              </label>

              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-800">
                Send only to stores/customers who should receive marketing or product updates. Apps Script should handle unsubscribe/footer rules before sending.
              </div>

              <button className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-indigo-500 px-4 py-3 text-sm font-bold text-white transition hover:bg-indigo-400">
                <Send className="h-4 w-4" /> Send to Apps Script
              </button>
            </form>
          </SectionCard>
        </div>

        <div className="space-y-6">
          <SectionCard title="Recipient sources">
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-2xl bg-slate-50 p-4">
                <div className="flex items-center gap-3"><Store className="h-5 w-5 text-indigo-600" /><span className="text-sm font-semibold text-slate-800">Stores</span></div>
                <StatusBadge tone="blue">{data.stores.length}</StatusBadge>
              </div>
              <div className="flex items-center justify-between rounded-2xl bg-slate-50 p-4">
                <div className="flex items-center gap-3"><Users className="h-5 w-5 text-indigo-600" /><span className="text-sm font-semibold text-slate-800">Customers</span></div>
                <StatusBadge tone="blue">{data.customers.length}</StatusBadge>
              </div>
              <div className="flex items-center justify-between rounded-2xl bg-slate-50 p-4">
                <div className="flex items-center gap-3"><Mail className="h-5 w-5 text-indigo-600" /><span className="text-sm font-semibold text-slate-800">Apps Script</span></div>
                <StatusBadge tone={webhookReady ? 'green' : 'yellow'}>{webhookReady ? 'Ready' : 'Missing URL'}</StatusBadge>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Recent campaigns">
            <div className="space-y-3">
              {data.recentCampaigns.length === 0 ? (
                <div className="rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">No campaigns saved yet.</div>
              ) : data.recentCampaigns.slice(0, 8).map((campaign) => {
                const status = campaignStatus(campaign);
                return (
                  <div key={text(campaign.id) || text(campaign.path)} className="rounded-2xl bg-slate-50 p-4 text-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-slate-950">{text(campaign.subject) || 'Untitled campaign'}</p>
                        <p className="mt-1 text-xs text-slate-500">{formatDate(campaign.createdAt)} · {String(campaign.recipientCount || 0)} recipients</p>
                      </div>
                      <StatusBadge tone={campaignTone(status)}>{status}</StatusBadge>
                    </div>
                  </div>
                );
              })}
            </div>
          </SectionCard>

          <SectionCard title="Required environment variables">
            <div className="space-y-3 text-sm leading-6 text-slate-600">
              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="mb-2 flex items-center gap-2 font-semibold text-slate-950"><CheckCircle2 className="h-4 w-4 text-emerald-600" /> Required</div>
                MARKETING_APPS_SCRIPT_WEBHOOK_URL
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="mb-2 flex items-center gap-2 font-semibold text-slate-950"><Mail className="h-4 w-4 text-indigo-600" /> Optional token</div>
                MARKETING_APPS_SCRIPT_TOKEN
              </div>
            </div>
          </SectionCard>
        </div>
      </section>
    </div>
  );
}
