'use client';

import { useAuth } from '@/lib/hooks/useAuth';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { UserType } from '@/lib/types/auth.types';

interface RoleGuardProps {
  children: React.ReactNode;
  allowedRoles: UserType[];
  fallbackUrl?: string;
}

export function RoleGuard({ children, allowedRoles, fallbackUrl = '/' }: RoleGuardProps) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading) {
      // Not authenticated
      if (!user) {
        router.push(`/auth/login?redirect=${pathname}`);
        return;
      }

      // Not authorized
      if (!allowedRoles.includes(user.userType)) {
        router.push(fallbackUrl);
      }
    }
  }, [user, loading, allowedRoles, fallbackUrl, router, pathname]);

  // Show loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900" />
      </div>
    );
  }

  // Show nothing while redirecting
  if (!user || !allowedRoles.includes(user.userType)) {
    return null;
  }

  // User is authorized
  return <>{children}</>;
}
