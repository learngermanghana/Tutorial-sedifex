/**
 * Sedifex Professional Marketing Email Webhook
 *
 * Paste this file into Google Apps Script and deploy it as a Web App.
 * It receives campaigns from Sedifex Admin /admin/marketing and sends branded emails.
 *
 * Required Script Property:
 *   MARKETING_APPS_SCRIPT_TOKEN = same secret used in Sedifex Admin/Vercel
 *
 * Recommended Script Properties:
 *   SEND_MODE = draft                         // draft first, then change to send
 *   FROM_NAME = Sedifex Market
 *   REPLY_TO_EMAIL = sedifexbiz@gmail.com
 *   MAX_RECIPIENTS_PER_CAMPAIGN = 200
 *   BRAND_NAME = Sedifex
 *   BRAND_TAGLINE = Business operations made easier
 *   BRAND_PRIMARY_COLOR = #4f46e5
 *   BRAND_DARK_COLOR = #0f172a
 *   BRAND_ACCENT_COLOR = #06b6d4
 *   BRAND_WEBSITE_URL = https://sedifexmarket.com
 *   BRAND_LOGO_URL =
 *   BRAND_ADDRESS = Ghana
 *   UNSUBSCRIBE_URL = https://sedifexmarket.com/unsubscribe
 *   LOG_SPREADSHEET_ID = optional spreadsheet id for logs
 *
 * Useful test functions:
 *   setupSedifexMarketingProperties_()
 *   testSedifexMarketingDraft_()
 */

const LOG_SHEET_NAME = 'Marketing Campaign Logs';
const SEND_LOG_SHEET_NAME = 'Marketing Send Logs';
const QUEUE_SHEET_NAME = 'Marketing Send Queue';
const DEFAULT_MAX_RECIPIENTS = 200;
const DEFAULT_QUEUE_BATCH_SIZE = 35;

function doGet() {
  return jsonResponse_({
    ok: true,
    service: 'Sedifex Professional Marketing Email Webhook',
    mode: getSendMode_(),
    brand: getBrandConfig_().brandName,
    timestamp: new Date().toISOString(),
  });
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const payload = parsePayload_(e);
    verifyRequest_(e, payload);

    const campaign = normalizeCampaign_(payload);
    const shouldQueue = payload.processAsync !== false;
    const result = shouldQueue ? queueCampaign_(campaign) : processCampaign_(campaign);

    return jsonResponse_({
      ok: true,
      campaignId: campaign.campaignId,
      mode: getSendMode_(),
      acceptedRecipients: campaign.recipients.length,
      queued: shouldQueue ? result.queued : 0,
      processedNow: shouldQueue ? 0 : campaign.recipients.length,
      sent: result.sent || 0,
      drafted: result.drafted || 0,
      skipped: result.skipped || 0,
      failed: result.failed || 0,
      logSpreadsheetUrl: getLogSpreadsheet_().getUrl(),
    });
  } catch (error) {
    const message = error && error.message ? error.message : String(error);
    appendCampaignLog_({
      campaignId: 'unknown',
      status: 'error',
      subject: '',
      audience: '',
      senderName: '',
      recipientCount: 0,
      sent: 0,
      drafted: 0,
      skipped: 0,
      failed: 1,
      error: message,
    });

    return jsonResponse_({ ok: false, error: message });
  } finally {
    lock.releaseLock();
  }
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
    throw new Error('MARKETING_APPS_SCRIPT_TOKEN is missing in Apps Script Project Settings > Script Properties.');
  }

  const authHeader = getHeader_(e, 'authorization');
  const bearerToken = authHeader && authHeader.toLowerCase().indexOf('bearer ') === 0 ? authHeader.slice(7).trim() : '';
  const xToken = getHeader_(e, 'x-sedifex-shared-token');
  const payloadToken = cleanText_(payload.token);
  const payloadSharedToken = cleanText_(payload.sharedToken);

  if (
    bearerToken !== expectedToken &&
    xToken !== expectedToken &&
    payloadToken !== expectedToken &&
    payloadSharedToken !== expectedToken
  ) {
    throw new Error('Unauthorized marketing webhook request. Token does not match.');
  }
}

function normalizeCampaign_(payload) {
  if (!payload || typeof payload !== 'object') throw new Error('Payload must be an object.');

  const source = cleanText_(payload.source) || 'sedifexadmin_marketing_center';
  const action = cleanText_(payload.action);
  const type = cleanText_(payload.type) || 'marketing_email_campaign';

  const isSupportedSource = source === 'sedifexadmin' || source === 'sedifexadmin_marketing_center';
  const isSupportedAction = !action || action === 'sendSedifexMarketingEmail';
  const isSupportedType = !type || type === 'marketing_email_campaign';

  if (!isSupportedSource) throw new Error('Invalid campaign source: ' + source);
  if (!isSupportedAction) throw new Error('Invalid action: ' + action);
  if (!isSupportedType) throw new Error('Invalid campaign type: ' + type);

  const brand = getBrandConfig_();
  const campaignId = cleanText_(payload.campaignId) || 'campaign_' + Date.now();
  const audience = cleanText_(payload.audience) || cleanText_(payload.campaignOwner) || 'selected_contacts';
  const senderName = cleanText_(payload.senderName) || cleanText_(payload.fromName) || getProperty_('FROM_NAME') || brand.brandName;
  const replyTo = cleanText_(payload.replyTo) || getProperty_('REPLY_TO_EMAIL') || '';
  const fromEmail = cleanText_(payload.fromEmail) || getProperty_('FROM_EMAIL') || '';
  const subject = cleanText_(payload.subject);
  const textBody = cleanText_(payload.text) || htmlToText_(cleanText_(payload.html)) || cleanText_(payload.message);
  const callToActionUrl = cleanText_(payload.ctaUrl) || getProperty_('CTA_URL') || brand.websiteUrl;
  const callToActionLabel = cleanText_(payload.ctaLabel) || getProperty_('CTA_LABEL') || 'Visit Sedifex';

  if (!subject) throw new Error('Subject is required.');
  if (!textBody) throw new Error('Email body is required.');

  const recipients = dedupeRecipients_(payload.recipients)
    .filter(function (recipient) { return isValidEmail_(recipient.email); })
    .filter(function (recipient) { return isAllowedRecipient_(recipient); });

  const maxRecipients = Number(getProperty_('MAX_RECIPIENTS_PER_CAMPAIGN') || DEFAULT_MAX_RECIPIENTS);
  if (recipients.length === 0) throw new Error('No valid recipients were provided.');
  if (recipients.length > maxRecipients) throw new Error('Recipient limit exceeded. Limit is ' + maxRecipients + ' per campaign.');

  return {
    campaignId: campaignId,
    audience: audience,
    senderName: senderName,
    fromEmail: fromEmail,
    replyTo: replyTo,
    subject: subject,
    textBody: textBody,
    callToActionUrl: callToActionUrl,
    callToActionLabel: callToActionLabel,
    createdAt: cleanText_(payload.createdAt) || new Date().toISOString(),
    recipients: recipients,
    brand: brand,
  };
}

function queueCampaign_(campaign) {
  const sheet = getQueueSheet_();
  const now = new Date();
  const rows = campaign.recipients.map(function (recipient) {
    return [
      now,
      campaign.campaignId,
      'pending',
      campaign.subject,
      campaign.audience,
      campaign.senderName,
      campaign.fromEmail,
      campaign.replyTo,
      campaign.textBody,
      campaign.callToActionUrl,
      campaign.callToActionLabel,
      JSON.stringify(campaign.brand),
      JSON.stringify(recipient),
      '',
      '',
    ];
  });

  if (rows.length > 0) {
    sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
  }

  appendCampaignLog_({
    campaignId: campaign.campaignId,
    status: 'queued',
    subject: campaign.subject,
    audience: campaign.audience,
    senderName: campaign.senderName,
    recipientCount: campaign.recipients.length,
    sent: 0,
    drafted: 0,
    skipped: 0,
    failed: 0,
    error: '',
  });

  ensureQueueTrigger_();
  return { queued: rows.length };
}

function processQueuedMarketingEmails() {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const sheet = getQueueSheet_();
    const values = sheet.getDataRange().getValues();
    const batchSize = Number(getProperty_('QUEUE_BATCH_SIZE') || DEFAULT_QUEUE_BATCH_SIZE);
    let processed = 0;

    for (let i = 1; i < values.length && processed < batchSize; i++) {
      if (String(values[i][2]) !== 'pending') continue;
      const rowNumber = i + 1;
      sheet.getRange(rowNumber, 3).setValue('processing');

      try {
        const campaign = campaignFromQueueRow_(values[i]);
        const result = processCampaign_({
          campaignId: campaign.campaignId,
          audience: campaign.audience,
          senderName: campaign.senderName,
          fromEmail: campaign.fromEmail,
          replyTo: campaign.replyTo,
          subject: campaign.subject,
          textBody: campaign.textBody,
          callToActionUrl: campaign.callToActionUrl,
          callToActionLabel: campaign.callToActionLabel,
          createdAt: new Date().toISOString(),
          recipients: [campaign.recipient],
          brand: campaign.brand,
        });
        sheet.getRange(rowNumber, 3).setValue('processed');
        sheet.getRange(rowNumber, 14, 1, 2).setValues([[new Date(), JSON.stringify(result)]]);
      } catch (error) {
        sheet.getRange(rowNumber, 3).setValue('failed');
        sheet.getRange(rowNumber, 14, 1, 2).setValues([[new Date(), error && error.message ? error.message : String(error)]]);
      }

      processed += 1;
    }

    if (hasPendingQueueRows_(sheet)) ensureQueueTrigger_();
  } finally {
    lock.releaseLock();
  }
}

function campaignFromQueueRow_(row) {
  return {
    campaignId: String(row[1]),
    subject: String(row[3]),
    audience: String(row[4]),
    senderName: String(row[5]),
    fromEmail: String(row[6]),
    replyTo: String(row[7]),
    textBody: String(row[8]),
    callToActionUrl: String(row[9]),
    callToActionLabel: String(row[10]),
    brand: JSON.parse(String(row[11])),
    recipient: JSON.parse(String(row[12])),
  };
}

function getQueueSheet_() {
  return getSheet_(QUEUE_SHEET_NAME, [
    'timestamp', 'campaignId', 'status', 'subject', 'audience', 'senderName', 'fromEmail', 'replyTo', 'textBody', 'callToActionUrl', 'callToActionLabel', 'brandJson', 'recipientJson', 'processedAt', 'message'
  ]);
}

function ensureQueueTrigger_() {
  const handler = 'processQueuedMarketingEmails';
  const existing = ScriptApp.getProjectTriggers().some(function (trigger) {
    return trigger.getHandlerFunction() === handler;
  });
  if (!existing) ScriptApp.newTrigger(handler).timeBased().after(60 * 1000).create();
}

function hasPendingQueueRows_(sheet) {
  const values = sheet.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][2]) === 'pending') return true;
  }
  return false;
}

function processCampaign_(campaign) {
  const mode = getSendMode_();
  let sent = 0;
  let drafted = 0;
  let skipped = 0;
  let failed = 0;

  campaign.recipients.forEach(function (recipient) {
    try {
      if (hasRecipientAlreadyReceived_(campaign.campaignId, recipient.email)) {
        skipped += 1;
        appendSendLog_(campaign, recipient, 'skipped_duplicate', 'Already processed for this campaign.');
        return;
      }

      const personalizedText = personalizeText_(campaign.textBody, recipient, campaign);
      const personalizedSubject = personalizeText_(campaign.subject, recipient, campaign);
      const plainBody = buildPlainTextEmail_(campaign, recipient, personalizedText);
      const htmlBody = buildProfessionalHtmlEmail_(campaign, recipient, personalizedSubject, personalizedText);
      const mailOptions = buildMailOptions_(campaign, htmlBody);

      if (mode === 'draft') {
        GmailApp.createDraft(recipient.email, personalizedSubject, plainBody, mailOptions);
        drafted += 1;
        appendSendLog_(campaign, recipient, 'drafted', 'Draft created.');
      } else {
        MailApp.sendEmail({
          to: recipient.email,
          subject: personalizedSubject,
          body: plainBody,
          htmlBody: htmlBody,
          name: campaign.senderName,
          replyTo: campaign.replyTo || undefined,
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
    senderName: campaign.senderName,
    recipientCount: campaign.recipients.length,
    sent: sent,
    drafted: drafted,
    skipped: skipped,
    failed: failed,
    error: '',
  });

  return { sent: sent, drafted: drafted, skipped: skipped, failed: failed };
}

function buildMailOptions_(campaign, htmlBody) {
  const options = {
    htmlBody: htmlBody,
    name: campaign.senderName,
  };

  if (campaign.replyTo) options.replyTo = campaign.replyTo;
  return options;
}

function buildProfessionalHtmlEmail_(campaign, recipient, subject, message) {
  const brand = campaign.brand;
  const greetingName = recipient.name || 'there';
  const preheader = truncate_(stripText_(message), 120);
  const messageHtml = paragraphsToHtml_(message);
  const unsubscribeUrl = getUnsubscribeUrl_(recipient);
  const logoHtml = brand.logoUrl
    ? '<img src="' + escapeAttr_(brand.logoUrl) + '" alt="' + escapeAttr_(brand.brandName) + '" style="display:block;max-width:148px;max-height:52px;border:0;outline:none;text-decoration:none;" />'
    : '<div style="display:inline-flex;align-items:center;justify-content:center;width:52px;height:52px;border-radius:18px;background:' + brand.primaryColor + ';color:#ffffff;font-size:24px;font-weight:800;letter-spacing:-0.04em;">S</div>';

  const ctaHtml = campaign.callToActionUrl
    ? '<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:28px 0 6px;"><tr><td style="border-radius:14px;background:' + brand.primaryColor + ';"><a href="' + escapeAttr_(campaign.callToActionUrl) + '" target="_blank" style="display:inline-block;padding:14px 22px;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;border-radius:14px;">' + escapeHtml_(campaign.callToActionLabel) + '</a></td></tr></table>'
    : '';

  const unsubscribeHtml = unsubscribeUrl
    ? '<a href="' + escapeAttr_(unsubscribeUrl) + '" target="_blank" style="color:#64748b;text-decoration:underline;">unsubscribe here</a>'
    : 'reply to this email and ask to be removed';

  return '' +
    '<!doctype html>' +
    '<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + escapeHtml_(subject) + '</title></head>' +
    '<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">' +
      '<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">' + escapeHtml_(preheader) + '</div>' +
      '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f1f5f9;margin:0;padding:0;width:100%;">' +
        '<tr><td align="center" style="padding:28px 14px;">' +
          '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:680px;width:100%;border-collapse:collapse;">' +
            '<tr><td style="background:' + brand.darkColor + ';border-radius:28px 28px 0 0;padding:28px 28px 24px;">' +
              '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr>' +
                '<td style="vertical-align:middle;">' + logoHtml + '</td>' +
                '<td align="right" style="vertical-align:middle;color:#cbd5e1;font-size:12px;line-height:1.5;">' + escapeHtml_(brand.tagline) + '</td>' +
              '</tr></table>' +
              '<div style="margin-top:24px;padding:16px;border-radius:22px;background:linear-gradient(135deg,' + brand.primaryColor + ', ' + brand.accentColor + ');">' +
                '<p style="margin:0;color:#e0e7ff;font-size:12px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;">' + escapeHtml_(brand.brandName) + ' Update</p>' +
                '<h1 style="margin:10px 0 0;color:#ffffff;font-size:28px;line-height:1.25;font-weight:800;letter-spacing:-0.03em;">' + escapeHtml_(subject) + '</h1>' +
              '</div>' +
            '</td></tr>' +
            '<tr><td style="background:#ffffff;padding:30px 28px;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;">' +
              '<p style="margin:0 0 18px;font-size:16px;line-height:1.7;color:#0f172a;">Hello ' + escapeHtml_(greetingName) + ',</p>' +
              '<div style="font-size:16px;line-height:1.75;color:#334155;">' + messageHtml + '</div>' +
              ctaHtml +
              '<div style="margin-top:28px;padding:18px;border-radius:20px;background:#f8fafc;border:1px solid #e2e8f0;">' +
                '<p style="margin:0;color:#0f172a;font-size:14px;font-weight:700;">Need help?</p>' +
                '<p style="margin:6px 0 0;color:#64748b;font-size:13px;line-height:1.6;">Reply to this email and our team will assist you. You can also visit <a href="' + escapeAttr_(brand.websiteUrl) + '" target="_blank" style="color:' + brand.primaryColor + ';font-weight:700;text-decoration:none;">' + escapeHtml_(brand.websiteUrl.replace(/^https?:\/\//, '')) + '</a>.</p>' +
              '</div>' +
            '</td></tr>' +
            '<tr><td style="background:#ffffff;border-radius:0 0 28px 28px;padding:0 28px 28px;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;border-bottom:1px solid #e2e8f0;">' +
              '<div style="border-top:1px solid #e2e8f0;padding-top:20px;">' +
                '<p style="margin:0;color:#94a3b8;font-size:12px;line-height:1.7;">You are receiving this email because your address is connected to ' + escapeHtml_(brand.brandName) + ', a Sedifex store, order, booking, or customer record. To stop marketing updates, ' + unsubscribeHtml + '.</p>' +
                '<p style="margin:12px 0 0;color:#94a3b8;font-size:12px;line-height:1.7;">' + escapeHtml_(brand.brandName) + ' · ' + escapeHtml_(brand.address) + ' · Campaign ID: ' + escapeHtml_(campaign.campaignId) + '</p>' +
              '</div>' +
            '</td></tr>' +
          '</table>' +
        '</td></tr>' +
      '</table>' +
    '</body></html>';
}

function buildPlainTextEmail_(campaign, recipient, message) {
  const brand = campaign.brand;
  const unsubscribeUrl = getUnsubscribeUrl_(recipient);
  return '' +
    campaign.subject + '\n\n' +
    'Hello ' + (recipient.name || 'there') + ',\n\n' +
    message + '\n\n' +
    (campaign.callToActionUrl ? campaign.callToActionLabel + ': ' + campaign.callToActionUrl + '\n\n' : '') +
    'Need help? Reply to this email or visit ' + brand.websiteUrl + '\n\n' +
    'To stop marketing updates, ' + (unsubscribeUrl || 'reply and ask to be removed') + '\n\n' +
    brand.brandName + ' · ' + brand.address + '\n' +
    'Campaign ID: ' + campaign.campaignId;
}

function personalizeText_(value, recipient, campaign) {
  const now = new Date();
  return String(value || '')
    .replace(/{{\s*name\s*}}/gi, recipient.name || 'there')
    .replace(/{{\s*email\s*}}/gi, recipient.email || '')
    .replace(/{{\s*phone\s*}}/gi, recipient.phone || '')
    .replace(/{{\s*storeId\s*}}/gi, recipient.storeId || '')
    .replace(/{{\s*storeName\s*}}/gi, recipient.storeName || '')
    .replace(/{{\s*source\s*}}/gi, recipient.source || recipient.type || '')
    .replace(/{{\s*role\s*}}/gi, recipient.role || '')
    .replace(/{{\s*type\s*}}/gi, recipient.type || recipient.role || 'recipient')
    .replace(/{{\s*brandName\s*}}/gi, campaign.brand.brandName)
    .replace(/{{\s*date\s*}}/gi, Utilities.formatDate(now, Session.getScriptTimeZone(), 'dd MMM yyyy'));
}

function dedupeRecipients_(recipients) {
  const raw = Array.isArray(recipients) ? recipients : [];
  const seen = {};
  const output = [];

  raw.forEach(function (item) {
    if (!item || typeof item !== 'object') return;

    const email = cleanText_(item.email).toLowerCase();
    if (!email || seen[email]) return;

    seen[email] = true;
    output.push({
      id: cleanText_(item.id),
      type: cleanText_(item.type) || cleanText_(item.source) || 'contact',
      name: cleanText_(item.name) || email.split('@')[0],
      email: email,
      phone: cleanText_(item.phone),
      source: cleanText_(item.source),
      role: cleanText_(item.role),
      storeId: cleanText_(item.storeId),
      storeName: cleanText_(item.storeName),
    });
  });

  return output;
}

function isAllowedRecipient_(recipient) {
  const email = String(recipient.email || '').toLowerCase();
  if (!email) return false;
  if (email.indexOf('@example.') !== -1) return false;
  if (email.indexOf('test@') === 0 && getSendMode_() === 'send') return false;
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
    'timestamp', 'campaignId', 'status', 'subject', 'audience', 'senderName', 'recipientCount', 'sent', 'drafted', 'skipped', 'failed', 'error'
  ]);

  sheet.appendRow([
    new Date(),
    entry.campaignId,
    entry.status,
    entry.subject,
    entry.audience,
    entry.senderName,
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
    recipient.type || recipient.role || 'contact',
    recipient.name,
    recipient.email,
    recipient.storeId,
    status,
    message,
  ]);
}

function getSheet_(name, headers) {
  const spreadsheet = getLogSpreadsheet_();
  let sheet = spreadsheet.getSheetByName(name);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(name);
    sheet.appendRow(headers);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#0f172a').setFontColor('#ffffff');
    sheet.autoResizeColumns(1, headers.length);
  }

  return sheet;
}

function getLogSpreadsheet_() {
  const props = PropertiesService.getScriptProperties();
  const existingId = props.getProperty('LOG_SPREADSHEET_ID');

  if (existingId) {
    try {
      return SpreadsheetApp.openById(existingId);
    } catch (error) {
      props.deleteProperty('LOG_SPREADSHEET_ID');
    }
  }

  const spreadsheet = SpreadsheetApp.create('Sedifex Marketing Email Logs');
  props.setProperty('LOG_SPREADSHEET_ID', spreadsheet.getId());
  return spreadsheet;
}

function getBrandConfig_() {
  return {
    brandName: getProperty_('BRAND_NAME') || 'Sedifex',
    tagline: getProperty_('BRAND_TAGLINE') || 'Business operations made easier',
    primaryColor: getProperty_('BRAND_PRIMARY_COLOR') || '#4f46e5',
    darkColor: getProperty_('BRAND_DARK_COLOR') || '#0f172a',
    accentColor: getProperty_('BRAND_ACCENT_COLOR') || '#06b6d4',
    websiteUrl: getProperty_('BRAND_WEBSITE_URL') || 'https://sedifexmarket.com',
    logoUrl: getProperty_('BRAND_LOGO_URL') || '',
    address: getProperty_('BRAND_ADDRESS') || 'Ghana',
  };
}

function getUnsubscribeUrl_(recipient) {
  const base = getProperty_('UNSUBSCRIBE_URL') || '';
  if (!base) return '';
  const separator = base.indexOf('?') === -1 ? '?' : '&';
  return base + separator + 'email=' + encodeURIComponent(recipient.email || '') + '&source=sedifex_marketing';
}

function getSendMode_() {
  const mode = String(getProperty_('SEND_MODE') || 'draft').toLowerCase();
  return mode === 'send' ? 'send' : 'draft';
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

function stripText_(value) {
  return String(value || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function htmlToText_(html) {
  return String(html || '')
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#039;/gi, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function isValidEmail_(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());
}

function truncate_(value, max) {
  const text = String(value || '');
  return text.length > max ? text.slice(0, max - 1) + '…' : text;
}

function paragraphsToHtml_(value) {
  return String(value || '')
    .split(/\n{2,}/)
    .map(function (paragraph) {
      const lines = paragraph.split(/\n/).map(function (line) { return escapeHtml_(line); }).join('<br>');
      return '<p style="margin:0 0 16px;">' + lines + '</p>';
    })
    .join('');
}

function escapeHtml_(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function escapeAttr_(value) {
  return escapeHtml_(value).replace(/`/g, '&#096;');
}

function jsonResponse_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

function setupSedifexMarketingProperties_() {
  const props = PropertiesService.getScriptProperties();
  const defaults = {
    MARKETING_APPS_SCRIPT_TOKEN: 'CHANGE_ME_TO_THE_SAME_SECRET_IN_VERCEL',
    SEND_MODE: 'draft',
    FROM_NAME: 'Sedifex Market',
    REPLY_TO_EMAIL: 'sedifexbiz@gmail.com',
    MAX_RECIPIENTS_PER_CAMPAIGN: '200',
    BRAND_NAME: 'Sedifex',
    BRAND_TAGLINE: 'Business operations made easier',
    BRAND_PRIMARY_COLOR: '#4f46e5',
    BRAND_DARK_COLOR: '#0f172a',
    BRAND_ACCENT_COLOR: '#06b6d4',
    BRAND_WEBSITE_URL: 'https://sedifexmarket.com',
    BRAND_LOGO_URL: '',
    BRAND_ADDRESS: 'Ghana',
    UNSUBSCRIBE_URL: 'https://sedifexmarket.com/unsubscribe',
    CTA_LABEL: 'Visit Sedifex Market',
    CTA_URL: 'https://sedifexmarket.com',
  };

  Object.keys(defaults).forEach(function (key) {
    if (!props.getProperty(key)) props.setProperty(key, defaults[key]);
  });

  Logger.log('Sedifex marketing properties added. Replace MARKETING_APPS_SCRIPT_TOKEN with your real shared secret.');
}

function testSedifexMarketingDraft_() {
  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty('MARKETING_APPS_SCRIPT_TOKEN')) {
    props.setProperty('MARKETING_APPS_SCRIPT_TOKEN', 'test_secret_change_me');
  }
  props.setProperty('SEND_MODE', 'draft');

  const activeEmail = Session.getActiveUser().getEmail();
  const fakeEvent = {
    headers: {
      authorization: 'Bearer ' + props.getProperty('MARKETING_APPS_SCRIPT_TOKEN'),
      'x-sedifex-shared-token': props.getProperty('MARKETING_APPS_SCRIPT_TOKEN'),
    },
    postData: {
      contents: JSON.stringify({
        action: 'sendSedifexMarketingEmail',
        source: 'sedifexadmin_marketing_center',
        campaignId: 'test_' + Date.now(),
        campaignOwner: 'sedifex',
        fromName: 'Sedifex Market',
        replyTo: 'sedifexbiz@gmail.com',
        subject: 'Professional Sedifex branded email test for {{name}}',
        text: 'Hello {{name}},\n\nThis is a professional branded test email from Sedifex Admin.\n\nYou can use this marketing center to send updates, promotions, reminders, and business announcements to selected contacts.\n\nThank you for growing with {{brandName}}.',
        ctaLabel: 'Open Sedifex Market',
        ctaUrl: 'https://sedifexmarket.com',
        token: props.getProperty('MARKETING_APPS_SCRIPT_TOKEN'),
        sharedToken: props.getProperty('MARKETING_APPS_SCRIPT_TOKEN'),
        recipients: [
          {
            id: 'test-recipient',
            type: 'store',
            source: 'stores',
            role: 'store_owner',
            name: 'Test Store Owner',
            email: activeEmail,
            phone: '0000000000',
            storeId: 'test-store',
            storeName: 'Demo Store',
          }
        ],
      }),
    },
  };

  Logger.log(doPost(fakeEvent).getContent());
}
