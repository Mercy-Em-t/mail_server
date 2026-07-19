require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function createUser() {
    const { data: userAuth, error: authError } = await supabase.auth.admin.createUser({
        email: '1@gmail.com',
        password: '123456',
        email_confirm: true
    });
    
    if (authError) {
        console.error("Auth Error:", authError.message);
        // Try to get user if already exists
        const { data: listUsers } = await supabase.auth.admin.listUsers();
        const existing = listUsers.users.find(u => u.email === '1@gmail.com');
        if (existing) {
            console.log("User already exists, id:", existing.id);
            await upsertCmsData(existing.id);
        }
        return;
    }
    
    const userId = userAuth.user.id;
    console.log("User created:", userId);
    
    await upsertCmsData(userId);
}

async function upsertCmsData(userId) {
    const matrix = {
      "draft": {
        "en": {
          "brand": {
            "name": "Tournament 2026",
            "adminEmail": "emmercy65@gmail.com",
            "formKey": "key_tourn"
          },
          "hero": {
            "tagline": "The Ultimate Tournament",
            "headline": "Register Now",
            "subtext": "<p>Sign up to participate in the upcoming tournament.</p>",
            "bgImage": ""
          },
          "servicesSection": { "items": [] },
          "stats": [],
          "projectsSection": { "items": [] },
          "forms": [
            {
              "id": "form_tourn_1",
              "title": "Tournament Registration",
              "fields": [
                { "label": "Name", "type": "text" },
                { "label": "Email", "type": "email" },
                { "label": "Contact", "type": "text" },
                { "label": "Choose category to participate (min 1 max 2)", "type": "text" }
              ]
            }
          ]
        }
      },
      "live": {
        "en": {
          "brand": {
            "name": "Tournament 2026",
            "adminEmail": "emmercy65@gmail.com",
            "formKey": "key_tourn"
          },
          "hero": {
            "tagline": "The Ultimate Tournament",
            "headline": "Register Now",
            "subtext": "<p>Sign up to participate in the upcoming tournament.</p>",
            "bgImage": ""
          },
          "servicesSection": { "items": [] },
          "stats": [],
          "projectsSection": { "items": [] },
          "forms": [
            {
              "id": "form_tourn_1",
              "title": "Tournament Registration",
              "fields": [
                { "label": "Name", "type": "text" },
                { "label": "Email", "type": "email" },
                { "label": "Contact", "type": "text" },
                { "label": "Choose category to participate (min 1 max 2)", "type": "text" }
              ]
            }
          ]
        }
      }
    };
    
    const { error: dbError } = await supabase.from('cms_data').upsert({
        user_id: userId,
        data: matrix
    }, { onConflict: 'user_id' });
    
    if (dbError) {
        console.error("DB Error:", dbError.message);
    } else {
        console.log("CMS Data saved for user:", userId);
    }
}

createUser();
