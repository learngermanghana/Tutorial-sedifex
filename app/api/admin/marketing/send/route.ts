import { NextResponse } from 'next/server';

type Recipient = {
  name?: string;
  email?: string;
  phone?: string;
  source?: string;
  role?: string;
  storeId?: string;
  storeName?: string;
};

type RequestBody = {
  subject?: string;
  html?: string;
  text?: string;
  recipients?: Recipient[];
};

function isAllowedRole(role?: string) {
  return role === 'super_admin' || role === 'ops_admin' || role === 'support';
}

function cookieValue(req: Request, name: string) {
  return req.headers.get('cookie')?.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${name}=`))?.split('=')[1];
}

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeEmail(value: unknown) {
  return cleanText(value).toLowerCase();
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function sanitizeRecipients(recipients: unknown): Recipient[] {
  if (!Array.isArray(recipients)) return [];
  const deduped = new Map<string, Recipient>();
  for (const item of recipients.slice(0, 2000)) {
    if (!item || typeof item !== 'object') continue;
    const record = item as Recipient;
    const email = normalizeEmail(record.email);
    if (!isValidEmail(email)) continue;
    deduped.set(email, {
      name: cleanText(record.name) || email.split('@')[0],
      email,
      phone: cleanText(record.phone),
      source: cleanText(record.source),
      role: cleanText(record.role),
      storeId: cleanText(record.storeId),
      storeName: cleanText(record.storeName),
    });
  }
  return Array.from(deduped.values());
}

function plainTextFromHtml(html: string) {
  return html.replace(/<br\s*\/?\s*>/gi, '\n').replace(/<\/p>/gi, '\n\n').replace(/<[^>]+>/g, '').replace(/\n{3,}/g, '\n\n').trim();
}

function sedifexMarketingConfig() {
  const webAppUrl = (
    process.env.SEDIFEX_MARKETING_APPS_SCRIPT_URL ||
    process.env.MARKETING_APPS_SCRIPT_WEBHOOK_URL ||
    process.env.APPS_SCRIPT_MARKETING_WEBHOOK_URL ||
    ''
  ).trim();

  const sharedToken = (
    process.env.SEDIFEX_MARKETING_SHARED_TOKEN ||
    process.env.MARKETING_APPS_SCRIPT_TOKEN ||
    process.env.SEDIFEX_SHARED_TOKEN ||
    ''
  ).trim();

  return {
    webAppUrl,
    sharedToken,
    fromEmail: (process.env.SEDIFEX_MARKETING_FROM_EMAIL || 'sedifexbiz@gmail.com').trim(),
    fromName: (process.env.SEDIFEX_MARKETING_FROM_NAME || 'Sedifex Market').trim(),
    replyTo: (process.env.SEDIFEX_MARKETING_REPLY_TO || process.env.SEDIFEX_MARKETING_FROM_EMAIL || 'sedifexbiz@gmail.com').trim(),
  };
}

export async function POST(req: Request) {
  const role = cookieValue(req, 'sedifex_admin_role');
  if (!isAllowedRole(role)) {
    return NextResponse.json({ ok: false, error: 'You do not have permission to send Sedifex marketing emails.' }, { status: 403 });
  }

  const body = await req.json().catch(() => null) as RequestBody | null;
  const subject = cleanText(body?.subject);
  const html = cleanText(body?.html);
  const text = cleanText(body?.text) || plainTextFromHtml(html);
  const recipients = sanitizeRecipients(body?.recipients);
  const config = sedifexMarketingConfig();

  if (!config.webAppUrl) return NextResponse.json({ ok: false, error: 'SEDIFEX_MARKETING_APPS_SCRIPT_URL is not configured.' }, { status: 500 });
  if (!config.sharedToken) return NextResponse.json({ ok: false, error: 'SEDIFEX_MARKETING_SHARED_TOKEN is not configured.' }, { status: 500 });
  if (!subject) return NextResponse.json({ ok: false, error: 'Subject is required.' }, { status: 400 });
  if (!html && !text) return NextResponse.json({ ok: false, error: 'Email body is required.' }, { status: 400 });
  if (recipients.length === 0) return NextResponse.json({ ok: false, error: 'Select at least one valid recipient.' }, { status: 400 });

  try {
    const response = await fetch(config.webAppUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-sedifex-shared-token': config.sharedToken,
      },
      body: JSON.stringify({
        action: 'sendSedifexMarketingEmail',
        token: config.sharedToken,
        sharedToken: config.sharedToken,
        fromEmail: config.fromEmail,
        fromName: config.fromName,
        replyTo: config.replyTo,
        subject,
        html,
        text,
        recipients,
        source: 'sedifexadmin_marketing_center',
        campaignOwner: 'sedifex',
      }),
    });

    const responseText = await response.text();
    let parsed: unknown = null;
    try { parsed = JSON.parse(responseText); } catch {}

    if (!response.ok) {
      return NextResponse.json({ ok: false, error: `Sedifex marketing Apps Script returned HTTP ${response.status}.`, detail: responseText.slice(0, 500) }, { status: 502 });
    }

    return NextResponse.json({ ok: true, sentToScript: recipients.length, fromEmail: config.fromEmail, response: parsed ?? responseText.slice(0, 500) });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Unable to send Sedifex marketing email.' }, { status: 500 });
  }
}
