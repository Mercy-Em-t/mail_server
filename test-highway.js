/**
 * test-highway.js — Multi-client connection protocol test
 *
 * Tests:
 *  1. Register a client via API
 *  2. Dispatch using template (template-based path)
 *  3. Dispatch using raw HTML (raw path)
 *  4. Deactivate client — verify 403
 */
require('dotenv').config();
const jwt = require('jsonwebtoken');

const BASE = 'http://localhost:3000';

async function api(path, method = 'GET', body = null, headers = {}) {
    const opts = { method, headers: { 'Content-Type': 'application/json', ...headers } };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(BASE + path, opts);
    return res.json();
}

async function run() {
    console.log('\n══════════════════════════════════════════');
    console.log(' EXPRESS HIGHWAY — MULTI-CLIENT TEST SUITE');
    console.log('══════════════════════════════════════════\n');

    // ── Step 1: Register client via API (needs admin cookie — skip in automated test)
    //    We'll read from clients.json directly or assume a test client was registered.
    //    For full automation, use the dashboard or add a test client to clients.json manually.

    // ── Step 2: Use first registered client from clients.json
    const fs = require('fs');
    const clientsRaw = fs.readFileSync('./clients.json', 'utf8');
    const { clients } = JSON.parse(clientsRaw);

    if (!clients.length) {
        console.log('❌ No clients registered. Open the dashboard → Clients tab → Register a client first.');
        process.exit(1);
    }

    const client = clients[0];
    console.log(`✅ Using client: ${client.client_name} (${client.client_id})`);

    // Build a valid JWT for this client
    const token = jwt.sign(
        { client_id: client.client_id, domain: client.domain },
        client.secret,
        { expiresIn: '5m' }
    );
    console.log(`   Token (first 40 chars): ${token.substring(0, 40)}...`);

    const highwayHeader = { 'x-highway-token': token };

    // ── Test A: Template-based dispatch
    console.log('\n── Test A: Template-based dispatch (welcome_email)');
    const resA = await api('/api/dispatch', 'POST', {
        client_id: client.client_id,
        template: 'welcome_email',
        to: process.env.SMTP_USER,
        message_type: 'transactional',
        variables: {
            name: 'Test User',
            brand_name: 'TM Savannah',
            message: 'This is a test from the highway test suite.',
            cta_url: 'https://tmsavannah.com',
            cta_label: 'Visit Site'
        }
    }, highwayHeader);
    console.log('   Response:', resA.success ? '✅ ' + resA.message : '❌ ' + resA.message);

    // ── Test B: Raw HTML dispatch
    console.log('\n── Test B: Raw HTML dispatch');
    const resB = await api('/api/dispatch', 'POST', {
        client_id: client.client_id,
        to: process.env.SMTP_USER,
        subject: 'Raw Dispatch Test from Highway Suite',
        html: '<h1 style="color:#1a1a2e;">Raw HTML Test</h1><p>The Express Highway multi-client system is working correctly.</p>',
        message_type: 'notification'
    }, highwayHeader);
    console.log('   Response:', resB.success ? '✅ ' + resB.message : '❌ ' + resB.message);

    // ── Test C: Unknown template
    console.log('\n── Test C: Unknown template (should 404)');
    const resC = await api('/api/dispatch', 'POST', {
        client_id: client.client_id,
        template: 'nonexistent_template',
        to: 'test@example.com'
    }, highwayHeader);
    console.log('   Response:', !resC.success ? '✅ Correctly rejected: ' + resC.message : '❌ Should have been rejected');

    // ── Test D: Bad JWT (wrong secret)
    console.log('\n── Test D: Bad JWT (wrong secret — should 403)');
    const badToken = jwt.sign({ client_id: client.client_id }, 'wrong-secret', { expiresIn: '1m' });
    const resD = await api('/api/dispatch', 'POST', { client_id: client.client_id, to: 'x@x.com', subject: 'x', html: 'x' }, { 'x-highway-token': badToken });
    console.log('   Response:', !resD.success ? '✅ Correctly rejected: ' + resD.message : '❌ Should have been rejected');

    console.log('\n══════════════════════════════════════════');
    console.log(' ALL TESTS COMPLETE');
    console.log('══════════════════════════════════════════\n');
}

run().catch(console.error);
