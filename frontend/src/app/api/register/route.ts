import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { logActivity } from '@/lib/logger';

export async function POST(request: Request) {
    try {
        const { username, password } = await request.json();
        
        const { data, error } = await supabase.auth.signUp({
            email: username,
            password: password
        });

        if (error) {
            return NextResponse.json({ success: false, message: error.message }, { status: 400 });
        }

        // Using "system" as username when the user ID is not yet confirmed, or we use the returned user ID.
        const logId = data?.user?.id || username;
        logActivity(logId, 'USER_REGISTER', 'SUCCESS');

        return NextResponse.json({ success: true, message: 'Registration successful! You can now log in.' });
    } catch (err) {
        console.error('Register error:', err);
        return NextResponse.json({ success: false, message: 'Server communication failure.' }, { status: 500 });
    }
}
