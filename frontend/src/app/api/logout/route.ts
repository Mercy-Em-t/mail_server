import { NextResponse } from 'next/server';
import { logActivity } from '@/lib/logger';
import { cookies } from 'next/headers';

export async function POST() {
    try {
        logActivity('admin', 'USER_LOGOUT', 'SUCCESS');
        
        const cookieStore = await cookies();
        cookieStore.delete('auth_token');

        return NextResponse.json({ success: true, message: 'Logged out.' });
    } catch (err) {
        console.error('Logout error:', err);
        return NextResponse.json({ success: false, message: 'Server communication failure.' }, { status: 500 });
    }
}
