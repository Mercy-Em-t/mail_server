import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import fs from 'fs';
import path from 'path';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY!;

async function getSupabaseAuth() {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;
    
    if (!token) return { supabase: null, userId: null };
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: `Bearer ${token}` } }
    });
    
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return { supabase: null, userId: null };
    
    return { supabase, userId: user.id };
}

// Deep merge utility
function mergeDeep(target: any, source: any) {
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

// Data Migration
function migrateData(data: any) {
    if (!data || !data.draft) {
        data = {
            draft: { en: data, es: data },
            published: { en: data, es: data }
        };
    }
    ['en', 'es'].forEach(lang => {
        if(data.draft && data.draft[lang]) {
            if(!data.draft[lang].forms) data.draft[lang].forms = [];
            if(!data.draft[lang].responses) data.draft[lang].responses = {};
        }
        if(data.published && data.published[lang]) {
            if(!data.published[lang].forms) data.published[lang].forms = [];
            if(!data.published[lang].responses) data.published[lang].responses = {};
        }
    });
    return data;
}

function getDefaultMatrix() {
    const defaultDataStr = fs.readFileSync(path.join(process.cwd(), 'src/lib/data.json'), 'utf8');
    const defaultData = JSON.parse(defaultDataStr);
    return migrateData(defaultData);
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const lang = searchParams.get('lang') || 'en';
    const isAdmin = searchParams.get('admin') === 'true';
    
    try {
        const { supabase: authSupabase, userId: authUserId } = await getSupabaseAuth();
        const defaultMatrix = getDefaultMatrix();

        // If not authenticated, we can't fetch private data, so fallback to default or generic read
        const client = authSupabase || createClient(supabaseUrl, supabaseAnonKey);
        // Use provided user_id or fallback to authUserId
        const userId = searchParams.get('user_id') || authUserId || '123e4567-e89b-12d3-a456-426614174000';

        const { data, error } = await client
            .from('cms_data')
            .select('data')
            .eq('user_id', userId)
            .single();
            
        let matrix;
        if (error && error.code === 'PGRST116') {
            matrix = defaultMatrix;
        } else if (error) {
            throw error;
        } else {
            matrix = migrateData(data.data);
            matrix.draft.en = mergeDeep(defaultMatrix.draft.en, matrix.draft.en);
            matrix.draft.es = mergeDeep(defaultMatrix.draft.es, matrix.draft.es);
            matrix.published.en = mergeDeep(defaultMatrix.published.en, matrix.published.en);
            matrix.published.es = mergeDeep(defaultMatrix.published.es, matrix.published.es);
        }

        if (isAdmin) {
            return NextResponse.json(matrix);
        } else {
            return NextResponse.json(matrix.published[lang as 'en' | 'es']);
        }
    } catch (err: any) {
        if (err && err.code === 'PGRST116') {
            const defaultMatrix = getDefaultMatrix();
            const isAdmin = searchParams.get('admin') === 'true';
            const lang = searchParams.get('lang') || 'en';
            if (isAdmin) {
                return NextResponse.json(defaultMatrix);
            } else {
                return NextResponse.json(defaultMatrix.published[lang as 'en' | 'es']);
            }
        }
        console.error('Error fetching data:', err);
        return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const { mode, lang, payload } = await request.json();
        const { supabase: authSupabase, userId } = await getSupabaseAuth();

        if (!authSupabase || !userId) {
            return NextResponse.json({ success: false, message: 'Unauthorized. Please log in.' }, { status: 401 });
        }

        const { data: existingData, error: fetchErr } = await authSupabase
            .from('cms_data')
            .select('data')
            .eq('user_id', userId)
            .single();
            
        let matrix;
        if (fetchErr && fetchErr.code === 'PGRST116') {
            matrix = getDefaultMatrix();
        } else if (fetchErr) {
            throw fetchErr;
        } else {
            matrix = migrateData(existingData.data);
        }
        
        if (mode === 'publish') {
            matrix.published[lang] = payload;
            matrix.draft[lang] = payload;
        } else if (mode === 'draft') {
            matrix.draft[lang] = payload;
        }
        
        const { error: upsertErr } = await authSupabase
            .from('cms_data')
            .upsert({ user_id: userId, data: matrix }, { onConflict: 'user_id' });
            
        if (upsertErr) throw upsertErr;
        
        return NextResponse.json({ success: true, message: 'Data saved successfully' });
    } catch (err: any) {
        if (err && err.code === 'PGRST116') {
            // Should not happen for POST select usually, but if it throws:
            // Just let it pass and do upsert. We can't easily resume the flow inside catch,
            // but we can just ignore it. Actually, wait, it's easier to just ignore PGRST116.
        }
        console.error('Save Data Error:', err);
        return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
    }
}
