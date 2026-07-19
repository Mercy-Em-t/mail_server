# Mail Server — Client Integration Guide

## Overview

This document explains how any website or subdomain can connect to the TM Savannah Mail Server to send emails.

**Mail Server URL:** `https://mail.tmsavannah.com`  
**Dispatch Endpoint:** `POST /api/dispatch`  
**Auth Method:** Per-client JWT in the `x-highway-token` header

---

## Step 1 — Get Your Credentials

A **server admin** must register your site in the Mail Server dashboard:

1. Go to `https://mail.tmsavannah.com/admin.html`
2. Open the **Clients** tab
3. Fill in your site name and domain → click **Register Client**
4. You'll receive a `client_id` and a `secret` — **save the secret immediately**, it won't be shown again

---

## Step 2 — Install JWT on Your Site

```bash
npm install jsonwebtoken
```

---

## Step 3 — Sign Every Request

On your backend, sign a short-lived JWT before each dispatch call:

```js
const jwt = require('jsonwebtoken');

const CLIENT_ID = 'sports';                          // your client_id
const CLIENT_SECRET = process.env.MAIL_SECRET;       // the secret from Step 1 — store in .env, NEVER hardcode

function getHighwayToken() {
    return jwt.sign(
        { client_id: CLIENT_ID, domain: 'sports.tmsavannah.com' },
        CLIENT_SECRET,
        { expiresIn: '10m' }   // keep short — tokens are single-use by convention
    );
}
```

---

## Step 4 — Send an Email

### Option A — Use a Named Template (Recommended)

Templates are managed centrally in the mail server dashboard. You only provide the template ID and variables.

```js
const response = await fetch('https://mail.tmsavannah.com/api/dispatch', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'x-highway-token': getHighwayToken()
    },
    body: JSON.stringify({
        client_id: 'sports',
        template: 'welcome_email',
        to: 'user@example.com',
        message_type: 'transactional',
        variables: {
            name: 'John',
            brand_name: 'TM Savannah Sports',
            message: 'Your account is now active.',
            cta_url: 'https://sports.tmsavannah.com/dashboard',
            cta_label: 'Go to Dashboard'
        }
    })
});

const result = await response.json();
// { success: true, message: "Message dispatched successfully.", template: "welcome_email" }
```

### Option B — Send Raw HTML

You control all content. Useful for dynamic or one-off messages.

```js
const response = await fetch('https://mail.tmsavannah.com/api/dispatch', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'x-highway-token': getHighwayToken()
    },
    body: JSON.stringify({
        client_id: 'sports',
        to: 'fan@example.com',
        subject: 'Match Result: Savannah FC 3 - 1 Rivals',
        html: '<h1>Full Time!</h1><p>Savannah FC won 3-1. Great match!</p>',
        message_type: 'notification',
        // Optional fields:
        from: 'updates@sports.tmsavannah.com',
        cc: 'backup@sports.tmsavannah.com',
        replyTo: 'noreply@sports.tmsavannah.com',
        isNoReply: false
    })
});
```

---

## Full Dispatch Payload Reference

| Field | Required | Description |
|---|---|---|
| `client_id` | ✅ | Your registered `client_id` (also in JWT payload) |
| `to` | ✅ | Recipient email address |
| `template` | ✅* | Template ID (e.g. `welcome_email`). Required if `subject`/`html` not provided |
| `variables` | When using template | Key-value pairs for `{{variable}}` placeholders |
| `subject` | ✅* | Email subject. Required if `template` not provided |
| `html` | ✅* | HTML body. Required if `template` not provided |
| `text` | ❌ | Plain text fallback (optional) |
| `message_type` | ❌ | Enforced against your account's allowed types |
| `from` | ❌ | Sender address (defaults to server SMTP user) |
| `cc` | ❌ | CC address |
| `replyTo` | ❌ | Reply-To address |
| `isNoReply` | ❌ | If `true`, forces `noreply@tmsavannah.com` as sender |

---

## Available Templates

| Template ID | Type | Variables |
|---|---|---|
| `welcome_email` | transactional | `name`, `brand_name`, `message`, `cta_url`, `cta_label` |
| `otp_email` | transactional | `name`, `brand_name`, `otp_code`, `expires_in` |
| `system_notification` | notification | `brand_name`, `alert_title`, `alert_body`, `timestamp` |
| `newsletter` | marketing | `brand_name`, `headline`, `body`, `cta_url`, `cta_label`, `unsubscribe_url` |
| `auto_reply` | auto_reply | `name`, `brand_name`, `response_time`, `reference_id` |
| `internal_memo` | internal | `memo_id`, `author`, `date`, `subject_line`, `content`, `brand_name` |

> Custom templates can be created by the admin in the **Templates** tab of the dashboard.

---

## Error Reference

| HTTP Code | Meaning |
|---|---|
| `401` | Missing or malformed `x-highway-token` header |
| `403` | Unknown `client_id`, deactivated account, or invalid/expired JWT |
| `403` | Tried to send a `message_type` your account isn't authorized for |
| `404` | Template ID not found |
| `400` | Missing required fields (`to`, `subject`, or `template`) |
| `500` | Mail server internal error (SMTP issue) |

---

## Security Notes

- **Never expose your `CLIENT_SECRET` in frontend code** — only call `/api/dispatch` from your server-side backend
- Tokens should be short-lived (`expiresIn: '5m'` or `'10m'`) — generate a fresh token per request
- If your secret is compromised, ask an admin to rotate it from the Clients dashboard — only that client is affected
- The mail server logs every dispatch with your `client_id` for audit purposes
