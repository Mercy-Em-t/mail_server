process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'; // Bypass local TLS for Supabase connection
require('dotenv').config();
const app = require('./server.js');
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`\n🚀 Secure Mail Server (Vercel Format) Active locally on http://localhost:${PORT}`);
});
