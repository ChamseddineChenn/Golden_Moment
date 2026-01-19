import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Get auth cookies
  const accessToken = request.cookies.get('access_token');
  const refreshToken = request.cookies.get('refresh_token');
  
  const isAuthenticated = !!(accessToken || refreshToken);

  // Auth routes (login, signup)
  const authRoutes = ['/auth/login', '/auth/signup'];
  const isAuthRoute = authRoutes.includes(pathname);

  // Protected routes (require authentication)
  const protectedRoutes = ['/admin'];
  const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route));

  // Redirect authenticated users away from auth pages to homepage
  if (isAuthenticated && isAuthRoute) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  // Redirect unauthenticated users from protected routes to login
  if (!isAuthenticated && isProtectedRoute) {
    return NextResponse.redirect(new URL('/auth/login', request.url));
  }

  // Allow all other routes (including homepage)
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/admin/:path*',
    '/auth/login',
    '/auth/signup',
  ],
};
