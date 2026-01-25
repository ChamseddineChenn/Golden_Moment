import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

interface AuthMeResponse {
  success: boolean;
  user?: {
    id: string;
    email: string;
    userType: string;
  };
}

type UserType = 'ADMIN' | 'ORGANIZER' | 'USER';

function normalizeUserType(userType: string): UserType | null {
  const normalized = userType.toUpperCase();
  if (normalized === 'ADMIN' || normalized === 'ORGANIZER' || normalized === 'USER') {
    return normalized as UserType;
  }
  return null;
}

async function getCurrentUser(request: NextRequest): Promise<UserType | null> {
  const accessToken = request.cookies.get('access_token')?.value;
  const refreshToken = request.cookies.get('refresh_token')?.value;

  if (!accessToken && !refreshToken) {
    return null;
  }

  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/me`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `access_token=${accessToken || ''}; refresh_token=${refreshToken || ''}`,
      },
      credentials: 'include',
    });

    if (!response.ok) {
      console.log('Auth check failed: response not ok', response.status);
      return null;
    }

    const responseData = await response.json();

    const data: AuthMeResponse = responseData.data || responseData;

    console.log('Auth /me response:', JSON.stringify(data, null, 2));

    if (!data || !data.user || !data.user.userType) {
      console.log('Auth check failed: missing user or userType');
      return null;
    }

    const normalized = normalizeUserType(data.user.userType);
    console.log('Normalized userType:', normalized);

    return normalized;
  } catch (error) {
    console.error('Middleware auth check failed:', error);
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const authRoutes = ['/auth/login', '/auth/signup', '/auth/signup-organizer'];
  const isAuthRoute = authRoutes.includes(pathname);

  if (isAuthRoute) {
    const userType = await getCurrentUser(request);

    if (userType) {
      // Already logged in, redirect to appropriate dashboard
      if (userType === 'ADMIN') {
        return NextResponse.redirect(new URL('/', request.url));
      } else if (userType === 'ORGANIZER') {
        return NextResponse.redirect(new URL('/', request.url));
      } else {
        return NextResponse.redirect(new URL('/', request.url));
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
