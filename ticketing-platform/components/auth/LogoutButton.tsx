'use client';

import { useAuth } from '@/lib/hooks/useAuth';
import { Button } from '../UI/Button';

export function LogoutButton() {
  const { logout } = useAuth();

  return (
    <Button
      onClick={logout}
      variant="secondary"
      className="cursor-pointer"
    >
      Logout
    </Button>
  );
}
