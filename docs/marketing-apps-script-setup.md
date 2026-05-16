# Marketing Apps Script Setup

This document explains how to connect the Sedifex Admin Marketing page to Google Apps Script.

The admin page is:

```text
/admin/marketing
```

The Apps Script source file in this repo is:

```text
apps-script/marketing-email-webhook.gs
```

---

## 1. What the script does

The script receives marketing campaign payloads from Sedifex Admin and sends or drafts emails.

It supports:

- Store marketing emails
- Customer marketing emails
- Store + customer campaigns
- Recipient deduplication by email
- Basic email validation
- HTML email body
- Plain text fallback
- Campaign log sheet
- Per-recipient send log sheet
- Optional draft mode for testing
- Shared token verification

---

## 2. Create the Apps Script project

1. Open Google Apps Script.
2. Create a new project.
3. Rename it to something like:

```text
Sedifex Marketing Email Webhook
```

4. Create or open `Code.gs`.
5. Copy the full content from:

```text
apps-script/marketing-email-webhook.gs
```

6. Paste it into `Code.gs`.
7. Save the project.

---

## 3. Add Script Properties

In Apps Script:

1. Open **Project Settings**.
2. Go to **Script Properties**.
3. Add these properties.

Required:

```text
MARKETING_APPS_SCRIPT_TOKEN = your_shared_secret
```

Optional:

```text
FROM_NAME = Sedifex
REPLY_TO_EMAIL = info@sedifex.com
MAX_RECIPIENTS_PER_CAMPAIGN = 200
SEND_MODE = draft
UNSUBSCRIBE_URL = https://sedifex.com/unsubscribe
```

For testing, use:

```text
SEND_MODE = draft
```

For real sending, use:

```text
SEND_MODE = send
```

---

## 4. Deploy the script as a Web App

1. Click **Deploy**.
2. Click **New deployment**.
3. Select **Web app**.
4. Set **Execute as** to:

```text
Me
```

5. Set **Who has access** to:

```text
Anyone
```

6. Deploy.
7. Copy the Web App URL.

It will look like:

```text
https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec
```

---

## 5. Add env values to Sedifex Admin

In local `.env.local` and in Vercel env variables, add:

```env
MARKETING_APPS_SCRIPT_WEBHOOK_URL=https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec
MARKETING_APPS_SCRIPT_TOKEN=your_shared_secret
```

The token must be the same value as Apps Script `MARKETING_APPS_SCRIPT_TOKEN`.

Restart local dev after changing `.env.local`:

```powershell
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
npm run dev
```

---

## 6. Test the Apps Script directly

In Apps Script, run:

```text
testMarketingWebhookDraft_
```

This creates a Gmail draft for the active Apps Script user.

If it asks for permissions, approve the permissions.

The test function forces:

```text
SEND_MODE = draft
```

So it should not send a real campaign.

---

## 7. Test from Sedifex Admin

1. Open:

```text
/admin/marketing
```

2. Confirm **Apps Script sync** shows ready.
3. Select **Stores only** or another audience.
4. Enter a subject.
5. Enter a short test message.
6. Click **Send to Apps Script**.
7. Check the Apps Script spreadsheet logs.
8. If `SEND_MODE=draft`, check Gmail drafts.
9. If `SEND_MODE=send`, check sent mail and recipient inboxes.

---

## 8. Payload sent by Sedifex Admin

Sedifex Admin sends a JSON payload like this:

```json
{
  "source": "sedifexadmin",
  "type": "marketing_email_campaign",
  "campaignId": "campaign_1234567890",
  "audience": "stores",
  "senderName": "Sedifex",
  "subject": "New Sedifex update",
  "message": "Hello {{name}}, this is an update.",
  "createdAt": "2026-05-16T00:00:00.000Z",
  "recipientCount": 1,
  "recipients": [
    {
      "id": "store_123",
      "type": "store",
      "name": "Demo Store",
      "email": "owner@example.com",
      "storeId": "store_123"
    }
  ],
  "token": "your_shared_secret"
}
```

The script also accepts the token from an authorization header:

```text
Authorization: Bearer your_shared_secret
```

---

## 9. Personalization tags

The email message supports these tags:

```text
{{name}}
{{email}}
{{storeId}}
{{type}}
```

Example:

```text
Hello {{name}},

We have a new Sedifex update for your store {{storeId}}.
```

---

## 10. Logs created by the script

The script creates two sheets in the active spreadsheet or in a new spreadsheet:

```text
Marketing Campaign Logs
Marketing Send Logs
```

Campaign logs include:

- Timestamp
- Campaign ID
- Status
- Subject
- Audience
- Recipient count
- Sent count
- Drafted count
- Skipped count
- Failed count
- Error

Send logs include:

- Timestamp
- Campaign ID
- Recipient type
- Recipient name
- Recipient email
- Store ID
- Status
- Message

---

## 11. Send modes

### Draft mode

Use this for testing:

```text
SEND_MODE = draft
```

The script creates Gmail drafts instead of sending emails.

### Send mode

Use this for production:

```text
SEND_MODE = send
```

The script sends emails using `MailApp.sendEmail`.

---

## 12. Safety notes

- Start with `SEND_MODE=draft`.
- Send to a small test audience first.
- Keep `MAX_RECIPIENTS_PER_CAMPAIGN` low until the flow is trusted.
- Use an unsubscribe/footer rule before real customer campaigns.
- Do not send campaigns to customers who should not receive marketing updates.
- Rotate the token if it is exposed.

---

## 13. Troubleshooting

### Apps Script sync missing on admin page

Check that this env exists in `.env.local` or Vercel:

```env
MARKETING_APPS_SCRIPT_WEBHOOK_URL=
```

Then restart or redeploy.

### Unauthorized marketing webhook request

The token in Sedifex Admin does not match the Apps Script Script Property.

Check both places:

```text
MARKETING_APPS_SCRIPT_TOKEN
```

### No valid recipients were provided

The selected audience did not produce valid emails from Firestore.

Check:

- `stores`
- `storeSettings`
- `customers`

### Gmail permission error

Run the test function inside Apps Script and approve permissions.

### Emails not sending

Check:

- `SEND_MODE`
- Gmail/Workspace daily sending quota
- Apps Script execution logs
- Marketing Send Logs sheet
