import { paymentReferenceValue } from '@/lib/payment-audit';

export type PaymentAuditEmailResult =
  | { sent: true; recipientCount: number }
  | { sent: false; reason: string };

type EmailOrder = Record<string, unknown>;

type Recipient = { email: string; name?: string };

function text(value: unknown, fallback = '') {
  if (typeof value === 'string') return value.trim() || fallback;
  if (typeof value === 'number') return String(value);
  return fallback;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function email(value: unknown) {
  const cleaned = text(value).toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleaned) ? cleaned : '';
}

function amount(order: EmailOrder) {
  const candidates = [order.finalTotal, order.final_total, order.amountPaid, order.amount, typeof order.amountMinor === 'number' ? order.amountMinor / 100 : undefined];
  const value = candidates.find((candidate) => typeof candidate === 'number' && Number.isFinite(candidate));
  return typeof value === 'number' ? value.toFixed(2) : '—';
}

function customerName(order: EmailOrder) {
  const customer = record(order.customer);
  return text(order.customerName ?? order.customer_name ?? order.buyerName ?? customer.name, 'Unknown customer');
}

function storeName(order: EmailOrder, store: EmailOrder = {}) {
  return text(order.storeName ?? order.merchantName ?? store.displayName ?? store.storeName ?? store.name ?? store.businessName, 'Unknown store');
}

function sourceLabel(order: EmailOrder) {
  return text(order.sourceLabel ?? order.source_label ?? order.sourceChannel ?? order.source_channel ?? order.source, 'Sedifex checkout');
}

function recipientList(order: EmailOrder, store: EmailOrder = {}) {
  const ownerEmail = email(order.storeOwnerEmail ?? order.ownerEmail ?? store.ownerEmail ?? store.email ?? store.adminEmail ?? store.supportEmail ?? store.publicEmail);
  const auditEmail = email(process.env.SEDIFEX_AUDIT_EMAIL || process.env.SEDIFEX_SUPPORT_EMAIL || process.env.SEDIFEX_ADMIN_EMAIL);
  const recipients = [
    ownerEmail ? { email: ownerEmail, name: storeName(order, store) } : null,
    auditEmail ? { email: auditEmail, name: 'Sedifex Audit' } : null,
  ].filter(Boolean) as Recipient[];
  return Array.from(new Map(recipients.map((recipient) => [recipient.email, recipient])).values());
}

function config() {
  return {
    webAppUrl: (process.env.SEDIFEX_MARKETING_APPS_SCRIPT_URL || process.env.MARKETING_APPS_SCRIPT_WEBHOOK_URL || process.env.APPS_SCRIPT_MARKETING_WEBHOOK_URL || '').trim(),
    sharedToken: (process.env.SEDIFEX_MARKETING_SHARED_TOKEN || process.env.MARKETING_APPS_SCRIPT_TOKEN || process.env.SEDIFEX_SHARED_TOKEN || '').trim(),
    fromEmail: (process.env.SEDIFEX_AUDIT_FROM_EMAIL || process.env.SEDIFEX_MARKETING_FROM_EMAIL || process.env.SEDIFEX_FROM_EMAIL || 'sedifexbiz@gmail.com').trim(),
    fromName: (process.env.SEDIFEX_AUDIT_FROM_NAME || 'Sedifex Audit System').trim(),
    replyTo: (process.env.SEDIFEX_AUDIT_REPLY_TO || process.env.SEDIFEX_AUDIT_EMAIL || process.env.SEDIFEX_MARKETING_REPLY_TO || process.env.SEDIFEX_FROM_EMAIL || 'sedifexbiz@gmail.com').trim(),
  };
}

function bodyFor(order: EmailOrder, store: EmailOrder = {}) {
  return `Hello,

Sedifex has received an order, but payment has not been confirmed yet.

Order ID: ${text(order.id ?? order.orderId ?? order.order_id, 'Unknown order')}
Store: ${storeName(order, store)}
Customer: ${customerName(order)}
Amount: ${text(order.currency, 'GHS')} ${amount(order)}
Payment status: ${text(order.paymentStatus ?? order.payment_status, 'missing')}
Payment method: ${text(order.paymentMethod ?? order.payment_method ?? order.paymentCollectionMode ?? order.payment_collection_mode, 'unknown')}
Source: ${sourceLabel(order)}
Reference: ${paymentReferenceValue(order) || '—'}

Please do not mark this order as delivered, completed, or fulfilled until payment is confirmed.

If the customer paid cash, use “Confirm Cash Received”.
If the customer paid online, wait for Paystack/Sedifex payment confirmation.

Sedifex Audit System`;
}

export async function sendPaymentNotConfirmedEmail(order: EmailOrder, store: EmailOrder = {}): Promise<PaymentAuditEmailResult> {
  if (order.paymentNotConfirmedEmailSent === true) return { sent: false, reason: 'already_sent' };
  const settings = config();
  if (!settings.webAppUrl || !settings.sharedToken) return { sent: false, reason: 'email_webhook_not_configured' };
  const recipients = recipientList(order, store);
  if (recipients.length === 0) return { sent: false, reason: 'no_recipients' };

  const textBody = bodyFor(order, store);
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
      subject: 'Sedifex payment alert: Order received but payment not confirmed',
      text: textBody,
      html: `<pre style="font-family:Arial,sans-serif;white-space:pre-wrap">${textBody.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')}</pre>`,
      recipients,
      audience: 'payment_audit',
      source: 'sedifexadmin_payment_audit',
      campaignOwner: 'sedifex',
    }),
  });

  if (!response.ok) return { sent: false, reason: `email_http_${response.status}` };
  return { sent: true, recipientCount: recipients.length };
}
