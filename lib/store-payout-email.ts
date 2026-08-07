import { paymentReferenceValue } from '@/lib/payment-audit';

type EmailOrder = Record<string, unknown>;
type Recipient = { email: string; name?: string };
type WebhookResult = { ok?: unknown; error?: unknown };

export type StorePayoutEmailResult =
  | { sent: true; recipientCount: number }
  | { sent: false; reason: string };

function text(value: unknown, fallback = '') {
  if (typeof value === 'string') return value.trim() || fallback;
  if (typeof value === 'number') return String(value);
  return fallback;
}

function email(value: unknown) {
  const cleaned = text(value).toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleaned) ? cleaned : '';
}

function amount(order: EmailOrder) {
  const candidates = [
    order.finalTotal,
    order.final_total,
    order.amountPaid,
    order.amount_paid,
    order.totalAmount,
    order.total_amount,
    order.amount,
    typeof order.amountMinor === 'number' ? order.amountMinor / 100 : undefined,
  ];
  const value = candidates.find((candidate) => typeof candidate === 'number' && Number.isFinite(candidate));
  return typeof value === 'number' ? value.toFixed(2) : '—';
}

function storeName(order: EmailOrder, store: EmailOrder = {}) {
  return text(order.storeName ?? order.merchantName ?? store.displayName ?? store.storeName ?? store.name ?? store.businessName, 'Store');
}

function recipientList(order: EmailOrder, store: EmailOrder = {}) {
  const ownerEmail = email(
    order.storeOwnerEmail ??
    order.ownerEmail ??
    store.ownerEmail ??
    store.email ??
    store.adminEmail ??
    store.supportEmail ??
    store.publicEmail,
  );
  if (!ownerEmail) return [] as Recipient[];
  return [{ email: ownerEmail, name: storeName(order, store) }];
}

function config() {
  return {
    webAppUrl: (process.env.SEDIFEX_MARKETING_APPS_SCRIPT_URL || process.env.MARKETING_APPS_SCRIPT_WEBHOOK_URL || process.env.APPS_SCRIPT_MARKETING_WEBHOOK_URL || '').trim(),
    sharedToken: (process.env.SEDIFEX_MARKETING_SHARED_TOKEN || process.env.MARKETING_APPS_SCRIPT_TOKEN || process.env.SEDIFEX_SHARED_TOKEN || '').trim(),
    fromEmail: (process.env.SEDIFEX_AUDIT_FROM_EMAIL || process.env.SEDIFEX_MARKETING_FROM_EMAIL || process.env.SEDIFEX_FROM_EMAIL || 'sedifexbiz@gmail.com').trim(),
    fromName: (process.env.SEDIFEX_AUDIT_FROM_NAME || 'Sedifex').trim(),
    replyTo: (process.env.SEDIFEX_AUDIT_REPLY_TO || process.env.SEDIFEX_AUDIT_EMAIL || process.env.SEDIFEX_MARKETING_REPLY_TO || process.env.SEDIFEX_FROM_EMAIL || 'sedifexbiz@gmail.com').trim(),
  };
}

function payoutBody(order: EmailOrder, store: EmailOrder = {}) {
  return `Hello ${storeName(order, store)},

Sedifex has marked your payout for this order as paid.

Order ID: ${text(order.id ?? order.orderId ?? order.order_id, 'Unknown order')}
Store: ${storeName(order, store)}
Amount: ${text(order.currency, 'GHS')} ${amount(order)}
Settlement status: paid
Reference: ${paymentReferenceValue(order) || '—'}

The payment to your business has been recorded as completed by Sedifex Admin. If you do not see the funds in the expected account or mobile money wallet, please contact Sedifex support and include the order ID above.

Sedifex`;
}

export async function sendStorePayoutEmail(order: EmailOrder, store: EmailOrder = {}): Promise<StorePayoutEmailResult> {
  if (order.storePayoutEmailSent === true) return { sent: false, reason: 'already_sent' };

  const settings = config();
  if (!settings.webAppUrl || !settings.sharedToken) return { sent: false, reason: 'email_webhook_not_configured' };

  const recipients = recipientList(order, store);
  if (recipients.length === 0) return { sent: false, reason: 'no_store_recipient' };

  const textBody = payoutBody(order, store);
  const response = await fetch(settings.webAppUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-sedifex-shared-token': settings.sharedToken,
    },
    body: JSON.stringify({
      action: 'sendSedifexMarketingEmail',
      token: settings.sharedToken,
      sharedToken: settings.sharedToken,
      fromEmail: settings.fromEmail,
      fromName: settings.fromName,
      replyTo: settings.replyTo,
      senderName: settings.fromName,
      senderEmail: settings.fromEmail,
      subject: 'Sedifex payout paid: Your store has been paid',
      text: textBody,
      html: `<pre style="font-family:Arial,sans-serif;white-space:pre-wrap">${textBody.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')}</pre>`,
      recipients,
      audience: 'store_payout_paid',
      source: 'sedifexadmin',
      campaignOwner: 'sedifex',
    }),
  });

  if (!response.ok) return { sent: false, reason: `email_http_${response.status}` };

  let webhookResult: WebhookResult;
  try {
    webhookResult = await response.json() as WebhookResult;
  } catch {
    return { sent: false, reason: 'email_invalid_webhook_response' };
  }

  if (webhookResult.ok !== true) {
    const webhookError = text(webhookResult.error, 'rejected');
    return { sent: false, reason: `email_webhook_${webhookError}` };
  }

  return { sent: true, recipientCount: recipients.length };
}
