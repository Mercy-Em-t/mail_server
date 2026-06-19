const http = require('http');
const https = require('https');

async function run() {
    console.log('Testing unauthenticated GET...');
    const noAuthRes = await fetch('https://newgen-at2s.onrender.com/api/verify-session', {
        method: 'GET'
    });
    console.log('Unauth status:', noAuthRes.status);
    console.log('Unauth headers:', Object.fromEntries(noAuthRes.headers.entries()));

    const username = 'testuser' + Date.now() + '@example.com';
    const password = 'Password123!';
    
    console.log('\nRegistering:', username);
    await fetch('https://newgen-at2s.onrender.com/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    });

    console.log('Logging in...');
    const loginRes = await fetch('https://newgen-at2s.onrender.com/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    });
    const loginCookies = loginRes.headers.get('set-cookie');
    console.log('Set-Cookie:', loginCookies);

    if (loginCookies) {
        console.log('\nVerifying session with cookie...');
        const verifyRes = await fetch('https://newgen-at2s.onrender.com/api/verify-session', {
            method: 'GET',
            headers: {
                'Cookie': loginCookies.split(';')[0]
            }
        });
        console.log('Verify status:', verifyRes.status);
        console.log('Verify headers:', Object.fromEntries(verifyRes.headers.entries()));
    }
}

run();
