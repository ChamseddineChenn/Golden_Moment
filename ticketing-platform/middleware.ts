import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Types matching your backend response
interface AuthMeResponse {
  success: boolean;
  user: {
    id: string;
    email: string;
    userType: 'ADMIN' | 'ORGANIZER' | 'USER';
  };
}

type UserType = 'ADMIN' | 'ORGANIZER' | 'USER';

/**
 * Fetches current user from backend /auth/me endpoint
 * Returns null if unauthorized or if request fails
 */
async function getCurrentUser(request: NextRequest): Promise<UserType | null> {
  const accessToken = request.cookies.get('access_token')?.value;
  const refreshToken = request.cookies.get('refresh_token')?.value;

  // Fast path: no tokens = not authenticated
  if (!accessToken && !refreshToken) {
    return null;
  }

  try {
    // Call backend /auth/me with cookies forwarded
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/me`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        // Forward cookies to backend
        Cookie: `access_token=${accessToken || ''}; refresh_token=${refreshToken || ''}`,
      },
      credentials: 'include',
    });

    if (!response.ok) {
      return null;
    }

    const data: AuthMeResponse = await response.json();
    return data.user.userType;
  } catch (error) {
    console.error('Middleware auth check failed:', error);
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Define auth routes (login/signup pages)
  const authRoutes = ['/auth/login', '/auth/signup', '/auth/signup-organizer'];
  const isAuthRoute = authRoutes.includes(pathname);

  // Optional: Redirect authenticated users away from auth pages
  if (isAuthRoute) {
    const userType = await getCurrentUser(request);

    if (userType) {
      // Already logged in, redirect to appropriate dashboard
      if (userType === 'ADMIN') {
        return NextResponse.redirect(new URL('/admin', request.url));
      } else if (userType === 'ORGANIZER') {
        return NextResponse.redirect(new URL('/organizer', request.url));
      } else {
        return NextResponse.redirect(new URL('/', request.url));
      }
    }
  }

  // Allow access to all routes
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (public folder)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};