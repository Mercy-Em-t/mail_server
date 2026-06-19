import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { logActivity } from '@/lib/logger';
import { cookies } from 'next/headers';

export async function POST(request: Request) {
    try {
        const { username, password } = await request.json();
        
        const { data, error } = await supabase.auth.signInWithPassword({
            email: username, 
            password: password
        });

        if (error) {
            return NextResponse.json({ success: false, message: error.message }, { status: 400 });
        }

        const cookieStore = await cookies();
        cookieStore.set('auth_token', data.session.access_token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 2 * 60 * 60, // 2 hours
            path: '/'
        });

        logActivity(data.user.id, 'USER_LOGIN', 'SUCCESS');

        return NextResponse.json({ success: true, message: 'Authentication successful.', user_id: data.user.id });
    } catch (err) {
        console.error('Login error:', err);
        return NextResponse.json({ success: false, message: 'Server communication failure.' }, { status: 500 });
    }
}
