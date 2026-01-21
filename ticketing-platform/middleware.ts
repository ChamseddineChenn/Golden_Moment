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

// Route access configuration
const ROUTE_ACCESS: Record<string, UserType[]> = {
  '/admin': ['ADMIN'],
  '/organizer': ['ADMIN', 'ORGANIZER'],
};

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

/**
 * Check if user role has access to the given route
 */
function hasAccess(pathname: string, userType: UserType | null): boolean {
  // Find matching route prefix
  for (const [routePrefix, allowedRoles] of Object.entries(ROUTE_ACCESS)) {
    if (pathname.startsWith(routePrefix)) {
      // Route is protected
      if (!userType) {
        return false; // Not authenticated
      }
      return allowedRoles.includes(userType);
    }
  }

  // Route is not protected (public)
  return true;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Define auth routes (login/signup pages)
  const authRoutes = ['/auth/login', '/auth/signup', '/auth/signup-organizer'];
  const isAuthRoute = authRoutes.includes(pathname);

  // Check if this is a protected route
  const isProtectedRoute = Object.keys(ROUTE_ACCESS).some((route) =>
    pathname.startsWith(route),
  );

  // If it's a protected route, verify authentication and authorization
  if (isProtectedRoute) {
    const userType = await getCurrentUser(request);

    // Not authenticated - redirect to login
    if (!userType) {
      const loginUrl = new URL('/auth/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }

    // Authenticated but not authorized - redirect to forbidden or home
    if (!hasAccess(pathname, userType)) {
      // Option 1: Redirect to home page
      return NextResponse.redirect(new URL('/', request.url));

      // Option 2: Redirect to a 403 forbidden page (uncomment if you have one)
      // return NextResponse.redirect(new URL('/403', request.url));
    }

    // Authorized - allow access
    return NextResponse.next();
  }

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

  // Allow access to public routes
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
