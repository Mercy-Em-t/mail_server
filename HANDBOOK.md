# TM Savannah Mail Server — Connection Handbook

**Version 1.0 — July 2026**  
**Server:** `https://mail.tmsavannah.com`  
**Maintained by:** TM Savannah Systems

---

## Table of Contents

1. [How the System Works](#how-the-system-works)
2. [Getting Registered as a Client](#getting-registered-as-a-client)
3. [Authentication — Signing Your Requests](#authentication)
4. [Dispatch Endpoint Reference](#dispatch-endpoint-reference)
5. [Message Types](#message-types)
6. [Working with Templates](#working-with-templates)
7. [Creating Your Own Templates](#creating-your-own-templates)
8. [Variable Substitution](#variable-substitution)
9. [Code Examples by Language](#code-examples)
10. [Error Reference](#error-reference)
11. [Security Rules](#security-rules)
12. [Admin Dashboard Guide](#admin-dashboard-guide)

---

## 1. How the System Works

```
Your Site Backend
      │
      │  1. Sign a short-lived JWT with your client secret
      │
      ▼
POST /api/dispatch
  x-highway-token: <your JWT>
      │
      ▼
Mail Server validates:
  ─ Is client_id registered?
  ─ Is the account active?
  ─ Does the JWT signature match this client's secret?
  ─ Is the message_type allowed for this client?
      │
      ▼
  Template path?          Raw HTML path?
  Load template.json  OR  Use your subject + html directly
  Inject {{variables}}
      │
      ▼
  SMTP → Recipient inbox
  Audit log → logs.txt + Supabase
      │
      ▼
  { success: true }
```

**Key points:**
- Every client site has its own `client_id` and `secret` — isolated and independently revocable
- Tokens must be signed **server-side only** — never expose your secret to a browser
- You choose per-request: use a named template or send your own HTML

---

## 2. Getting Registered as a Client

A **mail server admin** must create your account. Provide them:

| Field | Example |
|---|---|
| Site name | `TM Savannah Sports` |
| Domain | `sports.tmsavannah.com` |
| Message types you need | `transactional, notification` |
| Daily send volume estimate | `200 emails/day` |

The admin will register you in the dashboard and give you back:

```
client_id: sports
secret:    yrmHjFyfhMGiemjQNeQS4jiChspZKOxYnd//0tKKUOzODMO0cy7y4ZtdYmeYSoZC
```

> ⚠️ **Save the secret immediately.** It is shown only once. Store it in your `.env` file — never in source code.

---

## 3. Authentication

### Install the JWT library

```bash
npm install jsonwebtoken
```

### Create a token signing helper

```js
// lib/mailserver.js  (your backend utility file)
const jwt = require('jsonwebtoken');

const MAIL_CLIENT_ID = process.env.MAIL_CLIENT_ID;   // e.g. 'sports'
const MAIL_SECRET    = process.env.MAIL_SECRET;        // your client secret

/**
 * Signs a short-lived JWT for a single dispatch call.
 * Call this immediately before each request — tokens expire in 10 minutes.
 */
function getHighwayToken() {
    return jwt.sign(
        {
            client_id: MAIL_CLIENT_ID,
            domain:    'sports.tmsavannah.com'
        },
        MAIL_SECRET,
        { expiresIn: '10m' }
    );
}

module.exports = { getHighwayToken, MAIL_CLIENT_ID };
```

### Your `.env` file

```env
MAIL_CLIENT_ID=sports
MAIL_SECRET=yrmHjFyfhMGiemjQNeQS4jiChspZKOxYnd//0tKKUOzODMO0cy7y4ZtdYmeYSoZC
```

---

## 4. Dispatch Endpoint Reference

```
POST https://mail.tmsavannah.com/api/dispatch
Content-Type: application/json
x-highway-token: <your signed JWT>
```

### Full payload schema

```json
{
  "client_id":     "sports",
  "to":            "user@example.com",

  "template":      "welcome_email",
  "variables":     { "name": "John", "brand_name": "TM Savannah Sports" },

  "subject":       "Your subject line",
  "html":          "<h1>Your email body</h1>",
  "text":          "Plain text fallback (optional)",

  "message_type":  "transactional",

  "from":          "updates@sports.tmsavannah.com",
  "cc":            "records@tmsavannah.com",
  "replyTo":       "support@sports.tmsavannah.com",
  "isNoReply":     false
}
```

**Required fields:**
- `client_id` — always required
- `to` — always required
- Either `template` OR (`subject` + `html`)

**Optional fields:**
- `variables` — only when using `template`
- `message_type` — enforced against your allowed types
- `from`, `cc`, `replyTo`, `isNoReply` — email routing overrides

### Success response

```json
{
  "success": true,
  "message": "Message dispatched successfully.",
  "template": "welcome_email"
}
```

---

## 5. Message Types

| Type | `message_type` value | Typical use |
|---|---|---|
| **Transactional** | `transactional` | OTPs, password resets, order confirmations, account actions |
| **Notification** | `notification` | System alerts, activity summaries, score updates |
| **Marketing** | `marketing` | Newsletters, promotions, announcements |
| **Internal** | `internal` | Staff-to-staff messages, system memos |
| **Auto Reply** | `auto_reply` | Form submission acknowledgements, support ticket receipts |

> If you send a `message_type` your account isn't authorized for, the server returns `403`.

---

## 6. Working with Templates

Templates are managed centrally in the dashboard. As a client, you **call a template by ID** and pass variable values — no HTML required on your side.

### Template dispatch

```js
const { getHighwayToken, MAIL_CLIENT_ID } = require('./lib/mailserver');

async function sendWelcomeEmail(userEmail, userName) {
    const res = await fetch('https://mail.tmsavannah.com/api/dispatch', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-highway-token': getHighwayToken()
        },
        body: JSON.stringify({
            client_id:    MAIL_CLIENT_ID,
            template:     'welcome_email',
            to:           userEmail,
            message_type: 'transactional',
            variables: {
                name:        userName,
                brand_name:  'TM Savannah Sports',
                message:     'Your account is ready.',
                cta_url:     'https://sports.tmsavannah.com/dashboard',
                cta_label:   'Open Dashboard'
            }
        })
    });
    return res.json();
}
```

### Available default templates

| Template ID | Type | Required Variables |
|---|---|---|
| `welcome_email` | transactional | `name`, `brand_name`, `message`, `cta_url`, `cta_label` |
| `otp_email` | transactional | `name`, `brand_name`, `otp_code`, `expires_in` |
| `system_notification` | notification | `brand_name`, `alert_title`, `alert_body`, `timestamp` |
| `newsletter` | marketing | `brand_name`, `headline`, `body`, `cta_url`, `cta_label`, `unsubscribe_url` |
| `auto_reply` | auto_reply | `name`, `brand_name`, `response_time`, `reference_id` |
| `internal_memo` | internal | `memo_id`, `author`, `date`, `subject_line`, `content`, `brand_name` |

### OTP example

```js
await dispatch({
    template: 'otp_email', to: userEmail, message_type: 'transactional',
    variables: { name: userName, brand_name: 'TM Savannah', otp_code: '847291', expires_in: '10 minutes' }
});
```

### Auto-reply example

```js
await dispatch({
    template: 'auto_reply', to: form.email, message_type: 'auto_reply', isNoReply: true,
    variables: { name: form.name, brand_name: 'TM Savannah', response_time: '24 hours', reference_id: `FORM-${Date.now()}` }
});
```

### System notification example

```js
await dispatch({
    template: 'system_notification', to: adminEmail, message_type: 'notification',
    variables: { brand_name: 'TM Savannah Sports', alert_title: 'Server Load High', alert_body: 'CPU above 90% for 5 minutes.', timestamp: new Date().toLocaleString() }
});
```

---

## 7. Creating Your Own Templates

Templates are created in the admin dashboard. Steps:

1. Log in at `https://mail.tmsavannah.com/login.html`
2. Open the **Templates** tab
3. Fill in the create form at the bottom:

| Field | Description |
|---|---|
| **Template ID** | Unique slug used in dispatch calls, e.g. `match_result` (no spaces) |
| **Display Name** | Human label, e.g. `Match Result Email` |
| **Message Type** | One of the 5 types |
| **Subject** | Supports `{{variable}}` placeholders |
| **HTML Body** | Full HTML — write in the Quill editor; click variable chips to insert `{{placeholders}}` |

4. Click **Save Template**
5. Click **Test** to send a preview with sample data to the admin inbox
6. Share the new `template_id` with your client site developer

### Example: custom sports result template

**Template ID:** `match_result`  
**Subject:** `Full Time! {{home_team}} {{home_score}} – {{away_score}} {{away_team}}`

**HTML Body:**
```html
<div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;background:#f9f9f9;padding:32px;border-radius:8px;">
  <h1 style="color:#1a1a2e;">⚽ Full Time Result</h1>
  <p style="font-size:28px;text-align:center;font-weight:700;letter-spacing:2px;">
    {{home_team}} {{home_score}} – {{away_score}} {{away_team}}
  </p>
  <p style="color:#444;">Hi {{name}}, here's the result from today's match.</p>
  <a href="{{recap_url}}" style="display:inline-block;background:#1a1a2e;color:#fff;padding:12px 24px;border-radius:4px;text-decoration:none;margin-top:16px;">
    Read Full Recap
  </a>
</div>
```

**Client call:**
```js
await dispatch({
    template: 'match_result', to: 'fan@example.com', message_type: 'notification',
    variables: {
        name: 'James', home_team: 'Savannah FC', home_score: '3',
        away_score: '1', away_team: 'Rivals SC', recap_url: 'https://sports.tmsavannah.com/matches/12'
    }
});
```

---

## 8. Variable Substitution

- Syntax: `{{variable_name}}` in subject or HTML body
- Names: alphanumeric + underscores only
- Unresolved variables stay as literal `{{variable_name}}` — no errors
- Works in both subject line and HTML body
- No limit on number of variables

```
Subject template:  "Welcome to {{brand_name}}, {{name}}!"
Variables:         { brand_name: "TM Savannah", name: "Sarah" }
Result:            "Welcome to TM Savannah, Sarah!"
```

---

## 9. Code Examples

### Node.js service module

```js
// services/mail.js
const jwt = require('jsonwebtoken');

const BASE   = 'https://mail.tmsavannah.com';
const ID     = process.env.MAIL_CLIENT_ID;
const SECRET = process.env.MAIL_SECRET;

const token = () => jwt.sign({ client_id: ID }, SECRET, { expiresIn: '10m' });

async function dispatch(payload) {
    const res = await fetch(`${BASE}/api/dispatch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-highway-token': token() },
        body: JSON.stringify({ client_id: ID, ...payload })
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.message);
    return data;
}

module.exports = {
    sendWelcome:   (to, v) => dispatch({ template: 'welcome_email',      to, message_type: 'transactional', variables: v }),
    sendOTP:       (to, v) => dispatch({ template: 'otp_email',           to, message_type: 'transactional', variables: v }),
    sendAlert:     (to, v) => dispatch({ template: 'system_notification', to, message_type: 'notification',  variables: v }),
    sendAutoReply: (to, v) => dispatch({ template: 'auto_reply',          to, message_type: 'auto_reply',    variables: v, isNoReply: true }),
    sendRaw:    (to, subject, html, type = 'notification') => dispatch({ to, subject, html, message_type: type }),
};
```

### Python

```python
import jwt, time, requests, os

BASE, ID, SEC = "https://mail.tmsavannah.com", os.environ["MAIL_CLIENT_ID"], os.environ["MAIL_SECRET"]

def dispatch(payload):
    tok = jwt.encode({"client_id": ID, "exp": int(time.time()) + 600}, SEC, algorithm="HS256")
    r = requests.post(f"{BASE}/api/dispatch", json={"client_id": ID, **payload},
                      headers={"x-highway-token": tok}, timeout=15)
    return r.json()
```

### PHP

```php
<?php
function mailDispatch(array $payload): array {
    $clientId = $_ENV['MAIL_CLIENT_ID'];
    $secret   = $_ENV['MAIL_SECRET'];
    $header   = rtrim(base64_encode('{"alg":"HS256","typ":"JWT"}'), '=');
    $pay      = rtrim(base64_encode(json_encode(['client_id' => $clientId, 'exp' => time() + 600])), '=');
    $sig      = rtrim(base64_encode(hash_hmac('sha256', "$header.$pay", $secret, true)), '=');
    $token    = "$header.$pay.$sig";

    $ch = curl_init('https://mail.tmsavannah.com/api/dispatch');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => json_encode(array_merge(['client_id' => $clientId], $payload)),
        CURLOPT_HTTPHEADER     => ['Content-Type: application/json', "x-highway-token: $token"],
    ]);
    return json_decode(curl_exec($ch), true);
}
```

---

## 10. Error Reference

| HTTP | Message | Fix |
|---|---|---|
| `401` | Missing x-highway-token header | Add the `x-highway-token` header |
| `401` | Token must include client_id in payload | Include `client_id` in JWT payload |
| `403` | Unknown client_id | Verify `client_id` matches registration |
| `403` | Client account has been deactivated | Contact mail server admin |
| `403` | Invalid or expired token | Generate a fresh token; check server clocks |
| `403` | Client not authorized for message_type | Ask admin to expand allowed types |
| `404` | Template 'x' not found | Check template ID spelling |
| `400` | Missing required fields | Include `to` + (`template` or `subject`+`html`) |
| `500` | Failed to dispatch message | SMTP issue — contact admin |

---

## 11. Security Rules

| Rule | Reason |
|---|---|
| Never call `/api/dispatch` from a browser | Your `MAIL_SECRET` would be exposed in client-side code |
| Store `MAIL_SECRET` in `.env` only | Never commit secrets to source control |
| Generate a fresh token per request | Limits exposure window if a token is intercepted |
| Keep `expiresIn` short (`5m`–`10m`) | Reduces attack surface from leaked tokens |
| Rotate immediately if compromised | Admin rotates only your secret — no impact on others |
| Use `isNoReply: true` on auto-replies | Prevents reply-storm loops on high-volume sends |

---

## 12. Admin Dashboard Guide

### Broadcast Tab
Send a one-off email directly from the dashboard — useful for urgent announcements.

### Clients Tab

| Action | Steps |
|---|---|
| Register a client | Fill name + domain → **Register Client** → copy secret immediately |
| View all clients | Table: client_id, domain, types, quota, status |
| Rotate a secret | **Rotate** button on the row → new secret shown — share securely |
| Deactivate | **Deactivate** → all dispatch calls return `403` instantly |
| Reactivate | **Activate** button restores access |

### Templates Tab

| Action | Steps |
|---|---|
| Create | Fill the form → click variable chips to insert `{{var}}` → **Save Template** |
| Edit | **Edit** button on a card → form pre-fills → **Update Template** |
| Test | **Test** button sends a preview with sample variables to admin inbox |
| Delete | Trash icon → confirm |

### Memos Tab
Stamp cryptographically-signed internal server notes. Each memo gets a hash + timestamp for audit trail.

---

*Source: [github.com/Mercy-Em-t/mail_server](https://github.com/Mercy-Em-t/mail_server)*
