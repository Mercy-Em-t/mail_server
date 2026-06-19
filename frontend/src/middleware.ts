import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
    // Only protect the /admin route
    if (request.nextUrl.pathname.startsWith('/admin')) {
        const token = request.cookies.get('auth_token')?.value;

        if (!token) {
            // Redirect to login page if no auth_token is found
            return NextResponse.redirect(new URL('/login', request.url));
        }
    }

    return NextResponse.next();
}

export const config = {
    matcher: ['/admin/:path*'],
};
