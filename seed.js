process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function seed() {
    console.log('Starting seed process...');
    
    // 1. Seed Clients
    try {
        const clientsData = JSON.parse(fs.readFileSync('./clients.json', 'utf8'));
        if (clientsData.clients && clientsData.clients.length > 0) {
            const { error } = await supabase.from('mail_clients').upsert(clientsData.clients, { onConflict: 'client_id' });
            if (error) throw error;
            console.log(`✅ Seeded ${clientsData.clients.length} clients.`);
        }
    } catch (err) {
        console.error('⚠️ Could not seed clients:', err);
    }

    // 2. Seed Templates
    try {
        const templatesData = JSON.parse(fs.readFileSync('./templates.json', 'utf8'));
        const templatesArray = Object.values(templatesData);
        if (templatesArray.length > 0) {
            const { error } = await supabase.from('mail_templates').upsert(templatesArray, { onConflict: 'id' });
            if (error) throw error;
            console.log(`✅ Seeded ${templatesArray.length} templates.`);
        }
    } catch (err) {
        console.error('⚠️ Could not seed templates:', err.message);
    }

    console.log('Seed complete.');
}

seed();
