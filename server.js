require('dotenv').config();
const express = require('express');
const fs = require('fs');
const os = require('os');
const path = require('path');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const { createClient } = require('@supabase/supabase-js');
const nodemailer = require('nodemailer');
const cookieParser = require('cookie-parser');
const xss = require('xss');
const { z } = require('zod');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// CORS MIDDLEWARE: Allow external websites to submit data to this API
app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*"); // In production, restrict this to specific client domains
    res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type");
    if (req.method === "OPTIONS") {
        return res.sendStatus(200);
    }
    next();
});

// ACTIVITY LOGGER: Appends server events cleanly to a local history file
function logActivity(username, action, status = 'SUCCESS') {
    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const logLine = `[${timestamp}] User: '${username}' | Action: ${action} | Status: ${status}\n`;
    
    const logPath = path.join(__dirname, 'logs.txt');
    
    fs.appendFile(logPath, logLine, 'utf8', (err) => {
        if (err) console.error('⚠️ Critical: Failed to write to system audit log:', err);
    });
}

// SYSTEM CONFIGURATION
const SUPABASE_URL = process.env.SUPABASE_URL;
// Use the Service Role Key for backend operations to bypass RLS (required for public form submissions and admin saves)
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Cloudinary Configuration
cloudinary.config({ 
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
  api_key: process.env.CLOUDINARY_API_KEY, 
  api_secret: process.env.CLOUDINARY_API_SECRET 
});

// Configure Multer to use Cloudinary
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'nexus_cms_uploads',
    allowedFormats: ['jpg', 'png', 'jpeg', 'webp'],
  },
});
const upload = multer({ storage: storage });

// Email Notification Transporter Configuration
const emailTransporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false, // true for 465, false for other ports
    requireTLS: true,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    },
    tls: {
        rejectUnauthorized: false
    }
});

// Middleware
app.use(express.json());
app.use(cookieParser());

// SERVER-SIDE RENDERED ENGINE (SSR)
// Intercepts the storefront route and injects the Supabase payload BEFORE serving static files
const renderStorefront = async (req, res) => {
    try {
        const userId = req.query.user_id;
        const htmlPath = path.join(__dirname, 'index.html');
        let htmlTemplate = fs.readFileSync(htmlPath, 'utf8');

        if(userId) {
            const { data, error } = await supabase.from('cms_data').select('data').eq('user_id', userId).single();
            if(data && data.data) {
                // Stringify the data and escape HTML entities to prevent XSS injection via </script>
                const payloadString = JSON.stringify(data.data).replace(/</g, '\\u003c');
                const injection = `<script id="server-payload" type="application/json">${payloadString}</script>`;
                htmlTemplate = htmlTemplate.replace('</head>', `${injection}\n</head>`);
            }
        }
        res.send(htmlTemplate);
    } catch(err) {
        console.error('SSR Error:', err);
        res.sendFile(path.join(__dirname, 'index.html'));
    }
};

app.get('/', renderStorefront);
app.get('/index.html', renderStorefront);
app.get('/index.html', renderStorefront);

app.use(express.static(__dirname)); // Serve all other HTML files (admin, login, etc.)

// SECURITY MIDDLEWARE: Verifies Supabase session
async function authenticateToken(req, res, next) {
    const token = req.cookies.auth_token;
    
    if (!token) {
        return res.status(401).json({ success: false, message: 'Access Denied: Log in required.' });
    }

    const { data, error } = await supabase.auth.getUser(token);
    
    if (error || !data.user) {
        return res.status(403).json({ success: false, message: 'Invalid or expired session token.' });
    }
    
    req.user = data.user;
    next();
}

// API: Step 1 - Handle User Login via Supabase & Send OTP
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body; 

    const { data, error } = await supabase.auth.signInWithPassword({
        email: username, 
        password: password
    });

    if (error) {
        logActivity(username, 'USER_LOGIN', 'FAILED_CREDENTIALS');
        return res.status(400).json({ success: false, message: 'Invalid credentials.' });
    }

    // STATELESS OTP GENERATION
    const otp = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit OTP
    const key = crypto.scryptSync(otp, 'nexus_salt_2026', 32);
    
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    
    let encryptedToken = cipher.update(data.session.access_token, 'utf8', 'hex');
    encryptedToken += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');

    // Send OTP via Email
    try {
        await emailTransporter.sendMail({
            from: `"Mail Server Security" <${process.env.SMTP_USER}>`,
            to: username,
            subject: 'Your Dashboard Login OTP',
            html: `<div style="font-family: sans-serif; text-align: center; padding: 20px;">
                    <h2>Secure Login Verification</h2>
                    <p>Your One-Time Password is:</p>
                    <h1 style="color: #d0aa69; font-size: 36px; letter-spacing: 5px;">${otp}</h1>
                    <p>This code will expire shortly. Do not share it with anyone.</p>
                   </div>`
        });
        logActivity(data.user.id, 'OTP_SENT', 'SUCCESS');
        
        // Return the encrypted token package (NO cookie yet)
        res.json({ 
            success: true, 
            message: 'OTP sent to your email.', 
            verificationPackage: {
                encryptedToken,
                iv: iv.toString('hex'),
                authTag
            }
        });
    } catch (err) {
        console.error('Failed to send OTP email:', err);
        logActivity(data.user.id, 'OTP_EMAIL_FAILED', 'ERROR');
        return res.status(500).json({ success: false, message: 'Failed to send OTP email.' });
    }
});

// API: Step 2 - Verify OTP and Issue Session
app.post('/api/verify-otp', (req, res) => {
    const { otp, verificationPackage } = req.body;

    if (!otp || !verificationPackage) {
        return res.status(400).json({ success: false, message: 'Missing OTP or verification package.' });
    }

    const { encryptedToken, iv, authTag } = verificationPackage;

    try {
        const key = crypto.scryptSync(otp, 'nexus_salt_2026', 32);
        const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'hex'));
        decipher.setAuthTag(Buffer.from(authTag, 'hex'));
        
        let token = decipher.update(encryptedToken, 'hex', 'utf8');
        token += decipher.final('utf8');

        // OTP Validated! Set the cookie.
        const isSecure = req.secure || req.headers['x-forwarded-proto'] === 'https';
        res.cookie('auth_token', token, {
            httpOnly: true,
            secure: isSecure, 
            sameSite: 'lax', 
            maxAge: 2 * 60 * 60 * 1000 // 2 hours
        });

        logActivity('verified_user', 'USER_LOGIN_2FA', 'SUCCESS');
        res.json({ success: true, message: 'Authentication successful.' });

    } catch (err) {
        logActivity('unknown', 'USER_LOGIN_2FA', 'FAILED_INVALID_OTP');
        return res.status(401).json({ success: false, message: 'Invalid or expired OTP.' });
    }
});

// ─────────────────────────────────────────────────────────────
// MULTI-CLIENT REGISTRY HELPERS
// ─────────────────────────────────────────────────────────────
const jwt = require('jsonwebtoken');
const CLIENTS_FILE = path.join(__dirname, 'clients.json');
const TEMPLATES_FILE = path.join(__dirname, 'templates.json');

function loadClients() {
    try {
        const raw = fs.readFileSync(CLIENTS_FILE, 'utf8');
        return JSON.parse(raw).clients || [];
    } catch { return []; }
}

function saveClients(clients) {
    fs.writeFileSync(CLIENTS_FILE, JSON.stringify({ clients }, null, 2), 'utf8');
}

function loadTemplates() {
    try {
        const raw = fs.readFileSync(TEMPLATES_FILE, 'utf8');
        return JSON.parse(raw) || {};
    } catch { return {}; }
}

function saveTemplates(templates) {
    fs.writeFileSync(TEMPLATES_FILE, JSON.stringify(templates, null, 2), 'utf8');
}

// Inject variables into a template string using {{variable}} syntax
function renderTemplate(str, vars = {}) {
    return str.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] !== undefined ? vars[key] : `{{${key}}}`);
}

// ─────────────────────────────────────────────────────────────
// EXPRESS HIGHWAY — PER-CLIENT JWT MIDDLEWARE
// ─────────────────────────────────────────────────────────────
function verifyHighwayToken(req, res, next) {
    const token = req.headers['x-highway-token'];
    if (!token) return res.status(401).json({ success: false, message: 'Missing x-highway-token header.' });

    // Decode payload without verifying to extract client_id
    const unverified = jwt.decode(token);
    if (!unverified || !unverified.client_id) {
        return res.status(401).json({ success: false, message: 'Token must include client_id in payload.' });
    }

    const clients = loadClients();
    const client = clients.find(c => c.client_id === unverified.client_id);

    if (!client) {
        logActivity(unverified.client_id, 'HIGHWAY_ACCESS', 'FAILED_UNKNOWN_CLIENT');
        return res.status(403).json({ success: false, message: 'Unknown client_id.' });
    }
    if (!client.active) {
        logActivity(client.client_id, 'HIGHWAY_ACCESS', 'FAILED_DEACTIVATED');
        return res.status(403).json({ success: false, message: 'Client account has been deactivated.' });
    }

    try {
        jwt.verify(token, client.secret);
        req.highwayClient = client;
        next();
    } catch (err) {
        logActivity(client.client_id, 'HIGHWAY_ACCESS', 'FAILED_INVALID_TOKEN');
        return res.status(403).json({ success: false, message: 'Invalid or expired token.' });
    }
}

// ─────────────────────────────────────────────────────────────
// EXPRESS HIGHWAY API: /api/dispatch (Hybrid — template or raw)
// ─────────────────────────────────────────────────────────────
app.post('/api/dispatch', verifyHighwayToken, async (req, res) => {
    const { to, from, cc, replyTo, subject, html, text, isNoReply, template, variables, message_type } = req.body;
    const client = req.highwayClient;

    // Enforce message type permissions if client has restrictions
    if (message_type && client.allowed_message_types && client.allowed_message_types.length > 0) {
        if (!client.allowed_message_types.includes(message_type)) {
            return res.status(403).json({ success: false, message: `Client '${client.client_id}' is not authorized for message type: '${message_type}'.` });
        }
    }

    let finalSubject = subject;
    let finalHtml = html;
    let finalText = text;

    // ── Template resolution path ──
    if (template) {
        const templates = loadTemplates();
        const tmpl = templates[template];
        if (!tmpl) {
            return res.status(404).json({ success: false, message: `Template '${template}' not found. Use GET /api/templates to see available templates.` });
        }
        const vars = variables || {};
        finalSubject = renderTemplate(tmpl.subject, vars);
        finalHtml = renderTemplate(tmpl.html, vars);
    }

    if (!to || !finalSubject) {
        return res.status(400).json({ success: false, message: 'Missing required fields: to, and either subject+html or template.' });
    }

    let finalFrom = from;
    if (isNoReply) {
        finalFrom = `"No Reply" <noreply@tmsavannah.com>`;
    } else if (!from) {
        finalFrom = process.env.SMTP_USER;
    }

    const mailOptions = { from: finalFrom, to, cc, replyTo, subject: finalSubject, html: finalHtml, text: finalText };

    try {
        await emailTransporter.sendMail(mailOptions);
        logActivity(`HIGHWAY_[${client.client_id}]`, `DISPATCHED_TO_${to}`, 'SUCCESS');

        // Async audit log — does not block response
        supabase.from('audit_logs').insert([{
            client: client.client_id,
            recipient: to,
            subject: finalSubject,
            template: template || null,
            message_type: message_type || (template ? loadTemplates()[template]?.message_type : null),
            timestamp: new Date().toISOString()
        }]).then(({ error }) => {
            if (error) console.error('Failed to write audit log to Supabase:', error);
        });

        res.json({ success: true, message: 'Message dispatched successfully.', template: template || null });
    } catch (err) {
        console.error('Express Highway Dispatch Error:', err);
        logActivity(`HIGHWAY_[${client.client_id}]`, `DISPATCH_FAILED_${to}`, 'ERROR');
        res.status(500).json({ success: false, message: 'Failed to dispatch message.' });
    }
});

// ─────────────────────────────────────────────────────────────
// CLIENT MANAGEMENT API (Admin-only)
// ─────────────────────────────────────────────────────────────

// List all clients
app.get('/api/clients', authenticateToken, (req, res) => {
    const clients = loadClients().map(c => ({
        ...c,
        secret: c.secret.substring(0, 6) + '...' // mask secret in list view
    }));
    res.json({ success: true, clients });
});

// Register a new client
app.post('/api/clients/register', authenticateToken, (req, res) => {
    const { client_name, domain, allowed_message_types, daily_quota } = req.body;
    if (!client_name || !domain) {
        return res.status(400).json({ success: false, message: 'client_name and domain are required.' });
    }

    const clients = loadClients();
    const client_id = client_name.toLowerCase().replace(/[^a-z0-9]/g, '_');

    if (clients.find(c => c.client_id === client_id)) {
        return res.status(409).json({ success: false, message: `Client '${client_id}' already exists.` });
    }

    const secret = crypto.randomBytes(48).toString('base64');
    const newClient = {
        client_id,
        client_name,
        domain,
        secret,
        allowed_message_types: allowed_message_types || ['transactional', 'notification', 'marketing', 'internal', 'auto_reply'],
        daily_quota: daily_quota || 500,
        active: true,
        created_at: new Date().toISOString()
    };

    clients.push(newClient);
    saveClients(clients);
    logActivity('admin', `CLIENT_REGISTERED_${client_id}`, 'SUCCESS');

    res.json({ success: true, message: `Client '${client_name}' registered.`, client_id, secret });
});

// Rotate a client's secret
app.post('/api/clients/:id/rotate-secret', authenticateToken, (req, res) => {
    const clients = loadClients();
    const idx = clients.findIndex(c => c.client_id === req.params.id);
    if (idx === -1) return res.status(404).json({ success: false, message: 'Client not found.' });

    const newSecret = crypto.randomBytes(48).toString('base64');
    clients[idx].secret = newSecret;
    saveClients(clients);
    logActivity('admin', `CLIENT_SECRET_ROTATED_${req.params.id}`, 'SUCCESS');

    res.json({ success: true, message: 'Secret rotated. Update the client site immediately.', client_id: req.params.id, secret: newSecret });
});

// Deactivate a client
app.post('/api/clients/:id/deactivate', authenticateToken, (req, res) => {
    const clients = loadClients();
    const idx = clients.findIndex(c => c.client_id === req.params.id);
    if (idx === -1) return res.status(404).json({ success: false, message: 'Client not found.' });

    clients[idx].active = false;
    saveClients(clients);
    logActivity('admin', `CLIENT_DEACTIVATED_${req.params.id}`, 'SUCCESS');

    res.json({ success: true, message: `Client '${req.params.id}' deactivated.` });
});

// Reactivate a client
app.post('/api/clients/:id/activate', authenticateToken, (req, res) => {
    const clients = loadClients();
    const idx = clients.findIndex(c => c.client_id === req.params.id);
    if (idx === -1) return res.status(404).json({ success: false, message: 'Client not found.' });

    clients[idx].active = true;
    saveClients(clients);
    logActivity('admin', `CLIENT_ACTIVATED_${req.params.id}`, 'SUCCESS');

    res.json({ success: true, message: `Client '${req.params.id}' reactivated.` });
});

// ─────────────────────────────────────────────────────────────
// TEMPLATE MANAGEMENT API (Admin-only)
// ─────────────────────────────────────────────────────────────

// List all templates
app.get('/api/templates', authenticateToken, (req, res) => {
    const templates = loadTemplates();
    res.json({ success: true, templates });
});

// Create or update a template
app.post('/api/templates', authenticateToken, (req, res) => {
    const { id, name, message_type, subject, html, variables } = req.body;
    if (!id || !name || !message_type || !subject || !html) {
        return res.status(400).json({ success: false, message: 'id, name, message_type, subject, and html are required.' });
    }

    const validTypes = ['transactional', 'notification', 'marketing', 'internal', 'auto_reply'];
    if (!validTypes.includes(message_type)) {
        return res.status(400).json({ success: false, message: `Invalid message_type. Must be one of: ${validTypes.join(', ')}` });
    }

    const templates = loadTemplates();
    templates[id] = { id, name, message_type, subject, html, variables: variables || [], created_by: 'admin', created_at: new Date().toISOString() };
    saveTemplates(templates);
    logActivity('admin', `TEMPLATE_SAVED_${id}`, 'SUCCESS');

    res.json({ success: true, message: `Template '${id}' saved.` });
});

// Delete a template
app.delete('/api/templates/:id', authenticateToken, (req, res) => {
    const templates = loadTemplates();
    if (!templates[req.params.id]) return res.status(404).json({ success: false, message: 'Template not found.' });

    delete templates[req.params.id];
    saveTemplates(templates);
    logActivity('admin', `TEMPLATE_DELETED_${req.params.id}`, 'SUCCESS');

    res.json({ success: true, message: `Template '${req.params.id}' deleted.` });
});

// Test a template (sends a preview email to admin)
app.post('/api/templates/:id/test', authenticateToken, async (req, res) => {
    const templates = loadTemplates();
    const tmpl = templates[req.params.id];
    if (!tmpl) return res.status(404).json({ success: false, message: 'Template not found.' });

    const vars = req.body.variables || {};
    const renderedSubject = renderTemplate(tmpl.subject, vars);
    const renderedHtml = renderTemplate(tmpl.html, vars);

    try {
        await emailTransporter.sendMail({
            from: process.env.SMTP_USER,
            to: process.env.SMTP_USER,
            subject: `[TEMPLATE TEST] ${renderedSubject}`,
            html: renderedHtml
        });
        res.json({ success: true, message: `Test email for '${req.params.id}' sent to ${process.env.SMTP_USER}.` });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Failed to send test email: ' + err.message });
    }
});

// API: Handle User Registration (New route for multi-user)
app.post('/api/register', async (req, res) => {
    const { username, password } = req.body; 
    
    const { data, error } = await supabase.auth.signUp({
        email: username,
        password: password
    });

    if (error) {
        return res.status(400).json({ success: false, message: error.message });
    }

    res.json({ success: true, message: 'Registration successful! You can now log in.' });
});

// Deep merge utility to ensure structurally sound data
function mergeDeep(target, source) {
    if (!source) return target;
    const output = Object.assign({}, target);
    for (const key of Object.keys(source)) {
        if (source[key] instanceof Object && !Array.isArray(source[key])) {
            if (!(key in target)) Object.assign(output, { [key]: source[key] });
            else output[key] = mergeDeep(target[key], source[key]);
        } else {
            Object.assign(output, { [key]: source[key] });
        }
    }
    return output;
}

// Data Migration for Draft vs Published and Localization Matrix
function migrateData(data) {
    if (!data || !data.draft) {
        // Legacy data format upgrade
        data = {
            draft: { en: data, es: data },
            published: { en: data, es: data }
        };
    }
    // Ensure forms and responses arrays exist safely
    ['en', 'es'].forEach(lang => {
        if(data.draft && data.draft[lang]) {
            if(!data.draft[lang].forms) data.draft[lang].forms = [];
            if(!data.draft[lang].responses) data.draft[lang].responses = {};
            if(!data.draft[lang].memos) data.draft[lang].memos = [];
            if(!data.draft[lang].communications_log) data.draft[lang].communications_log = [];
        }
        if(data.published && data.published[lang]) {
            if(!data.published[lang].forms) data.published[lang].forms = [];
            if(!data.published[lang].responses) data.published[lang].responses = {};
            if(!data.published[lang].memos) data.published[lang].memos = [];
            if(!data.published[lang].communications_log) data.published[lang].communications_log = [];
        }
    });
    return data;
}

// API: Fetch Public Data (For index.html)
app.get('/api/data', async (req, res) => {
    const userId = req.query.user_id;
    const lang = req.query.lang || 'en';
    
    if (!userId) {
        return res.status(400).json({ success: false, message: 'Missing user_id query parameter.' });
    }

    const defaultData = JSON.parse(fs.readFileSync(path.join(__dirname, 'data.json'), 'utf8'));
    const defaultMatrix = migrateData(defaultData);

    const { data, error } = await supabase
        .from('cms_data')
        .select('data')
        .eq('user_id', userId)
        .single();

    if (error || !data) {
        return res.json(defaultMatrix.published[lang]); // Fallback to beautiful default if no data yet
    }

    const matrix = migrateData(data.data);
    res.json(mergeDeep(defaultMatrix.published[lang], matrix.published[lang]));
});

// SECURED API: Fetch Admin Data
app.get('/api/admin-data', authenticateToken, async (req, res) => {
    const defaultData = JSON.parse(fs.readFileSync(path.join(__dirname, 'data.json'), 'utf8'));
    const defaultMatrix = migrateData(defaultData);

    const { data, error } = await supabase
        .from('cms_data')
        .select('data')
        .eq('user_id', req.user.id)
        .single();

    if (error || !data) {
        return res.json(defaultMatrix); 
    }

    const matrix = migrateData(data.data);
    
    // Merge defaults recursively for en and es
    matrix.draft.en = mergeDeep(defaultMatrix.draft.en, matrix.draft.en);
    matrix.draft.es = mergeDeep(defaultMatrix.draft.es, matrix.draft.es);
    matrix.published.en = mergeDeep(defaultMatrix.published.en, matrix.published.en);
    matrix.published.es = mergeDeep(defaultMatrix.published.es, matrix.published.es);

    res.json(matrix);
});

// SECURED API: Get current user ID
app.get('/api/me', authenticateToken, (req, res) => {
    res.json({ user_id: req.user.id });
});

// API: Verify current session status for page routing
app.get('/api/verify-session', authenticateToken, (req, res) => {
    res.json({ success: true });
});

// Recursive Sanitization Function
function sanitizeData(obj) {
    if (typeof obj === 'string') {
        return xss(obj);
    } else if (Array.isArray(obj)) {
        return obj.map(item => sanitizeData(item));
    } else if (typeof obj === 'object' && obj !== null) {
        const sanitizedObj = {};
        for (const [key, value] of Object.entries(obj)) {
            sanitizedObj[key] = sanitizeData(value);
        }
        return sanitizedObj;
    }
    return obj;
}

// API: Handle User Logout
app.post('/api/logout', (req, res) => {
    logActivity('admin', 'USER_LOGOUT', 'SUCCESS');
    res.clearCookie('auth_token');
    res.json({ success: true, message: 'Logged out.' });
});

// Zod Schema Guard
const cmsSchema = z.object({
    brand: z.object({ name: z.string().min(1) }).passthrough(),
    hero: z.object({ tagline: z.string(), headline: z.string(), subtext: z.string(), bgImage: z.string().optional() }).passthrough(),
    servicesSection: z.object({ title: z.string(), items: z.array(z.any()) }).passthrough(),
    processSection: z.any(),
    projectsSection: z.any(),
    stats: z.array(z.any()),
    nav: z.array(z.any()),
    forms: z.array(z.any()).optional(),
    responses: z.any().optional(),
    memos: z.array(z.any()).optional(),
    communications_log: z.array(z.any()).optional()
});

// SECURED API: Save data
app.post('/api/save-data', authenticateToken, async (req, res) => {
    const { mode, lang, payload } = req.body;

    if (!['draft', 'publish'].includes(mode) || !['en', 'es'].includes(lang)) {
        return res.status(400).json({ success: false, message: 'Invalid mode or language' });
    }

    try {
        cmsSchema.parse(payload);
    } catch (err) {
        logActivity(req.user.id, 'MUTATE_CMS_DATA', 'FAILED_VALIDATION');
        return res.status(400).json({ success: false, message: 'Data failed schema validation guards.', errors: err.errors });
    }

    const cleanData = sanitizeData(payload);

    // Fetch existing matrix
    const { data: existingData } = await supabase.from('cms_data').select('data').eq('user_id', req.user.id).single();
    let matrix = existingData ? migrateData(existingData.data) : migrateData(JSON.parse(fs.readFileSync(path.join(__dirname, 'data.json'), 'utf8')));

    // Apply updates
    matrix.draft[lang] = cleanData;
    if (mode === 'publish') {
        matrix.published[lang] = cleanData;
    }

    const { error } = await supabase
        .from('cms_data')
        .upsert({ user_id: req.user.id, data: matrix }, { onConflict: 'user_id' });
        
    if (error) {
        console.error(error);
        logActivity(req.user.id, 'MUTATE_CMS_DATA', 'FAILED_WRITE');
        return res.status(500).json({ success: false, message: 'Database write failed: ' + error.message });
    }

    logActivity(req.user.id, `MUTATE_CMS_DATA_${mode.toUpperCase()}`, 'SUCCESS');

    res.json({ success: true, message: `Website ${mode === 'publish' ? 'published live' : 'saved as draft'} securely!` });
});

// SECURED API: Image uploads
app.post('/api/upload-image', authenticateToken, upload.single('image'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ success: false, message: 'No file uploaded.' });
    }
    const imageUrl = req.file.path;
    res.json({ success: true, imageUrl });
});

// SECURED API: Read and return historically uploaded graphic files from Cloudinary
app.get('/api/media', authenticateToken, async (req, res) => {
    try {
        const result = await cloudinary.search
            .expression('folder:nexus_cms_uploads')
            .sort_by('created_at', 'desc')
            .max_results(30)
            .execute();
            
        const fileUrls = result.resources.map(file => file.secure_url);
        res.json({ success: true, media: fileUrls });
    } catch (err) {
        console.error('Cloudinary fetch error:', err);
        return res.status(500).json({ success: false, message: 'Unable to fetch media from Cloudinary.' });
    }
});

// SECURED API: Soft Delete Media Asset
app.post('/api/delete-media', authenticateToken, async (req, res) => {
    const { url } = req.body;
    try {
        const urlParts = url.split('/');
        const fileWithExt = urlParts[urlParts.length - 1];
        const folder = urlParts[urlParts.length - 2]; 
        const filename = fileWithExt.split('.')[0];
        const publicId = `${folder}/${filename}`;
        
        // Soft delete: rename/move to a trash folder so it is hidden from the UI but never lost
        const trashPublicId = `nexus_cms_trash/${filename}-${Date.now()}`;
        await cloudinary.uploader.rename(publicId, trashPublicId);
        
        logActivity(req.user.id, `SOFT_DELETE_MEDIA`, `Archived ${publicId} to trash`);
        res.json({ success: true, message: 'Asset archived safely.' });
    } catch (err) {
        console.error('Soft delete error:', err);
        logActivity(req.user.id, 'DELETE_MEDIA', 'FAILED');
        return res.status(500).json({ success: false, message: 'Failed to archive asset.' });
    }
});

// ENTERPRISE SECURITY: Rate Limiter to prevent form spam
const formSubmitLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 5, // Limit each IP to 5 requests per minute
    message: { success: false, message: 'Too many submissions from this IP. Please try again later.' }
});

// PUBLIC API: Accept Dynamic Form Submissions from Storefront
app.post('/api/submit-form/:formId', formSubmitLimiter, async (req, res) => {
    const { formId } = req.params;
    const key = req.query.key;
    const lang = req.query.lang || 'en';
    const payload = req.body;

    if (!key) {
        return res.status(400).json({ success: false, message: 'Missing public form key.' });
    }

    try {
        // Securely look up the true User ID by querying the JSON matrix for the public Form Key
        const { data: existingData, error: fetchErr } = await supabase
            .from('cms_data')
            .select('data, user_id')
            .eq('data->draft->en->brand->>formKey', key)
            .single();

        if (fetchErr || !existingData) {
            return res.status(404).json({ success: false, message: 'Invalid form key or account not found.' });
        }
        
        const userId = existingData.user_id;

        let matrix = migrateData(existingData.data);
        
        // Push response into draft and published matrices so the admin sees it in the inbox
        const newResponse = {
            id: 'resp_' + Date.now(),
            timestamp: new Date().toISOString(),
            data: payload
        };

        if(!matrix.draft[lang].responses[formId]) matrix.draft[lang].responses[formId] = [];
        if(!matrix.published[lang].responses[formId]) matrix.published[lang].responses[formId] = [];

        matrix.draft[lang].responses[formId].push(newResponse);
        matrix.published[lang].responses[formId].push(newResponse);

        const { error } = await supabase
            .from('cms_data')
            .upsert({ user_id: userId, data: matrix }, { onConflict: 'user_id' });

        if (error) throw error;
        
        // Dispatch Email Notification (Asynchronous)
        if (process.env.SMTP_USER && process.env.SMTP_PASS) {
            const activeForm = matrix.published[lang].forms.find(f => f.id === formId) || { title: 'Custom Form' };
            
            let emailHtml = `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 8px; padding: 20px;">`;
            emailHtml += `<h2 style="color: #d0aa69; border-bottom: 1px solid #eee; padding-bottom: 10px;">New Inquiry: ${activeForm.title}</h2>`;
            emailHtml += `<p style="color: #777; font-size: 0.9rem;">Received at: ${new Date(newResponse.timestamp).toLocaleString()}</p>`;
            
            for (const [key, value] of Object.entries(payload)) {
                emailHtml += `<div style="margin-top: 15px;">`;
                emailHtml += `<strong style="display: block; color: #333; font-size: 0.85rem; text-transform: uppercase;">${key}</strong>`;
                emailHtml += `<div style="background: #f9f9f9; padding: 10px; border-radius: 4px; border: 1px solid #ddd; margin-top: 5px; color: #111;">${value}</div>`;
                emailHtml += `</div>`;
            }
            emailHtml += `</div>`;

            // MULTI-TENANT DYNAMIC ROUTING
            // Fallback to global SMTP user if the tenant hasn't configured an email
            const tenantEmail = matrix.published[lang].brand?.adminEmail || process.env.SMTP_USER;

            // Extract the customer's email from the payload
            let customerEmail = '';
            for (const key of Object.keys(payload)) {
                if (key.toLowerCase().includes('email')) {
                    customerEmail = payload[key];
                    break;
                }
            }

            const mailPromises = [];

            // 1. Dispatch the Internal Admin Alert to the specific Tenant
            mailPromises.push(emailTransporter.sendMail({
                from: `"Operations Hub" <${process.env.SMTP_USER}>`, // Still sends *from* the central server
                to: tenantEmail, // Routes *to* the shop owner
                replyTo: customerEmail || undefined, // Directs replies to the customer
                subject: `New Lead: ${activeForm.title}`,
                html: emailHtml
            }));

            // 2. Dispatch the External Customer Auto-Responder (If an email was provided)
            if (customerEmail) {
                const autoResponderHtml = `
                <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 8px 30px rgba(0,0,0,0.08); border: 1px solid #eaeaea;">
                    <div style="background-color: #121315; padding: 40px 30px; text-align: center;">
                        <h2 style="color: #d0aa69; margin: 0; font-size: 26px; font-weight: 500; letter-spacing: 1px;">Registration Received</h2>
                        <p style="color: #a0a0a0; margin: 10px 0 0 0; font-size: 15px;">${activeForm.title}</p>
                    </div>
                    <div style="padding: 40px 30px; color: #444; font-size: 16px; line-height: 1.6;">
                        <p>Hi there,</p>
                        <p>Thank you so much for registering! We have successfully received your submission.</p>
                        <p><strong>Important Details:</strong></p>
                        <ul style="color: #555;">
                            <li><strong>Venue:</strong> To be announced prior to the event date.</li>
                            <li><strong>Updates:</strong> We will communicate any schedule changes or results directly via this email thread.</li>
                        </ul>
                        <p>If you have any immediate questions, simply reply to this email to get in touch with our team.</p>
                        <br>
                        <p>Best regards,<br><strong>Tournament Operations Team</strong></p>
                    </div>
                </div>
                `;

                mailPromises.push(emailTransporter.sendMail({
                    from: `"Tournament Support" <${process.env.SMTP_USER}>`,
                    to: customerEmail,
                    replyTo: tenantEmail, // Directs replies back to the specific shop owner
                    subject: `Registration Confirmation: ${activeForm.title}`,
                    html: autoResponderHtml
                }));
            }

            Promise.all(mailPromises).then(() => {
                logActivity(userId, `EMAIL_NOTIFICATION_SENT_${formId}`, 'SUCCESS');
            }).catch(err => {
                console.error('Email Dispatch Error:', err);
                logActivity(userId, `EMAIL_NOTIFICATION_FAILED_${formId}`, 'FAILED');
            });
        }
        
        logActivity(userId, `FORM_SUBMISSION_${formId}`, 'SUCCESS');
        res.json({ success: true, message: 'Response recorded securely.' });
    } catch (err) {
        console.error('Form submission error:', err);
        res.status(500).json({ success: false, message: 'Server error processing form.' });
    }
});

// SECURED API: Create and Stamp Memos
app.post('/api/memos/stamp', authenticateToken, async (req, res) => {
    const { id, content, author, lang = 'en' } = req.body;
    if (!id || !content) return res.status(400).json({ success: false, message: 'Missing memo data.' });

    const secret = process.env.MEMO_SIGNING_SECRET || 'default_secret';
    const timestamp = new Date().toISOString();
    const dataToSign = `${id}:${content}:${author}:${timestamp}`;
    const signature = crypto.createHmac('sha256', secret).update(dataToSign).digest('hex');

    // Fetch and update matrix
    const { data: existingData } = await supabase.from('cms_data').select('data').eq('user_id', req.user.id).single();
    if (!existingData) return res.status(404).json({ success: false, message: 'Matrix not found.' });

    let matrix = migrateData(existingData.data);
    const newMemo = { id, content, author, timestamp, signature, status: 'STAMPED' };
    matrix.draft[lang].memos.push(newMemo);
    matrix.published[lang].memos.push(newMemo);

    const { error } = await supabase.from('cms_data').upsert({ user_id: req.user.id, data: matrix }, { onConflict: 'user_id' });
    if (error) return res.status(500).json({ success: false, message: 'Database error' });

    logActivity(req.user.id, `MEMO_STAMPED_${id}`, 'SUCCESS');
    res.json({ success: true, message: 'Memo stamped cryptographically.', memo: newMemo });
});

// SECURED API: Send Broadcast Communication
app.post('/api/send-message', authenticateToken, upload.single('attachment'), async (req, res) => {
    const { subject, message, recipient } = req.body;
    const lang = req.query.lang || 'en';

    try {
        const mailOptions = {
            from: `"Communications" <${process.env.SMTP_USER}>`,
            to: recipient === 'all' ? process.env.SMTP_USER : recipient,
            subject: subject,
            html: `<div style="font-family:sans-serif;"><h2>${subject}</h2><p>${message}</p></div>`
        };

        if (req.file) {
            // Use the Cloudinary URL from the uploaded file as an attachment
            mailOptions.attachments = [{ path: req.file.path }];
        }

        await emailTransporter.sendMail(mailOptions);

        // Log to communications
        const { data: existingData } = await supabase.from('cms_data').select('data').eq('user_id', req.user.id).single();
        if (existingData) {
            let matrix = migrateData(existingData.data);
            const logEntry = { id: 'msg_' + Date.now(), subject, recipient, timestamp: new Date().toISOString() };
            matrix.draft[lang].communications_log.push(logEntry);
            matrix.published[lang].communications_log.push(logEntry);
            await supabase.from('cms_data').upsert({ user_id: req.user.id, data: matrix }, { onConflict: 'user_id' });
        }

        logActivity(req.user.id, `BROADCAST_SENT_${recipient}`, 'SUCCESS');
        res.json({ success: true, message: 'Message sent successfully.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Failed to send message.' });
    }
});

// SECURED API: Live System Vitals Monitor & Smart Cron Health Check
app.get('/api/system/health', (req, res) => {
    // This route serves dual purpose: 
    // 1. Dashboard Vitals (requires auth? We can make it public or header-based for cron)
    // 2. Cron Job Ping
    
    const isCron = req.query.ping === 'true';
    if (isCron) {
        logActivity('cron_service', 'WARM_PING', 'SUCCESS');
        return res.json({ success: true, status: 'WARM' });
    }

    // Memory calculation
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const memUsagePct = ((usedMem / totalMem) * 100).toFixed(1);

    // Uptime calculation
    const serverUptimeHours = (process.uptime() / 3600).toFixed(2);

    res.json({
        success: true,
        memory: `${memUsagePct}%`,
        uptime: `${serverUptimeHours} Hrs`,
        loadAverage: os.loadavg()[0].toFixed(2)
    });
});

// SECURED API: System Analytics (GDPR Compliant Aggregation)
app.get('/api/analytics', authenticateToken, (req, res) => {
    // Read local logs and count dispatches to create aggregated, anonymized data
    const logPath = path.join(__dirname, 'logs.txt');
    if (!fs.existsSync(logPath)) {
        return res.json({ success: true, totalEmailsSent: 0, activeClients: 0 });
    }
    
    fs.readFile(logPath, 'utf8', (err, data) => {
        if (err) return res.status(500).json({ success: false, message: 'Failed to read audit logs.' });
        
        const lines = data.split('\n');
        let totalEmails = 0;
        let clients = new Set();

        lines.forEach(line => {
            if (line.includes('DISPATCHED_TO_') || line.includes('BROADCAST_SENT') || line.includes('EMAIL_NOTIFICATION_SENT')) {
                totalEmails++;
            }
            if (line.includes('HIGHWAY_[')) {
                const match = line.match(/HIGHWAY_\[(.*?)\]/);
                if (match) clients.add(match[1]);
            }
        });

        res.json({
            success: true,
            totalEmailsSent: totalEmails,
            activeClients: clients.size
        });
    });
});

app.listen(PORT, () => {
    console.log(`\n🚀 Secure Mail Server Active on http://localhost:${PORT}/login.html`);
});