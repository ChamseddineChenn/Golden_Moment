import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Get auth cookies
  const accessToken = request.cookies.get('access_token');
  const refreshToken = request.cookies.get('refresh_token');
  
  const isAuthenticated = !!(accessToken || refreshToken);

  // Protected routes
  const protectedRoutes = ['/dashboard', '/admin'];
  const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route));

  // Auth routes (login, signup)
  const authRoutes = ['/login', '/signup'];
  const isAuthRoute = authRoutes.some(route => pathname.startsWith(route));

  // Redirect authenticated users away from auth pages
  if (isAuthenticated && isAuthRoute) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // Redirect unauthenticated users to login
  if (!isAuthenticated && isProtectedRoute) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/admin/:path*',
    '/login',
    '/signup',
  ],
};
