/**
 * Sedifex Admin Marketing Email Webhook
 *
 * Deploy this file as a Google Apps Script Web App.
 * The Sedifex Admin /admin/marketing page sends campaign payloads here.
 *
 * Required Script Properties:
 *   MARKETING_APPS_SCRIPT_TOKEN = same value as MARKETING_APPS_SCRIPT_TOKEN in Vercel/.env.local
 *
 * Optional Script Properties:
 *   FROM_NAME = Sedifex
 *   REPLY_TO_EMAIL = info@sedifex.com
 *   MAX_RECIPIENTS_PER_CAMPAIGN = 200
 *   SEND_MODE = send  // use "draft" to create Gmail drafts instead of sending
 *   UNSUBSCRIBE_URL = https://sedifex.com/unsubscribe
 *
 * Expected payload:
 * {
 *   source: "sedifexadmin",
 *   type: "marketing_email_campaign",
 *   campaignId: "campaign_123",
 *   audience: "stores" | "customers" | "both",
 *   senderName: "Sedifex",
 *   subject: "Subject",
 *   message: "Message body",
 *   createdAt: "ISO date",
 *   recipientCount: 1,
 *   recipients: [{ id, type, name, email, storeId }],
 *   token: "optional fallback token"
 * }
 */

const LOG_SHEET_NAME = 'Marketing Campaign Logs';
const SEND_LOG_SHEET_NAME = 'Marketing Send Logs';

function doPost(e) {
  try {
    const payload = parsePayload_(e);
    verifyRequest_(e, payload);
    const normalized = normalizeCampaign_(payload);
    const results = processCampaign_(normalized);

    return jsonResponse_({
      ok: true,
      campaignId: normalized.campaignId,
      mode: getSendMode_(),
      acceptedRecipients: normalized.recipients.length,
      sent: results.sent,
      drafted: results.drafted,
      skipped: results.skipped,
      failed: results.failed,
    });
  } catch (error) {
    const message = error && error.message ? error.message : String(error);
    appendCampaignLog_({
      campaignId: 'unknown',
      status: 'error',
      subject: '',
      audience: '',
      recipientCount: 0,
      sent: 0,
      drafted: 0,
      skipped: 0,
      failed: 1,
      error: message,
    });

    return jsonResponse_({ ok: false, error: message }, 400);
  }
}

function doGet() {
  return jsonResponse_({
    ok: true,
    service: 'Sedifex Admin Marketing Email Webhook',
    mode: getSendMode_(),
    timestamp: new Date().toISOString(),
  });
}

function parsePayload_(e) {
  if (!e || !e.postData || !e.postData.contents) {
    throw new Error('Missing request body.');
  }

  try {
    return JSON.parse(e.postData.contents);
  } catch (error) {
    throw new Error('Invalid JSON payload.');
  }
}

function verifyRequest_(e, payload) {
  const expectedToken = getProperty_('MARKETING_APPS_SCRIPT_TOKEN');

  if (!expectedToken) {
    throw new Error('Apps Script token is not configured. Add MARKETING_APPS_SCRIPT_TOKEN in Script Properties.');
  }

  const authHeader = getHeader_(e, 'authorization');
  const bearerToken = authHeader && authHeader.toLowerCase().indexOf('bearer ') === 0
    ? authHeader.slice(7).trim()
    : '';
  const payloadToken = payload && payload.token ? String(payload.token).trim() : '';

  if (bearerToken !== expectedToken && payloadToken !== expectedToken) {
    throw new Error('Unauthorized marketing webhook request.');
  }
}

function normalizeCampaign_(payload) {
  if (!payload || payload.source !== 'sedifexadmin') {
    throw new Error('Invalid source.');
  }

  if (payload.type !== 'marketing_email_campaign') {
    throw new Error('Invalid campaign type.');
  }

  const campaignId = cleanText_(payload.campaignId) || 'campaign_' + Date.now();
  const audience = cleanText_(payload.audience) || 'stores';
  const senderName = cleanText_(payload.senderName) || getProperty_('FROM_NAME') || 'Sedifex';
  const subject = cleanText_(payload.subject);
  const message = cleanText_(payload.message);
  const rawRecipients = Array.isArray(payload.recipients) ? payload.recipients : [];

  if (!subject) throw new Error('Subject is required.');
  if (!message) throw new Error('Message is required.');

  const recipients = dedupeRecipients_(rawRecipients)
    .filter(function (recipient) {
      return isValidEmail_(recipient.email) && isAllowedRecipient_(recipient);
    });

  const maxRecipients = Number(getProperty_('MAX_RECIPIENTS_PER_CAMPAIGN') || 200);
  if (recipients.length === 0) {
    throw new Error('No valid recipients were provided.');
  }

  if (recipients.length > maxRecipients) {
    throw new Error('Recipient limit exceeded. Limit is ' + maxRecipients + ' per campaign.');
  }

  return {
    campaignId: campaignId,
    audience: audience,
    senderName: senderName,
    subject: subject,
    message: message,
    createdAt: cleanText_(payload.createdAt) || new Date().toISOString(),
    recipients: recipients,
  };
}

function processCampaign_(campaign) {
  const mode = getSendMode_();
  const replyTo = getProperty_('REPLY_TO_EMAIL') || '';
  let sent = 0;
  let drafted = 0;
  let skipped = 0;
  let failed = 0;

  campaign.recipients.forEach(function (recipient) {
    try {
      const personalizedText = personalizeMessage_(campaign.message, recipient);
      const htmlBody = buildHtmlEmail_(campaign, recipient, personalizedText);
      const plainBody = buildPlainTextEmail_(campaign, recipient, personalizedText);

      if (hasRecipientAlreadyReceived_(campaign.campaignId, recipient.email)) {
        skipped += 1;
        appendSendLog_(campaign, recipient, 'skipped_duplicate', 'Already processed for this campaign.');
        return;
      }

      if (mode === 'draft') {
        GmailApp.createDraft(recipient.email, campaign.subject, plainBody, {
          htmlBody: htmlBody,
          name: campaign.senderName,
          replyTo: replyTo || undefined,
        });
        drafted += 1;
        appendSendLog_(campaign, recipient, 'drafted', 'Draft created.');
      } else {
        MailApp.sendEmail({
          to: recipient.email,
          subject: campaign.subject,
          body: plainBody,
          htmlBody: htmlBody,
          name: campaign.senderName,
          replyTo: replyTo || undefined,
        });
        sent += 1;
        appendSendLog_(campaign, recipient, 'sent', 'Email sent.');
      }
    } catch (error) {
      failed += 1;
      appendSendLog_(campaign, recipient, 'failed', error && error.message ? error.message : String(error));
    }
  });

  appendCampaignLog_({
    campaignId: campaign.campaignId,
    status: failed > 0 ? 'completed_with_errors' : 'completed',
    subject: campaign.subject,
    audience: campaign.audience,
    recipientCount: campaign.recipients.length,
    sent: sent,
    drafted: drafted,
    skipped: skipped,
    failed: failed,
    error: '',
  });

  return { sent: sent, drafted: drafted, skipped: skipped, failed: failed };
}

function personalizeMessage_(message, recipient) {
  return String(message)
    .replace(/{{\s*name\s*}}/gi, recipient.name || 'there')
    .replace(/{{\s*email\s*}}/gi, recipient.email || '')
    .replace(/{{\s*storeId\s*}}/gi, recipient.storeId || '')
    .replace(/{{\s*type\s*}}/gi, recipient.type || 'recipient');
}

function buildHtmlEmail_(campaign, recipient, message) {
  const escapedMessage = escapeHtml_(message).replace(/\n/g, '<br>');
  const unsubscribeUrl = getProperty_('UNSUBSCRIBE_URL');
  const unsubscribeHtml = unsubscribeUrl
    ? '<p style="font-size:12px;color:#64748b;margin-top:24px">To stop receiving updates, visit <a href="' + escapeHtml_(unsubscribeUrl) + '">unsubscribe</a>.</p>'
    : '<p style="font-size:12px;color:#64748b;margin-top:24px">You are receiving this because your email is connected to Sedifex store/customer updates.</p>';

  return '' +
    '<div style="margin:0;padding:0;background:#f8fafc;font-family:Arial,sans-serif;color:#0f172a">' +
      '<div style="max-width:640px;margin:0 auto;padding:24px">' +
        '<div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:18px;padding:24px">' +
          '<p style="margin:0 0 16px;font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:#4f46e5;font-weight:700">Sedifex</p>' +
          '<h1 style="margin:0 0 18px;font-size:22px;line-height:1.3;color:#0f172a">' + escapeHtml_(campaign.subject) + '</h1>' +
          '<div style="font-size:15px;line-height:1.7;color:#334155">' + escapedMessage + '</div>' +
          unsubscribeHtml +
        '</div>' +
        '<p style="font-size:12px;color:#94a3b8;margin:16px 0 0;text-align:center">Campaign ID: ' + escapeHtml_(campaign.campaignId) + '</p>' +
      '</div>' +
    '</div>';
}

function buildPlainTextEmail_(campaign, recipient, message) {
  const unsubscribeUrl = getProperty_('UNSUBSCRIBE_URL');
  const footer = unsubscribeUrl
    ? '\n\nTo stop receiving updates, visit: ' + unsubscribeUrl
    : '\n\nYou are receiving this because your email is connected to Sedifex store/customer updates.';

  return message + footer + '\n\nCampaign ID: ' + campaign.campaignId;
}

function dedupeRecipients_(recipients) {
  const seen = {};
  const output = [];

  recipients.forEach(function (item) {
    const recipient = {
      id: cleanText_(item.id),
      type: cleanText_(item.type) || 'customer',
      name: cleanText_(item.name) || cleanText_(item.email),
      email: cleanText_(item.email).toLowerCase(),
      storeId: cleanText_(item.storeId),
    };

    if (!recipient.email || seen[recipient.email]) return;
    seen[recipient.email] = true;
    output.push(recipient);
  });

  return output;
}

function isAllowedRecipient_(recipient) {
  // If the admin app later sends opt-in metadata, enforce it here.
  // For now, reject obvious placeholder/test addresses.
  const email = String(recipient.email || '').toLowerCase();
  if (email.indexOf('example.com') !== -1) return false;
  if (email.indexOf('test@') === 0) return false;
  return true;
}

function hasRecipientAlreadyReceived_(campaignId, email) {
  const sheet = getSheet_(SEND_LOG_SHEET_NAME, [
    'timestamp', 'campaignId', 'recipientType', 'recipientName', 'recipientEmail', 'storeId', 'status', 'message'
  ]);
  const values = sheet.getDataRange().getValues();

  for (let i = 1; i < values.length; i++) {
    if (String(values[i][1]) === String(campaignId) && String(values[i][4]).toLowerCase() === String(email).toLowerCase()) {
      return true;
    }
  }

  return false;
}

function appendCampaignLog_(entry) {
  const sheet = getSheet_(LOG_SHEET_NAME, [
    'timestamp', 'campaignId', 'status', 'subject', 'audience', 'recipientCount', 'sent', 'drafted', 'skipped', 'failed', 'error'
  ]);
  sheet.appendRow([
    new Date(),
    entry.campaignId,
    entry.status,
    entry.subject,
    entry.audience,
    entry.recipientCount,
    entry.sent,
    entry.drafted,
    entry.skipped,
    entry.failed,
    entry.error,
  ]);
}

function appendSendLog_(campaign, recipient, status, message) {
  const sheet = getSheet_(SEND_LOG_SHEET_NAME, [
    'timestamp', 'campaignId', 'recipientType', 'recipientName', 'recipientEmail', 'storeId', 'status', 'message'
  ]);
  sheet.appendRow([
    new Date(),
    campaign.campaignId,
    recipient.type,
    recipient.name,
    recipient.email,
    recipient.storeId,
    status,
    message,
  ]);
}

function getSheet_(name, headers) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet() || SpreadsheetApp.create('Sedifex Marketing Logs');
  let sheet = spreadsheet.getSheetByName(name);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(name);
    sheet.appendRow(headers);
  }

  return sheet;
}

function getSendMode_() {
  const mode = String(getProperty_('SEND_MODE') || 'send').toLowerCase();
  return mode === 'draft' ? 'draft' : 'send';
}

function getProperty_(name) {
  return PropertiesService.getScriptProperties().getProperty(name);
}

function getHeader_(e, name) {
  if (!e || !e.headers) return '';
  const target = String(name).toLowerCase();
  const keys = Object.keys(e.headers);

  for (let i = 0; i < keys.length; i++) {
    if (String(keys[i]).toLowerCase() === target) return String(e.headers[keys[i]] || '');
  }

  return '';
}

function cleanText_(value) {
  return value === null || value === undefined ? '' : String(value).trim();
}

function isValidEmail_(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || ''));
}

function escapeHtml_(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function jsonResponse_(payload, statusCode) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

function testMarketingWebhookDraft_() {
  PropertiesService.getScriptProperties().setProperty('SEND_MODE', 'draft');

  const fakeEvent = {
    headers: {
      authorization: 'Bearer ' + getProperty_('MARKETING_APPS_SCRIPT_TOKEN'),
    },
    postData: {
      contents: JSON.stringify({
        source: 'sedifexadmin',
        type: 'marketing_email_campaign',
        campaignId: 'test_' + Date.now(),
        audience: 'stores',
        senderName: 'Sedifex',
        subject: 'Test Sedifex marketing campaign',
        message: 'Hello {{name}},\n\nThis is a test campaign from Sedifex Admin.',
        createdAt: new Date().toISOString(),
        recipients: [
          { id: 'test-recipient', type: 'store', name: 'Test Store', email: Session.getActiveUser().getEmail(), storeId: 'test-store' }
        ],
      }),
    },
  };

  Logger.log(doPost(fakeEvent).getContent());
}
