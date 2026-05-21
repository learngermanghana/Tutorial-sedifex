import { NextResponse } from 'next/server';
import { getBulkEmailIntegrationForStore } from '../../../../../lib/marketing-contacts';

type Recipient = {
  name?: string;
  email?: string;
  phone?: string;
  source?: string;
  role?: string;
};

type RequestBody = {
  storeId?: string;
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
  for (const item of recipients.slice(0, 1000)) {
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
    });
  }
  return Array.from(deduped.values());
}

function plainTextFromHtml(html: string) {
  return html.replace(/<br\s*\/?\s*>/gi, '\n').replace(/<\/p>/gi, '\n\n').replace(/<[^>]+>/g, '').replace(/\n{3,}/g, '\n\n').trim();
}

export async function POST(req: Request) {
  const role = cookieValue(req, 'sedifex_admin_role');
  if (!isAllowedRole(role)) {
    return NextResponse.json({ ok: false, error: 'You do not have permission to send marketing emails.' }, { status: 403 });
  }

  const body = await req.json().catch(() => null) as RequestBody | null;
  const storeId = cleanText(body?.storeId);
  const subject = cleanText(body?.subject);
  const html = cleanText(body?.html);
  const text = cleanText(body?.text) || plainTextFromHtml(html);
  const recipients = sanitizeRecipients(body?.recipients);

  if (!storeId) return NextResponse.json({ ok: false, error: 'Select the sending store.' }, { status: 400 });
  if (!subject) return NextResponse.json({ ok: false, error: 'Subject is required.' }, { status: 400 });
  if (!html && !text) return NextResponse.json({ ok: false, error: 'Email body is required.' }, { status: 400 });
  if (recipients.length === 0) return NextResponse.json({ ok: false, error: 'Select at least one valid recipient.' }, { status: 400 });

  try {
    const integration = await getBulkEmailIntegrationForStore(storeId);
    const response = await fetch(integration.webAppUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-sedifex-shared-token': integration.sharedToken,
      },
      body: JSON.stringify({
        action: 'sendBulkEmail',
        token: integration.sharedToken,
        sharedToken: integration.sharedToken,
        fromName: integration.fromName,
        subject,
        html,
        text,
        recipients,
        source: 'sedifexadmin_marketing_center',
      }),
    });

    const responseText = await response.text();
    let parsed: unknown = null;
    try { parsed = JSON.parse(responseText); } catch {}

    if (!response.ok) {
      return NextResponse.json({ ok: false, error: `Apps Script returned HTTP ${response.status}.`, detail: responseText.slice(0, 500) }, { status: 502 });
    }

    return NextResponse.json({ ok: true, sentToScript: recipients.length, response: parsed ?? responseText.slice(0, 500) });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Unable to send marketing email.' }, { status: 500 });
  }
}
